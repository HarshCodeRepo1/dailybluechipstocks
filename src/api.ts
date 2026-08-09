import type { User } from "oidc-client-ts";
import type { Stock } from "./types/market";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "https://uhwrnj1sn0.execute-api.us-east-1.amazonaws.com";

export type UserPreferences = {
  userId?: string;
  sectors: string[];
  stocks: string[];
  alertPeriods: string[];
  newsletterEnabled: boolean;
  exists?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

async function apiRequest<T>(
  user: User,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${user.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function getMe(user: User) {
  return apiRequest<{
    authenticated: boolean;
    userId: string;
    username?: string;
    tokenUse?: string;
  }>(user, "/me");
}

export async function getPreferences(user: User) {
  return apiRequest<UserPreferences>(user, "/preferences");
}

export async function savePreferences(
  user: User,
  preferences: Pick<
    UserPreferences,
    "sectors" | "stocks" | "alertPeriods" | "newsletterEnabled"
  >
) {
  return apiRequest<UserPreferences>(user, "/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

export async function getMarket(user: User) {
  return apiRequest<{
    personalized: boolean;
    maxStocks: number;
    requestedSymbols: string[];
    stocks: Stock[];
  }>(user, "/market");
}
