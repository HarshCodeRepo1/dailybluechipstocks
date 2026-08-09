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

export type NewsletterSelection = {
  maxStocks: number;
  stockCount: number;
  lowCount: number;
  normalCount: number;
  highCount: number;
  stocks: Stock[];
};

export type MarketResponse = {
  personalized: boolean;
  defaultWatchlist?: boolean;
  maxStocks: number;
  candidateCount: number;
  returnedCount: number;
  requestedSymbols: string[];
  stocks: Stock[];
  newsletter: NewsletterSelection;
};

async function publicApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${path} failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

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
    throw new Error(
      `${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`
    );
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
  // UI should stop at 10, but keep a backend-safe payload too.
  const safePreferences = {
    ...preferences,
    stocks: [...new Set(preferences.stocks)].slice(0, 10),
  };

  return apiRequest<UserPreferences>(user, "/preferences", {
    method: "PUT",
    body: JSON.stringify(safePreferences),
  });
}

export async function getMarket(user: User) {
  return apiRequest<MarketResponse>(user, "/market");
}

export async function getPublicMarket() {
  return publicApiRequest<MarketResponse>("/market/public");
}

export async function previewAdminNewsletter(user: User) {
  return apiRequest(user, "/admin/newsletter/preview", {
    method: "POST",
  });
}

export async function sendAdminTestNewsletter(user: User) {
  return apiRequest(user, "/admin/newsletter/test", {
    method: "POST",
  });
}
