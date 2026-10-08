import { createClient } from '@supabase/supabase-js';

let client;

export function getAdmin() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Supabase admin env vars are not set');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Lets later code write `admin.from(...)` / `admin.rpc(...)` as in the guide.
export const admin = new Proxy({}, {
  get(_target, prop) {
    const c = getAdmin();
    const value = c[prop];
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
