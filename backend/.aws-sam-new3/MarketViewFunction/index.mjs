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
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN",
  "META", "AVGO", "JPM", "V", "COST"
];

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
  if (!preferences) return DEFAULT_SYMBOLS;

  const selected = Array.isArray(preferences.stocks)
    ? preferences.stocks.map((s) => String(s).toUpperCase())
    : [];

  const sectors = new Set(
    Array.isArray(preferences.sectors) ? preferences.sectors : []
  );

  const sectorMatches = Object.entries(STOCKS)
    .filter(([, meta]) => sectors.has(meta.sector))
    .map(([symbol]) => symbol);

  // Specific watchlist stocks come first; sector matches fill remaining slots.
  return [...new Set([...selected, ...sectorMatches, ...DEFAULT_SYMBOLS])]
    .filter((symbol) => STOCKS[symbol])
    .slice(0, 10);
}

function toStock(item) {
  const meta = STOCKS[item.symbol] ?? {
    company: item.symbol,
    sector: "Other",
  };

  const price = item.middayPrice ?? item.closePrice ?? null;
  const marketDate = item.middayMarketDate ?? item.closeMarketDate ?? null;

  return {
    ticker: item.symbol,
    company: meta.company,
    sector: meta.sector,
    price,
    marketDate,
    updatedAt: item.updatedAt ?? null,
    dataSource: item.middayPrice != null ? "MIDDAY" : "CLOSE",
    // Real low-period signals will be populated by the historical backfill step.
    signal: "Cached market price",
    score: 0,
    tone: "neutral",
    change: null,
  };
}

export const handler = async (event) => {
  const userId = getUserId(event);

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

  const symbols = chooseSymbols(prefResult.Item);

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

  const stocks = symbols
    .map((symbol) => bySymbol.get(symbol))
    .filter(Boolean)
    .map(toStock);

  return response(200, {
    personalized: true,
    maxStocks: 10,
    requestedSymbols: symbols,
    stocks,
  });
};
