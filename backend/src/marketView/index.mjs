import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const signalsTable = process.env.MARKET_SIGNALS_TABLE;
const preferencesTable = process.env.USER_PREFERENCES_TABLE;

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

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getUserId(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.sub ?? null;
}

function chooseSymbols(preferences) {
  const selected = Array.isArray(preferences?.stocks)
    ? preferences.stocks
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((symbol) => STOCKS[symbol])
    : [];

  // Personal watchlist rule:
  // - explicit selections only
  // - never expand from sectors
  // - hard maximum of 10
  // - if no explicit selections, show the default 10 blue chips
  const explicit = [...new Set(selected)].slice(0, 10);
  return explicit.length ? explicit : DEFAULT_SYMBOLS;
}

function normalizeSignal(item) {
  const signal = String(item.signal ?? "NORMAL").toUpperCase();
  return Object.prototype.hasOwnProperty.call(SIGNAL_SCORE, signal)
    ? signal
    : "NORMAL";
}

function getTone(signal) {
  if (signal.endsWith("LOW")) return "positive";
  if (signal.endsWith("HIGH")) return "negative";
  return "neutral";
}

function getLatestPrice(item) {
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

  const latest = getLatestPrice(item);
  const signal = normalizeSignal(item);

  return {
    ticker: item.symbol,
    company: meta.company,
    sector: meta.sector,
    price: latest.price,
    marketDate: latest.marketDate,
    updatedAt: item.updatedAt ?? null,
    dataSource: latest.dataSource,
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
    signalThresholdPercent: item.signalThresholdPercent ?? 1,
    signalCalculatedAt: item.signalCalculatedAt ?? null,
    score: SIGNAL_SCORE[signal] ?? 0,
    tone: getTone(signal),
    change: null,
  };
}

function rankStocks(stocks) {
  return [...stocks].sort((a, b) => {
    const signalDifference = b.score - a.score;
    if (signalDifference !== 0) return signalDifference;
    return a.ticker.localeCompare(b.ticker);
  });
}

function buildNewsletterSelection(rankedStocks) {
  const selected = rankedStocks.slice(0, 10);

  return {
    maxStocks: 10,
    stockCount: selected.length,
    lowCount: selected.filter((s) => s.signalSide === "LOW").length,
    normalCount: selected.filter((s) => s.signalSide === "NORMAL").length,
    highCount: selected.filter((s) => s.signalSide === "HIGH").length,
    stocks: selected,
  };
}

async function getSignals(symbols) {
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

  const records = result.Responses?.[signalsTable] ?? [];
  const bySymbol = new Map(records.map((item) => [item.symbol, item]));

  return rankStocks(
    symbols
      .map((symbol) => bySymbol.get(symbol))
      .filter(Boolean)
      .map(toStock)
  ).slice(0, 10);
}

export const handler = async (event) => {
  const userId = getUserId(event);
  const isPublicRoute = event.routeKey === "GET /market/public";

  // Public landing page always receives the 10 default blue chips.
  if (isPublicRoute) {
    const stocks = await getSignals(DEFAULT_SYMBOLS);

    return response(200, {
      personalized: false,
      defaultWatchlist: true,
      maxStocks: 10,
      candidateCount: DEFAULT_SYMBOLS.length,
      returnedCount: stocks.length,
      requestedSymbols: DEFAULT_SYMBOLS,
      stocks,
      newsletter: buildNewsletterSelection(stocks),
    });
  }

  if (!userId) {
    return response(401, { message: "Unauthorized" });
  }

  const prefResult = await ddb.send(
    new GetCommand({
      TableName: preferencesTable,
      Key: { userId },
      ConsistentRead: false,
    })
  );

  const preferences = prefResult.Item ?? null;
  const symbols = chooseSymbols(preferences);
  const stocks = await getSignals(symbols);

  return response(200, {
    personalized: true,
    defaultWatchlist:
      !Array.isArray(preferences?.stocks) || preferences.stocks.length === 0,
    maxStocks: 10,
    candidateCount: symbols.length,
    returnedCount: stocks.length,
    requestedSymbols: symbols,
    stocks,
    newsletter: buildNewsletterSelection(stocks),
  });
};
