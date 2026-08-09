import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const secrets = new SecretsManagerClient({});
const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const secretId = process.env.MARKETSTACK_SECRET_ID;
const symbols = (process.env.MARKET_SYMBOLS ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const rawBucket = process.env.MARKET_RAW_BUCKET;
const signalsTable = process.env.MARKET_SIGNALS_TABLE;
const historyTable = process.env.MARKET_HISTORY_TABLE;
const runsTable = process.env.MARKET_INGESTION_RUNS_TABLE;

function easternDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function safeIsoForKey(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function getApiKey() {
  const result = await secrets.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!result.SecretString) {
    throw new Error("Marketstack secret has no SecretString.");
  }

  let parsed;
  try {
    parsed = JSON.parse(result.SecretString);
  } catch {
    parsed = null;
  }

  const key =
    parsed?.MARKETSTACK_API_KEY ??
    parsed?.access_key ??
    result.SecretString;

  if (!key || typeof key !== "string") {
    throw new Error("MARKETSTACK_API_KEY was not found in the secret.");
  }

  return key;
}

async function claimRun(mode, marketDate) {
  const runKey = `${marketDate}#${mode}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 24 * 60 * 60;

  try {
    await ddb.send(
      new PutCommand({
        TableName: runsTable,
        Item: {
          runKey,
          marketDate,
          mode,
          status: "STARTED",
          startedAt: new Date().toISOString(),
          expiresAt,
        },
        ConditionExpression: "attribute_not_exists(runKey)",
      })
    );
    return runKey;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return null;
    }
    throw error;
  }
}

async function markRun(runKey, status, details = {}) {
  await ddb.send(
    new UpdateCommand({
      TableName: runsTable,
      Key: { runKey },
      UpdateExpression:
        "SET #status = :status, completedAt = :completedAt, details = :details",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":completedAt": new Date().toISOString(),
        ":details": details,
      },
    })
  );
}

function buildMarketstackUrl(mode, apiKey) {
  const endpoint =
    mode === "MIDDAY"
      ? "https://api.marketstack.com/v2/intraday/latest"
      : "https://api.marketstack.com/v2/eod/latest";

  const params = new URLSearchParams({
    access_key: apiKey,
    symbols: symbols.join(","),
  });

  if (mode === "MIDDAY") {
    params.set("interval", "15min");
  }

  return `${endpoint}?${params.toString()}`;
}

async function fetchMarketstackOnce(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Marketstack returned HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  const payload = JSON.parse(text);

  if (payload?.error) {
    throw new Error(`Marketstack error: ${JSON.stringify(payload.error)}`);
  }

  return { payload, text };
}

async function storeRaw(mode, marketDate, text) {
  const key = `raw/${marketDate}/${mode.toLowerCase()}-${safeIsoForKey()}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: rawBucket,
      Key: key,
      Body: text,
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
      Metadata: {
        mode,
        marketdate: marketDate,
      },
    })
  );

  return key;
}

function priceFromRecord(record) {
  return (
    record?.close ??
    record?.last ??
    record?.marketstack_last ??
    record?.price ??
    null
  );
}

async function updateSignals(mode, data, sourceKey) {
  const now = new Date().toISOString();

  await Promise.all(
    data.map(async (record) => {
      const symbol = String(record.symbol ?? "").toUpperCase();
      if (!symbol) return;

      const marketDate = normalizeDate(record.date);
      const price = priceFromRecord(record);
      const fieldPrefix = mode === "MIDDAY" ? "midday" : "close";

      await ddb.send(
        new UpdateCommand({
          TableName: signalsTable,
          Key: { symbol },
          UpdateExpression: `
            SET #source = :source,
                #mode = :mode,
                #marketDate = :marketDate,
                #price = :price,
                #open = :open,
                #high = :high,
                #low = :low,
                #volume = :volume,
                #updatedAt = :updatedAt
          `,
          ExpressionAttributeNames: {
            "#source": `${fieldPrefix}SourceKey`,
            "#mode": `${fieldPrefix}Mode`,
            "#marketDate": `${fieldPrefix}MarketDate`,
            "#price": `${fieldPrefix}Price`,
            "#open": `${fieldPrefix}Open`,
            "#high": `${fieldPrefix}High`,
            "#low": `${fieldPrefix}Low`,
            "#volume": `${fieldPrefix}Volume`,
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":source": sourceKey,
            ":mode": mode,
            ":marketDate": marketDate,
            ":price": price,
            ":open": record.open ?? null,
            ":high": record.high ?? null,
            ":low": record.low ?? null,
            ":volume": record.volume ?? null,
            ":updatedAt": now,
          },
        })
      );

      if (mode === "CLOSE" && marketDate) {
        await ddb.send(
          new PutCommand({
            TableName: historyTable,
            Item: {
              symbol,
              marketDate,
              open: record.open ?? null,
              high: record.high ?? null,
              low: record.low ?? null,
              close: record.close ?? null,
              adjClose: record.adj_close ?? null,
              volume: record.volume ?? null,
              exchange: record.exchange ?? null,
              sourceKey,
              ingestedAt: now,
            },
          })
        );
      }
    })
  );
}

export const handler = async (event) => {
  const mode = event?.mode;

  if (!["MIDDAY", "CLOSE"].includes(mode)) {
    throw new Error("mode must be MIDDAY or CLOSE");
  }

  if (symbols.length === 0) {
    throw new Error("MARKET_SYMBOLS is empty.");
  }

  const marketDate = easternDateString();
  const runKey = await claimRun(mode, marketDate);

  if (!runKey) {
    console.log(`Skipping duplicate ${mode} ingestion for ${marketDate}.`);
    return {
      skipped: true,
      reason: "ALREADY_RAN_TODAY",
      mode,
      marketDate,
    };
  }

  try {
    const apiKey = await getApiKey();
    const url = buildMarketstackUrl(mode, apiKey);

    // Hard guardrail: one Marketstack fetch in this invocation, no app retry.
    const { payload, text } = await fetchMarketstackOnce(url);

    const sourceKey = await storeRaw(mode, marketDate, text);
    const data = Array.isArray(payload?.data) ? payload.data : [];

    await updateSignals(mode, data, sourceKey);

    await markRun(runKey, "SUCCEEDED", {
      recordCount: data.length,
      sourceKey,
    });

    return {
      ok: true,
      mode,
      marketDate,
      symbolsRequested: symbols.length,
      recordsReceived: data.length,
      sourceKey,
    };
  } catch (error) {
    console.error("Market ingestion failed", error);

    await markRun(runKey, "FAILED", {
      message: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};
