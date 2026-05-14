// ─── Google OAuth helpers ────────────────────────────────────────────────────
// Centralized env reads + URL builders so the start + callback routes stay
// thin. Tokens are exchanged + persisted via /api/google/oauth/callback.

export const GOOGLE_SCOPES = [
  // Minimum scope to insert / update events on a user's primary calendar.
  // Use calendar.events (not calendar) so we can't read/modify their other calendars.
  "https://www.googleapis.com/auth/calendar.events",
  // We need this to read calendar metadata (timezone, name) when listing.
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleEnv = {
  clientId:     string;
  clientSecret: string;
  redirectUri:  string;
};

export function getGoogleEnv(originHeader?: string | null): GoogleEnv | null {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  // The redirect URI is derived from the request origin so it works in
  // dev + Vercel previews + prod without hard-coding. Google's console must
  // have the exact URI whitelisted for each environment you use.
  const origin       = originHeader ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
  if (!clientId || !clientSecret || !origin) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/api/google/oauth/callback`,
  };
}

export function buildAuthUrl(env: GoogleEnv, state: string): string {
  const params = new URLSearchParams({
    client_id:     env.clientId,
    redirect_uri:  env.redirectUri,
    response_type: "code",
    scope:         GOOGLE_SCOPES,
    access_type:   "offline",     // request refresh_token
    prompt:        "consent",     // force refresh_token on every consent
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(env: GoogleEnv, code: string): Promise<{
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  scope:         string;
  token_type:    string;
}> {
  const body = new URLSearchParams({
    code,
    client_id:     env.clientId,
    client_secret: env.clientSecret,
    redirect_uri:  env.redirectUri,
    grant_type:    "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errText}`);
  }
  return res.json();
}

export async function refreshAccessToken(env: GoogleEnv, refreshToken: string): Promise<{
  access_token: string;
  expires_in:   number;
  scope:        string;
  token_type:   string;
}> {
  const body = new URLSearchParams({
    client_id:     env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type:    "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${errText}`);
  }
  return res.json();
}

export async function revokeToken(token: string): Promise<void> {
  // Best-effort revoke — if Google returns an error, we still delete our row.
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch { /* ignore */ }
}
