import { NextResponse } from "next/server";
import { supabaseSessionCookieNames } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const verifier = request.cookies.get("articog_supabase_pkce")?.value;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !verifier) {
    return NextResponse.redirect(new URL("/login?error=auth_not_configured", origin));
  }

  const exchange = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    cache: "no-store",
  });
  const session = await exchange.json().catch(() => ({}));
  if (!exchange.ok || !session.access_token) {
    return NextResponse.redirect(new URL("/login?error=code_exchange_failed", origin));
  }

  const response = NextResponse.redirect(new URL("/", origin));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  response.cookies.set(supabaseSessionCookieNames.access, session.access_token, cookieOptions);
  if (session.refresh_token) {
    response.cookies.set(supabaseSessionCookieNames.refresh, session.refresh_token, cookieOptions);
  }
  response.cookies.delete("articog_supabase_pkce");
  return response;
}
