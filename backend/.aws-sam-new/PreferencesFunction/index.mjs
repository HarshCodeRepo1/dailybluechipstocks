import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.USER_PREFERENCES_TABLE;

const ALLOWED_ALERT_PERIODS = new Set(["1M", "2M", "3M", "4M", "6M", "1Y"]);

const DEFAULT_PREFERENCES = {
  sectors: [],
  stocks: [],
  alertPeriods: ["1M", "3M", "6M"],
  newsletterEnabled: true,
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

const getUserId = (event) =>
  event.requestContext?.authorizer?.jwt?.claims?.sub ?? null;

const parseBody = (event) => {
  if (!event.body) return {};
  return JSON.parse(event.body);
};

const uniqueStrings = (values, maxItems, maxLength) => {
  if (!Array.isArray(values)) {
    throw new Error("Expected an array");
  }

  const cleaned = values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (cleaned.length > maxItems) {
    throw new Error(`Too many values. Maximum is ${maxItems}.`);
  }

  if (cleaned.some((value) => value.length > maxLength)) {
    throw new Error(`A value exceeds the maximum length of ${maxLength}.`);
  }

  return [...new Set(cleaned)];
};

const validatePreferences = (body) => {
  const sectors = uniqueStrings(body.sectors ?? [], 20, 50);
  const stocks = uniqueStrings(body.stocks ?? [], 100, 10).map((ticker) =>
    ticker.toUpperCase()
  );

  if (stocks.some((ticker) => !/^[A-Z0-9.-]{1,10}$/.test(ticker))) {
    throw new Error("One or more stock tickers are invalid.");
  }

  const alertPeriods = uniqueStrings(
    body.alertPeriods ?? DEFAULT_PREFERENCES.alertPeriods,
    6,
    2
  );

  if (alertPeriods.some((period) => !ALLOWED_ALERT_PERIODS.has(period))) {
    throw new Error("One or more alert periods are invalid.");
  }

  const newsletterEnabled =
    body.newsletterEnabled === undefined
      ? DEFAULT_PREFERENCES.newsletterEnabled
      : body.newsletterEnabled;

  if (typeof newsletterEnabled !== "boolean") {
    throw new Error("newsletterEnabled must be true or false.");
  }

  return {
    sectors,
    stocks,
    alertPeriods,
    newsletterEnabled,
  };
};

const getPreferences = async (userId) => {
  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { userId },
      ConsistentRead: false,
    })
  );

  if (!result.Item) {
    return {
      userId,
      ...DEFAULT_PREFERENCES,
      exists: false,
    };
  }

  return {
    ...result.Item,
    exists: true,
  };
};

const putPreferences = async (userId, body) => {
  const preferences = validatePreferences(body);
  const now = new Date().toISOString();

  const result = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { userId },
      UpdateExpression: `
        SET sectors = :sectors,
            stocks = :stocks,
            alertPeriods = :alertPeriods,
            newsletterEnabled = :newsletterEnabled,
            createdAt = if_not_exists(createdAt, :createdAt),
            updatedAt = :updatedAt
      `,
      ExpressionAttributeValues: {
        ":sectors": preferences.sectors,
        ":stocks": preferences.stocks,
        ":alertPeriods": preferences.alertPeriods,
        ":newsletterEnabled": preferences.newsletterEnabled,
        ":createdAt": now,
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
};

export const handler = async (event) => {
  const userId = getUserId(event);

  if (!userId) {
    return response(401, { message: "Unauthorized" });
  }

  try {
    const method = event.requestContext?.http?.method;

    if (method === "GET") {
      const preferences = await getPreferences(userId);
      return response(200, preferences);
    }

    if (method === "PUT") {
      const body = parseBody(event);
      const preferences = await putPreferences(userId, body);
      return response(200, preferences);
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return response(400, { message: "Request body must be valid JSON." });
    }

    if (error instanceof Error && !error.name?.includes("Dynamo")) {
      return response(400, { message: error.message });
    }

    console.error("Preferences API error", error);
    return response(500, { message: "Internal server error" });
  }
};
