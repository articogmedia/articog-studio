import { NextResponse } from "next/server";
import {
  supabaseSessionCookieNames,
  verifyAccessToken,
} from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let session;
  try {
    session = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof session?.access_token !== "string" || !session.access_token) {
    return NextResponse.json({ error: "An access token is required." }, { status: 400 });
  }
  const user = await verifyAccessToken(session.access_token);
  if (!user) return NextResponse.json({ error: "The Supabase session is invalid." }, { status: 401 });

  const response = NextResponse.json({ user: { id: user.id, email: user.email } });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  response.cookies.set(supabaseSessionCookieNames.access, session.access_token, cookieOptions);
  if (typeof session.refresh_token === "string" && session.refresh_token) {
    response.cookies.set(supabaseSessionCookieNames.refresh, session.refresh_token, cookieOptions);
  }
  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(supabaseSessionCookieNames.access)?.value;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (accessToken && supabaseUrl && publishableKey) {
    const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 401) {
      return NextResponse.json({ error: "Could not revoke the Supabase session." }, { status: 502 });
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(supabaseSessionCookieNames.access);
  response.cookies.delete(supabaseSessionCookieNames.refresh);
  return response;
}
