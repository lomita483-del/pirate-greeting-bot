/**
 * Server-only Discord OAuth2 + session handling for the AHOY Control Center.
 *
 * - The Discord bot token is NEVER used here and never leaves the bot process.
 * - The user's OAuth access token is stored in an encrypted, httpOnly cookie.
 * - Every privileged request re-verifies the user's Discord permissions with
 *   Discord itself. Nothing sent by the browser is trusted.
 */

const COOKIE_NAME = "ahoy_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DISCORD_API = "https://discord.com/api/v10";
const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

export type AhoySession = {
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string;
  expiresAt: number;
};

export type DiscordGuildSummary = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/* ------------------------------------------------------------------ */
/* Cookie encryption (AES-GCM, key derived from the OAuth client secret) */
/* ------------------------------------------------------------------ */

async function sessionKey(): Promise<CryptoKey> {
  const secret = env("DISCORD_CLIENT_SECRET");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ahoy:${secret}`));
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

export async function sealSession(session: AhoySession): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sessionKey();
  const data = new TextEncoder().encode(JSON.stringify(session));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data),
  );
  return `${toBase64Url(iv)}.${toBase64Url(cipher)}`;
}

export async function openSession(value: string): Promise<AhoySession | null> {
  try {
    const [ivPart, dataPart] = value.split(".");
    if (!ivPart || !dataPart) return null;
    const key = await sessionKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(dataPart),
    );
    const session = JSON.parse(new TextDecoder().decode(plain)) as AhoySession;
    if (!session.userId || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function buildSessionCookie(sealed: string): string {
  return [
    `${COOKIE_NAME}=${sealed}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function sessionFromHeader(cookieHeader: string | null): Promise<AhoySession | null> {
  const raw = readCookie(cookieHeader, COOKIE_NAME);
  return raw ? openSession(raw) : null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;

/* ------------------------------------------------------------------ */
/* OAuth state — signed + self-verifying, no cookie round-trip needed  */
/* ------------------------------------------------------------------ */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function sealState(): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sessionKey();
  const payload = JSON.stringify({
    nonce: crypto.randomUUID(),
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(cipher)}`;
}

export async function openState(value: string): Promise<boolean> {
  try {
    const [ivPart, dataPart] = value.split(".");
    if (!ivPart || !dataPart) return false;
    const key = await sessionKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(dataPart),
    );
    const { expiresAt } = JSON.parse(new TextDecoder().decode(plain)) as { expiresAt: number };
    return typeof expiresAt === "number" && expiresAt > Date.now();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* OAuth2                                                              */
/* ------------------------------------------------------------------ */

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    client_secret: env("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    console.error("Discord token exchange failed", response.status, await response.text());
    throw new Error("Discord sign-in failed.");
  }
  return (await response.json()) as { access_token: string; expires_in: number };
}

async function discordFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 429) throw new Error("Discord is rate limiting us. Try again shortly.");
  if (!response.ok) {
    console.error("Discord API error", path, response.status);
    throw new Error("Your Discord session expired. Please sign in again.");
  }
  return (await response.json()) as T;
}

export async function fetchCurrentUser(accessToken: string) {
  return discordFetch<{
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  }>("/users/@me", accessToken);
}

/* Small in-process cache so we do not hammer Discord's guild endpoint. */
const guildCache = new Map<string, { at: number; guilds: DiscordGuildSummary[] }>();

export async function fetchUserGuilds(session: AhoySession): Promise<DiscordGuildSummary[]> {
  const cached = guildCache.get(session.userId);
  if (cached && Date.now() - cached.at < 30_000) return cached.guilds;
  const guilds = await discordFetch<DiscordGuildSummary[]>("/users/@me/guilds", session.accessToken);
  guildCache.set(session.userId, { at: Date.now(), guilds });
  return guilds;
}

/** Read one member's role IDs in a guild, using the bot's own token. */
async function fetchMemberRoles(guildId: string, userId: string): Promise<string[]> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) return [];
  try {
    const res = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
      { headers: { authorization: `Bot ${token}` } },
    );
    if (!res.ok) return [];
    const member = (await res.json()) as { roles?: string[] };
    return member.roles ?? [];
  } catch {
    return [];
  }
}

export function canManage(guild: DiscordGuildSummary): boolean {
  if (guild.owner) return true;
  let bits = 0n;
  try {
    bits = BigInt(guild.permissions ?? "0");
  } catch {
    return false;
  }
  return (bits & MANAGE_GUILD) === MANAGE_GUILD || (bits & ADMINISTRATOR) === ADMINISTRATOR;
}

/**
 * Server-side authorization gate. Throws unless the signed-in Discord user
 * really can manage the requested guild — either via Discord's own
 * Manage Server / Administrator / owner permissions, or via a role listed
 * in that guild's Role Manager (server_settings.manager_role_ids).
 */
export async function assertGuildAccess(
  session: AhoySession,
  guildId: string,
): Promise<DiscordGuildSummary> {
  const guilds = await fetchUserGuilds(session);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) throw new Error("You do not have permission to manage this server.");
  if (canManage(guild)) return guild;

  // Not an owner/admin/manage-guild holder — check the custom Role Manager list.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("server_settings")
      .select("manager_role_ids")
      .eq("guild_id", guildId)
      .maybeSingle();
    const managerRoleIds: string[] = (data?.["manager_role_ids"] as string[] | null) ?? [];
    if (managerRoleIds.length) {
      const memberRoles = await fetchMemberRoles(guildId, session.userId);
      if (memberRoles.some((r) => managerRoleIds.includes(r))) return guild;
    }
  } catch (error) {
    console.error("Role Manager check failed", error);
  }

  throw new Error("You do not have permission to manage this server.");
}
