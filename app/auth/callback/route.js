import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAuthCallbackHandler } from '@/lib/supabase/auth';

export const GET = createAuthCallbackHandler({
  createServerClient,
  createRedirect: (url) => NextResponse.redirect(url),
});
