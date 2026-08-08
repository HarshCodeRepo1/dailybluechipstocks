import type { User } from "oidc-client-ts";

const API_BASE_URL = "https://uhwrnj1sn0.execute-api.us-east-1.amazonaws.com";

export async function getMe(user: User) {
  const accessToken = user.access_token;

  const response = await fetch(`${API_BASE_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET /me failed: ${response.status} ${body}`);
  }

  return response.json();
}
