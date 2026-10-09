import { NextResponse } from 'next/server';
import { createAppInterestsHandlers } from '@/lib/supabase/appInterestsHandlers';
import { getUser } from '@/lib/supabase/user';
import { admin } from '@/lib/supabase/admin';
import { getForwardableApiKey } from '@/lib/muapi/auth';

const MUAPI_BASE = 'https://api.muapi.ai';

async function proxyMuapiRequest(request, rawApiKey) {
  const apiKey = getForwardableApiKey(rawApiKey);
  if (!apiKey) return null;

  const method = request.method;
  const endpoint = method === 'POST' ? 'interest' : 'interests';
  const headers = new Headers({ 'x-api-key': apiKey });
  const init = { method, headers };

  if (method === 'POST') {
    headers.set('Content-Type', request.headers.get('content-type') || 'application/json');
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(`${MUAPI_BASE}/app/${endpoint}`, init);
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

const handlers = createAppInterestsHandlers({
  getUser,
  proxyRequest: proxyMuapiRequest,
  async saveInterests(user, interests) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        articog_app_interests: interests,
      },
    });
    if (error || !data?.user) throw new Error('Could not save app interest');
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;