import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!code || !supaUrl || !supaKey) {
    const redirectUrl = new URL('/studio', request.url);
    redirectUrl.searchParams.set('auth_error', 'callback_unavailable');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const store = await cookies();
    const supabase = createServerClient(supaUrl, supaKey, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch (error) {
    console.error('[auth] callback exchange failed', error?.name || 'unknown');
    const redirectUrl = new URL('/studio', request.url);
    redirectUrl.searchParams.set('auth_error', 'callback_failed');
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL('/studio', request.url));
}
