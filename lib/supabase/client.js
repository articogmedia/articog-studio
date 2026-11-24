const SESSION_ENDPOINT = "/api/auth/session";

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function authRequest(path, body) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.message || data.error_description || data.error || "Supabase authentication failed.");
  }
  return data;
}

async function setSession(session) {
  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not create an authenticated session.");
  }
}

export async function signIn(email, password) {
  const session = await authRequest("token?grant_type=password", { email, password });
  if (!session.access_token) throw new Error("Supabase did not return an access token.");
  await setSession(session);
  return session;
}

export async function signUp(email, password) {
  const session = await authRequest("signup", { email, password });
  if (session.access_token) await setSession(session);
  return session;
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMagicLink(email) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser does not support secure sign-in links.");
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `articog_supabase_pkce=${encodeURIComponent(verifier)}; Max-Age=600; Path=/auth/callback; SameSite=Lax${secure}`;
  const redirect = `${window.location.origin}/auth/callback`;
  const query = `otp?redirect_to=${encodeURIComponent(redirect)}`;
  return authRequest(query, {
    email,
    create_user: true,
    code_challenge: challenge,
    code_challenge_method: "s256",
  });
}

export async function signOut() {
  const cleared = await fetch(SESSION_ENDPOINT, { method: "DELETE" });
  if (!cleared.ok) throw new Error("Could not clear the authenticated session.");
}
