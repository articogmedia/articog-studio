import { createBrowserClient } from '@supabase/ssr';

let browserClient;

export const supabaseBrowser = () => {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!key) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) {
    const error = new Error(`Supabase browser configuration is missing ${missing.join(' and ')}. Restart the Next.js server after updating .env.local.`);
    error.code = 'SUPABASE_BROWSER_CONFIG_MISSING';
    throw error;
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
};
