import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

const signalsTable = process.env.MARKET_SIGNALS_TABLE;
const preferencesTable = process.env.USER_PREFERENCES_TABLE;
const newsletterRunsTable = process.env.NEWSLETTER_RUNS_TABLE;
const userPoolId = process.env.USER_POOL_ID;
const fromEmail = process.env.NEWSLETTER_FROM_EMAIL;

const MAX_STOCKS = 10;

const STOCKS = {
  AAPL: { company: "Apple", sector: "Technology" },
  MSFT: { company: "Microsoft", sector: "Technology" },
  NVDA: { company: "NVIDIA", sector: "AI" },
  GOOGL: { company: "Alphabet", sector: "Technology" },
  AMZN: { company: "Amazon", sector: "Consumer" },
  META: { company: "Meta Platforms", sector: "Technology" },
  AVGO: { company: "Broadcom", sector: "AI" },
  ORCL: { company: "Oracle", sector: "Technology" },
  CRM: { company: "Salesforce", sector: "Technology" },
  ADBE: { company: "Adobe", sector: "Technology" },
  LLY: { company: "Eli Lilly", sector: "Pharma" },
  JNJ: { company: "Johnson & Johnson", sector: "Healthcare" },
  PFE: { company: "Pfizer", sector: "Pharma" },
  MRK: { company: "Merck", sector: "Pharma" },
  ABBV: { company: "AbbVie", sector: "Pharma" },
  XOM: { company: "Exxon Mobil", sector: "Energy" },
  CVX: { company: "Chevron", sector: "Energy" },
  COP: { company: "ConocoPhillips", sector: "Energy" },
  JPM: { company: "JPMorgan Chase", sector: "Financials" },
  BAC: { company: "Bank of America", sector: "Financials" },
  GS: { company: "Goldman Sachs", sector: "Financials" },
  V: { company: "Visa", sector: "Financials" },
  MA: { company: "Mastercard", sector: "Financials" },
  WMT: { company: "Walmart", sector: "Consumer" },
  COST: { company: "Costco", sector: "Consumer" },
  HD: { company: "Home Depot", sector: "Consumer" },
  KO: { company: "Coca-Cola", sector: "Consumer" },
  PEP: { company: "PepsiCo", sector: "Consumer" },
  CAT: { company: "Caterpillar", sector: "Industrials" },
  GE: { company: "GE Aerospace", sector: "Industrials" },
};

const DEFAULT_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "AVGO",
  "JPM",
  "V",
  "COST",
];

const SIGNAL_SCORE = {
  "1Y LOW": 100,
  "6M LOW": 90,
  "4M LOW": 80,
  "3M LOW": 70,
  "2M LOW": 60,
  "1M LOW": 50,
  "1W LOW": 40,
  NORMAL: 0,
  "1W HIGH": -40,
  "1M HIGH": -50,
  "2M HIGH": -60,
  "3M HIGH": -70,
  "4M HIGH": -80,
  "6M HIGH": -90,
  "1Y HIGH": -100,
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function claimsFrom(event) {
  return event.requestContext?.authorizer?.jwt?.claims ?? {};
}

function getUserId(event) {
  return claimsFrom(event).sub ?? null;
}

function getGroups(event) {
  const raw = claimsFrom(event)["cognito:groups"];

  if (Array.isArray(raw)) return raw.map(String);

  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // API Gateway can expose list claims as a string instead of JSON.
  }

  return raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function requireAdmin(event) {
  if (!getGroups(event).includes("admin")) {
    const error = new Error("Admin access required");
    error.statusCode = 403;
    throw error;
  }
}

function selectedSymbols(preferences) {
  const explicit = Array.isArray(preferences?.stocks)
    ? preferences.stocks
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((symbol) => STOCKS[symbol])
    : [];

  const unique = [...new Set(explicit)].slice(0, MAX_STOCKS);

  // A subscribed user who did not explicitly select stocks receives
  // the default 10 blue-chip newsletter.
  return unique.length ? unique : DEFAULT_SYMBOLS;
}

function normalizeSignal(item) {
  const signal = String(item.signal ?? "NORMAL").toUpperCase();
  return Object.prototype.hasOwnProperty.call(SIGNAL_SCORE, signal)
    ? signal
    : "NORMAL";
}

function latestPrice(item) {
  const middayDate = item.middayMarketDate ?? "";
  const closeDate = item.closeMarketDate ?? "";

  if (item.middayPrice != null && middayDate >= closeDate) {
    return {
      price: Number(item.middayPrice),
      marketDate: middayDate,
      dataSource: "MIDDAY",
    };
  }

  if (item.closePrice != null) {
    return {
      price: Number(item.closePrice),
      marketDate: closeDate || null,
      dataSource: "CLOSE",
    };
  }

  return { price: null, marketDate: null, dataSource: null };
}

function toStock(item) {
  const meta = STOCKS[item.symbol] ?? {
    company: item.symbol,
    sector: "Other",
  };
  const price = latestPrice(item);
  const signal = normalizeSignal(item);

  return {
    ticker: item.symbol,
    company: meta.company,
    sector: meta.sector,
    price: price.price,
    marketDate: price.marketDate,
    dataSource: price.dataSource,
    signal,
    signalSide:
      item.signalSide ??
      (signal.endsWith("LOW")
        ? "LOW"
        : signal.endsWith("HIGH")
        ? "HIGH"
        : "NORMAL"),
    signalPeriod: item.signalPeriod ?? null,
    rangeLow: item.rangeLow ?? null,
    rangeHigh: item.rangeHigh ?? null,
    score: SIGNAL_SCORE[signal] ?? 0,
  };
}

function rank(stocks) {
  return [...stocks].sort((a, b) => {
    const scoreDifference = b.score - a.score;
    if (scoreDifference !== 0) return scoreDifference;
    return a.ticker.localeCompare(b.ticker);
  });
}

async function loadSignals(symbols) {
  if (!symbols.length) return [];

  const result = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [signalsTable]: {
          Keys: symbols.map((symbol) => ({ symbol })),
          ConsistentRead: false,
        },
      },
    })
  );

  const items = result.Responses?.[signalsTable] ?? [];
  const bySymbol = new Map(items.map((item) => [item.symbol, item]));

  return rank(
    symbols
      .map((symbol) => bySymbol.get(symbol))
      .filter(Boolean)
      .map(toStock)
  ).slice(0, MAX_STOCKS);
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildNewsletter(stocks, recipientLabel = "Investor") {
  const lowCount = stocks.filter((stock) => stock.signalSide === "LOW").length;
  const normalCount = stocks.filter((stock) => stock.signalSide === "NORMAL").length;
  const highCount = stocks.filter((stock) => stock.signalSide === "HIGH").length;

  const marketDate =
    stocks.map((stock) => stock.marketDate).filter(Boolean).sort().at(-1) ??
    new Date().toISOString().slice(0, 10);

  const subject = `DailyBlueChipStocks — ${marketDate}`;

  const rows = stocks
    .map(
      (stock) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e8ecef">
            <strong>${escapeHtml(stock.company)}</strong><br/>
            <span style="color:#6b7280">${escapeHtml(stock.ticker)}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e8ecef">${money(stock.price)}</td>
          <td style="padding:12px;border-bottom:1px solid #e8ecef">
            <strong>${escapeHtml(stock.signal)}</strong>
          </td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<body style="margin:0;background:#f5f8f6;font-family:Arial,sans-serif;color:#10213d">
  <div style="max-width:680px;margin:0 auto;padding:28px 18px">
    <div style="background:#ffffff;border:1px solid #e2e8e5;border-radius:16px;padding:26px">
      <div style="font-size:22px;font-weight:800">DailyBlueChipStocks</div>
      <div style="color:#6b7280;margin-top:4px">Simple. Clear. Better investing.</div>

      <h1 style="font-size:26px;margin:28px 0 6px">Your daily blue-chip brief</h1>
      <p style="color:#526076;margin-top:0">
        Hi ${escapeHtml(recipientLabel)} — here are the stocks you asked us to watch.
      </p>

      <div style="background:#eefaf2;border-radius:12px;padding:14px 16px;margin:20px 0">
        <strong>${stocks.length} stocks</strong> ·
        ${lowCount} low · ${normalCount} normal · ${highCount} high
      </div>

      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:12px">
            <th style="padding:12px;border-bottom:1px solid #dfe6e2">COMPANY</th>
            <th style="padding:12px;border-bottom:1px solid #dfe6e2">PRICE</th>
            <th style="padding:12px;border-bottom:1px solid #dfe6e2">SIGNAL</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="font-size:12px;color:#7a8494;margin-top:28px">
        Educational information only. Not financial advice.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    "DailyBlueChipStocks",
    `Market date: ${marketDate}`,
    "",
    `${stocks.length} stocks | ${lowCount} low | ${normalCount} normal | ${highCount} high`,
    "",
    ...stocks.map(
      (stock) =>
        `${stock.ticker} | ${money(stock.price)} | ${stock.signal}`
    ),
    "",
    "Educational information only. Not financial advice.",
  ].join("\n");

  return {
    subject,
    marketDate,
    lowCount,
    normalCount,
    highCount,
    html,
    text,
  };
}

async function getPreferences(userId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: preferencesTable,
      Key: { userId },
      ConsistentRead: false,
    })
  );

  return result.Item ?? null;
}

function emailAttribute(user) {
  return user?.Attributes?.find((attribute) => attribute.Name === "email")?.Value ?? null;
}

function subAttribute(user) {
  return user?.Attributes?.find((attribute) => attribute.Name === "sub")?.Value ?? null;
}

async function findEmailBySub(sub) {
  const result = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `sub = "${String(sub).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`,
      Limit: 1,
    })
  );

  return emailAttribute(result.Users?.[0]);
}

async function loadAllUserEmails() {
  const bySub = new Map();
  let paginationToken;

  do {
    const result = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
        Limit: 60,
      })
    );

    for (const user of result.Users ?? []) {
      const sub = subAttribute(user);
      const email = emailAttribute(user);

      if (sub && email) {
        bySub.set(sub, email);
      }
    }

    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return bySub;
}

async function sendNewsletter(to, newsletter) {
  if (!fromEmail) {
    throw new Error("NEWSLETTER_FROM_EMAIL is not configured");
  }

  const result = await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: newsletter.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: newsletter.html,
              Charset: "UTF-8",
            },
            Text: {
              Data: newsletter.text,
              Charset: "UTF-8",
            },
          },
        },
      },
    })
  );

  return result.MessageId;
}

async function adminPreview(event) {
  requireAdmin(event);

  const userId = getUserId(event);
  if (!userId) return jsonResponse(401, { message: "Unauthorized" });

  const preferences = await getPreferences(userId);
  const symbols = selectedSymbols(preferences);
  const stocks = await loadSignals(symbols);
  const newsletter = buildNewsletter(stocks, "Admin");

  return jsonResponse(200, {
    mode: "PREVIEW",
    recipientCount: 0,
    usedDefaultStocks:
      !Array.isArray(preferences?.stocks) || preferences.stocks.length === 0,
    selectedSymbols: symbols,
    stocks,
    newsletter,
  });
}

async function adminTest(event) {
  requireAdmin(event);

  const userId = getUserId(event);
  if (!userId) return jsonResponse(401, { message: "Unauthorized" });

  // Recipient cannot be supplied by request. It is always the authenticated
  // admin's own Cognito email address.
  const adminEmail = await findEmailBySub(userId);

  if (!adminEmail) {
    return jsonResponse(400, {
      message: "No Cognito email address was found for the authenticated admin",
    });
  }

  const preferences = await getPreferences(userId);
  const symbols = selectedSymbols(preferences);
  const stocks = await loadSignals(symbols);
  const newsletter = buildNewsletter(stocks, "Admin");
  const messageId = await sendNewsletter(adminEmail, newsletter);

  return jsonResponse(200, {
    mode: "TEST",
    sent: true,
    recipient: adminEmail,
    recipientCount: 1,
    messageId,
    usedDefaultStocks:
      !Array.isArray(preferences?.stocks) || preferences.stocks.length === 0,
    selectedSymbols: symbols,
  });
}

function runDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function claimProductionRun(date) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  await ddb.send(
    new PutCommand({
      TableName: newsletterRunsTable,
      Item: {
        runKey: `PRODUCTION#${date}`,
        createdAt: new Date().toISOString(),
        expiresAt: nowSeconds + 60 * 60 * 24 * 35,
      },
      ConditionExpression: "attribute_not_exists(runKey)",
    })
  );
}

async function productionSend() {
  const date = runDate();

  try {
    await claimProductionRun(date);
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return {
        mode: "PRODUCTION",
        skipped: true,
        reason: "ALREADY_SENT_TODAY",
        date,
      };
    }
    throw error;
  }

  const subscribers = [];
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: preferencesTable,
        FilterExpression: "newsletterEnabled = :enabled",
        ExpressionAttributeValues: {
          ":enabled": true,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    subscribers.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  if (!subscribers.length) {
    return {
      mode: "PRODUCTION",
      sent: 0,
      skippedUsers: 0,
      date,
    };
  }

  const emailBySub = await loadAllUserEmails();

  const symbolsNeeded = new Set();
  for (const subscriber of subscribers) {
    for (const symbol of selectedSymbols(subscriber)) {
      symbolsNeeded.add(symbol);
    }
  }

  const allSignals = await loadSignals([...symbolsNeeded]);
  const signalByTicker = new Map(allSignals.map((stock) => [stock.ticker, stock]));

  let sent = 0;
  let skippedUsers = 0;
  const failures = [];

  for (const subscriber of subscribers) {
    const email = emailBySub.get(subscriber.userId);

    if (!email) {
      skippedUsers += 1;
      continue;
    }

    const symbols = selectedSymbols(subscriber);
    const stocks = rank(
      symbols
        .map((symbol) => signalByTicker.get(symbol))
        .filter(Boolean)
    ).slice(0, MAX_STOCKS);

    try {
      const newsletter = buildNewsletter(stocks);
      await sendNewsletter(email, newsletter);
      sent += 1;
    } catch (error) {
      failures.push({
        userId: subscriber.userId,
        error: error?.message ?? String(error),
      });
    }
  }

  return {
    mode: "PRODUCTION",
    date,
    subscriberCount: subscribers.length,
    sent,
    skippedUsers,
    failureCount: failures.length,
    failures,
  };
}

export const handler = async (event) => {
  try {
    if (event?.mode === "PRODUCTION") {
      return await productionSend();
    }

    if (event.routeKey === "POST /admin/newsletter/preview") {
      return await adminPreview(event);
    }

    if (event.routeKey === "POST /admin/newsletter/test") {
      return await adminTest(event);
    }

    return jsonResponse(404, { message: "Not found" });
  } catch (error) {
    console.error("Newsletter error", error);

    return jsonResponse(error?.statusCode ?? 500, {
      message: error?.message ?? "Newsletter operation failed",
    });
  }
};
