import { cookies } from "next/headers";

const ACCESS_COOKIE = "articog_supabase_access";
const REFRESH_COOKIE = "articog_supabase_refresh";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secretKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and server-only SUPABASE_SECRET_KEY.");
  }
  return { url: url.replace(/\/$/, ""), key, secretKey };
}

export async function verifyAccessToken(accessToken) {
  if (!accessToken) return null;
  const { url, key } = getConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getSessionFromRequest(request) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  const user = await verifyAccessToken(accessToken);
  return user ? { accessToken, user } : null;
}

export async function requireSupabaseSession(request) {
  const session = await getSessionFromRequest(request);
  if (!session) return null;
  return session;
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  const user = await verifyAccessToken(accessToken);
  return user ? { accessToken, user } : null;
}

export function getSupabaseRestUrl(path) {
  const { url } = getConfig();
  return `${url}/rest/v1/${path}`;
}

export function supabaseRestHeaders(accessToken, extra = {}) {
  const { secretKey } = getConfig();
  return {
    apikey: secretKey,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

export async function fetchSupabaseRest(request, path, init = {}) {
  const session = await getSessionFromRequest(request);
  if (!session) return { session: null, response: null };
  const response = await fetch(getSupabaseRestUrl(path), {
    ...init,
    headers: supabaseRestHeaders(session.accessToken, init.headers || {}),
    cache: "no-store",
  });
  return { session, response };
}

export const supabaseSessionCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
};
