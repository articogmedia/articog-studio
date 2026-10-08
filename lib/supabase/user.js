import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!key) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) {
    const error = new Error(`Supabase server configuration is missing ${missing.join(' and ')}.`);
    error.code = 'SUPABASE_SERVER_CONFIG_MISSING';
    throw error;
  }
  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data?.user ?? null;
}

export async function getUserByRequest(request) {
  return getUser();
}
