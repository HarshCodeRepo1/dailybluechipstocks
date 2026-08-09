import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const secrets = new SecretsManagerClient({});
const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const secretId = process.env.MARKETSTACK_SECRET_ID;
const symbols = (process.env.MARKET_SYMBOLS ?? "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

const rawBucket = process.env.MARKET_RAW_BUCKET;
const signalsTable = process.env.MARKET_SIGNALS_TABLE;
const historyTable = process.env.MARKET_HISTORY_TABLE;
const runsTable = process.env.MARKET_INGESTION_RUNS_TABLE;
const thresholdPercent = Number(process.env.SIGNAL_THRESHOLD_PERCENT ?? "1");

const WINDOWS = [
  { label: "1Y", days: 365 },
  { label: "6M", days: 180 },
  { label: "4M", days: 120 },
  { label: "3M", days: 90 },
  { label: "2M", days: 60 },
  { label: "1M", days: 30 },
  { label: "1W", days: 7 },
];

function easternDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function safeIsoForKey(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : null;
}

async function getApiKey() {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!result.SecretString) throw new Error("Marketstack secret has no SecretString.");

  let parsed;
  try { parsed = JSON.parse(result.SecretString); } catch { parsed = null; }

  const key = parsed?.MARKETSTACK_API_KEY ?? parsed?.access_key ?? result.SecretString;
  if (!key || typeof key !== "string") throw new Error("MARKETSTACK_API_KEY was not found.");
  return key;
}

async function claimRun(mode, marketDate) {
  const runKey = `${marketDate}#${mode}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 24 * 60 * 60;

  try {
    await ddb.send(new PutCommand({
      TableName: runsTable,
      Item: { runKey, marketDate, mode, status: "STARTED", startedAt: new Date().toISOString(), expiresAt },
      ConditionExpression: "attribute_not_exists(runKey)",
    }));
    return runKey;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") return null;
    throw error;
  }
}

async function markRun(runKey, status, details = {}) {
  await ddb.send(new UpdateCommand({
    TableName: runsTable,
    Key: { runKey },
    UpdateExpression: "SET #status=:status, completedAt=:at, details=:details",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": status, ":at": new Date().toISOString(), ":details": details },
  }));
}

function buildUrl(mode, apiKey) {
  const endpoint = mode === "MIDDAY"
    ? "https://api.marketstack.com/v2/intraday/latest"
    : "https://api.marketstack.com/v2/eod/latest";

  const params = new URLSearchParams({ access_key: apiKey, symbols: symbols.join(",") });
  if (mode === "MIDDAY") params.set("interval", "15min");
  return `${endpoint}?${params.toString()}`;
}

async function fetchOnce(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Marketstack HTTP ${response.status}: ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  if (payload?.error) throw new Error(`Marketstack error: ${JSON.stringify(payload.error)}`);
  return { payload, text };
}

async function storeRaw(mode, marketDate, text) {
  const key = `raw/${marketDate}/${mode.toLowerCase()}-${safeIsoForKey()}.json`;
  await s3.send(new PutObjectCommand({
    Bucket: rawBucket, Key: key, Body: text, ContentType: "application/json",
    ServerSideEncryption: "AES256", Metadata: { mode, marketdate: marketDate },
  }));
  return key;
}

function currentPrice(item) {
  const middayDate = item.middayMarketDate ?? "";
  const closeDate = item.closeMarketDate ?? "";
  if (item.middayPrice != null && middayDate >= closeDate) return Number(item.middayPrice);
  return item.closePrice == null ? null : Number(item.closePrice);
}

function classify(price, history) {
  if (price == null || !history.length) return { signal: "NORMAL", side: "NORMAL", period: null };
  const sortedDates = history.map((x) => x.marketDate).sort();
  const latestDate = sortedDates.at(-1);
  const earliestDate = sortedDates[0];
  const threshold = thresholdPercent / 100;

  for (const w of WINDOWS) {
    const start = addDays(latestDate, -w.days);
    if (earliestDate > start) continue;

    const closes = history
      .filter((x) => x.marketDate >= start)
      .map((x) => Number(x.adjClose ?? x.close))
      .filter(Number.isFinite);

    if (!closes.length) continue;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const nearLow = price <= min * (1 + threshold);
    const nearHigh = price >= max * (1 - threshold);

    if (nearLow && !nearHigh) return { signal: `${w.label} LOW`, side: "LOW", period: w.label, low: min, high: max };
    if (nearHigh && !nearLow) return { signal: `${w.label} HIGH`, side: "HIGH", period: w.label, low: min, high: max };

    if (nearLow && nearHigh) {
      const dl = Math.abs(price - min) / Math.max(min, 0.0001);
      const dh = Math.abs(max - price) / Math.max(max, 0.0001);
      return dl <= dh
        ? { signal: `${w.label} LOW`, side: "LOW", period: w.label, low: min, high: max }
        : { signal: `${w.label} HIGH`, side: "HIGH", period: w.label, low: min, high: max };
    }
  }

  return { signal: "NORMAL", side: "NORMAL", period: null };
}

async function recomputeSignals() {
  const latestResult = await ddb.send(new BatchGetCommand({
    RequestItems: { [signalsTable]: { Keys: symbols.map((symbol) => ({ symbol })) } },
  }));
  const latest = latestResult.Responses?.[signalsTable] ?? [];
  const bySymbol = new Map(latest.map((x) => [x.symbol, x]));

  await Promise.all(symbols.map(async (symbol) => {
    const item = bySymbol.get(symbol);
    if (!item) return;

    const historyResult = await ddb.send(new QueryCommand({
      TableName: historyTable,
      KeyConditionExpression: "symbol=:symbol AND marketDate>=:from",
      ExpressionAttributeValues: { ":symbol": symbol, ":from": addDays(easternDateString(), -370) },
    }));

    const c = classify(currentPrice(item), historyResult.Items ?? []);
    await ddb.send(new UpdateCommand({
      TableName: signalsTable,
      Key: { symbol },
      UpdateExpression: "SET #signal=:signal, signalSide=:side, signalPeriod=:period, rangeLow=:low, rangeHigh=:high, signalThresholdPercent=:threshold, signalCalculatedAt=:at",
      ExpressionAttributeNames: { "#signal": "signal" },
      ExpressionAttributeValues: {
        ":signal": c.signal, ":side": c.side, ":period": c.period,
        ":low": c.low ?? null, ":high": c.high ?? null,
        ":threshold": thresholdPercent, ":at": new Date().toISOString(),
      },
    }));
  }));
}

async function updateLatest(mode, data, sourceKey) {
  const now = new Date().toISOString();

  await Promise.all(data.map(async (record) => {
    const symbol = String(record.symbol ?? "").toUpperCase();
    if (!symbol) return;
    const marketDate = normalizeDate(record.date);
    const prefix = mode === "MIDDAY" ? "midday" : "close";
    const price = record.close ?? record.last ?? record.marketstack_last ?? record.price ?? null;

    await ddb.send(new UpdateCommand({
      TableName: signalsTable,
      Key: { symbol },
      UpdateExpression: "SET #price=:price,#date=:date,#open=:open,#high=:high,#low=:low,#volume=:volume,#source=:source,updatedAt=:at",
      ExpressionAttributeNames: {
        "#price": `${prefix}Price`, "#date": `${prefix}MarketDate`,
        "#open": `${prefix}Open`, "#high": `${prefix}High`,
        "#low": `${prefix}Low`, "#volume": `${prefix}Volume`,
        "#source": `${prefix}SourceKey`,
      },
      ExpressionAttributeValues: {
        ":price": price, ":date": marketDate, ":open": record.open ?? null,
        ":high": record.high ?? null, ":low": record.low ?? null,
        ":volume": record.volume ?? null, ":source": sourceKey, ":at": now,
      },
    }));

    if (mode === "CLOSE" && marketDate) {
      await ddb.send(new PutCommand({
        TableName: historyTable,
        Item: {
          symbol, marketDate, open: record.open ?? null, high: record.high ?? null,
          low: record.low ?? null, close: record.close ?? null,
          adjClose: record.adj_close ?? null, volume: record.volume ?? null,
          exchange: record.exchange ?? null, sourceKey, ingestedAt: now,
        },
      }));
    }
  }));
}

export const handler = async (event) => {
  const mode = event?.mode;
  if (!["MIDDAY", "CLOSE"].includes(mode)) throw new Error("mode must be MIDDAY or CLOSE");

  const marketDate = easternDateString();
  const runKey = await claimRun(mode, marketDate);
  if (!runKey) return { skipped: true, reason: "ALREADY_RAN_TODAY", mode, marketDate };

  try {
    const apiKey = await getApiKey();
    const { payload, text } = await fetchOnce(buildUrl(mode, apiKey));
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const sourceKey = await storeRaw(mode, marketDate, text);
    await updateLatest(mode, data, sourceKey);
    await recomputeSignals();
    await markRun(runKey, "SUCCEEDED", { recordCount: data.length, sourceKey });

    return { ok: true, mode, marketDate, symbolsRequested: symbols.length, recordsReceived: data.length, sourceKey };
  } catch (error) {
    await markRun(runKey, "FAILED", { message: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};
