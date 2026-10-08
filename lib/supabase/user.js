import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function getUserByRequest(request) {
  return getUser();
}
