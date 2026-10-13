import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { admin } from './admin';
import { resolveVercelTeamDemoUser } from './vercelTeamDemoUser';

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
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  if (data?.user) return data.user;

  return resolveVercelTeamDemoUser({
    isVercelProduction: process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production',
    ownGatewayEnabled: process.env.NEXT_PUBLIC_USE_OWN_GATEWAY === 'true',
    demoAccessEnabled: process.env.ARTICOG_ENABLE_VERCEL_AUTH_TEAM_DEMO === 'true',
    userId: process.env.ARTICOG_TEAM_DEMO_USER_ID,
    lookupUser: async (userId) => {
      const { data: demoUser, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError) throw lookupError;
      return demoUser?.user ?? null;
    },
  });
}

export async function getUserByRequest(request) {
  return getUser();
}
