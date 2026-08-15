/**
 * Server-only Google OAuth2 + Calendar API access for AHOY's calendar sync.
 *
 * - Refresh tokens are encrypted (AES-GCM) before being stored in
 *   `google_accounts` and are never sent to the browser.
 * - Access tokens are cached in the same row and refreshed on demand.
 * - This module never touches the Discord bot token.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/* ------------------------------------------------------------------ */
/* Encryption — same AES-GCM pattern as discord.server.ts's session key */
/* ------------------------------------------------------------------ */

async function cryptoKey(): Promise<CryptoKey> {
  const secret = env("GOOGLE_CLIENT_SECRET");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ahoy:google:${secret}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cryptoKey();
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(cipher)}`;
}

export async function decryptToken(value: string): Promise<string> {
  const [ivPart, dataPart] = value.split(".");
  if (!ivPart || !dataPart) throw new Error("Malformed stored token.");
  const key = await cryptoKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return new TextDecoder().decode(plain);
}

/* ------------------------------------------------------------------ */
/* OAuth state — carries the guildId through the Google redirect       */
/* ------------------------------------------------------------------ */

const STATE_TTL_MS = 10 * 60 * 1000;

export async function sealGoogleState(guildId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cryptoKey();
  const payload = JSON.stringify({
    guildId,
    nonce: crypto.randomUUID(),
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(cipher)}`;
}

export async function openGoogleState(value: string): Promise<{ guildId: string } | null> {
  try {
    const [ivPart, dataPart] = value.split(".");
    if (!ivPart || !dataPart) return null;
    const key = await cryptoKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(dataPart),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as {
      guildId: string;
      expiresAt: number;
    };
    if (!parsed.guildId || parsed.expiresAt < Date.now()) return null;
    return { guildId: parsed.guildId };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* OAuth2                                                              */
/* ------------------------------------------------------------------ */

export function googleAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent select_account", // always show the account picker
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    console.error("Google token exchange failed", response.status, await response.text());
    throw new Error("Google sign-in failed.");
  }
  return (await response.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    console.error("Google token refresh failed", response.status, await response.text());
    throw new Error(
      "This Google account's access has expired or been revoked. Please reconnect it.",
    );
  }
  return (await response.json()) as TokenResponse;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch(GOOGLE_USERINFO, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not read the Google account's email address.");
  const body = (await response.json()) as { email?: string };
  if (!body.email) throw new Error("Google did not return an email address for this account.");
  return body.email;
}

/* ------------------------------------------------------------------ */
/* Supabase-backed token cache                                         */
/* ------------------------------------------------------------------ */

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Returns a valid access token for this Google account, refreshing if needed. */
export async function getValidAccessToken(
  supabaseAdmin: Admin,
  accountId: string,
): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from("google_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !row) throw new Error("That Google account is no longer connected.");
  const r = row as Record<string, unknown>;

  const expiresAt = r["access_token_expires_at"]
    ? new Date(String(r["access_token_expires_at"])).getTime()
    : 0;
  const cached = r["access_token"] as string | null;
  if (cached && expiresAt > Date.now() + 60_000) return cached;

  const refreshToken = await decryptToken(r["encrypted_refresh_token"] as string);
  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("google_accounts")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  return refreshed.access_token;
}

/* ------------------------------------------------------------------ */
/* Calendar API                                                        */
/* ------------------------------------------------------------------ */

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
};

export async function listGoogleCalendars(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  const response = await fetch(`${CALENDAR_API}/users/me/calendarList?maxResults=100`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error("Google calendarList failed", response.status, await response.text());
    throw new Error("Could not read this Google account's calendars.");
  }
  const body = (await response.json()) as {
    items?: Array<{ id: string; summary?: string; primary?: boolean }>;
  };
  return (body.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    primary: Boolean(item.primary),
  }));
}

/** One event as returned by the Calendar API, shaped for calendar.server.ts. */
export type GoogleParsedEvent = {
  externalEventId: string;
  parentExternalEventId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  timezone: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;
  status: "confirmed" | "cancelled";
  externalUpdatedAt: string | null;
};

const WINDOW_PAST_MS = 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Fetch events for one calendar. `singleEvents=true` asks Google to expand
 * recurring events into individual occurrences itself, so unlike the iCal
 * path there is no RRULE math to do here.
 */
export async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
): Promise<GoogleParsedEvent[]> {
  const timeMin = new Date(Date.now() - WINDOW_PAST_MS).toISOString();
  const timeMax = new Date(Date.now() + WINDOW_FUTURE_MS).toISOString();
  const out: GoogleParsedEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      showDeleted: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      console.error("Google events.list failed", response.status, await response.text());
      throw new Error("Could not read events from this Google calendar.");
    }
    const body = (await response.json()) as {
      items?: Array<{
        id: string;
        recurringEventId?: string;
        summary?: string;
        description?: string;
        location?: string;
        status?: string;
        updated?: string;
        start?: { date?: string; dateTime?: string; timeZone?: string };
        end?: { date?: string; dateTime?: string; timeZone?: string };
        recurrence?: string[];
      }>;
      nextPageToken?: string;
    };

    for (const item of body.items ?? []) {
      if (!item.start) continue;
      const isAllDay = Boolean(item.start.date && !item.start.dateTime);
      const start = new Date(item.start.dateTime ?? `${item.start.date}T00:00:00Z`);
      const end = item.end
        ? new Date(item.end.dateTime ?? `${item.end.date}T00:00:00Z`)
        : null;

      out.push({
        externalEventId: item.id,
        parentExternalEventId: item.recurringEventId ?? null,
        title: (item.summary || "Untitled event").slice(0, 300),
        description: item.description ? item.description.slice(0, 4000) : null,
        location: item.location ? item.location.slice(0, 300) : null,
        start,
        end,
        timezone: item.start.timeZone ?? "UTC",
        isAllDay,
        isRecurring: Boolean(item.recurringEventId || (item.recurrence && item.recurrence.length)),
        recurrenceRule: item.recurrence?.[0] ?? null,
        status: item.status === "cancelled" ? "cancelled" : "confirmed",
        externalUpdatedAt: item.updated ?? null,
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return out;
}
