import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./seedanceEsmLoader.mjs', import.meta.url);
await new Promise((resolve) => process.nextTick(resolve));

const { createAppInterestsHandlers } = await import('../lib/supabase/appInterestsHandlers.js');
const { createBalanceHandler } = await import('../lib/supabase/balanceHandler.js');
const { shouldRefreshSupabaseSession } = await import('../lib/supabase/middlewarePolicy.js');
const { requireAuthenticatedGatewayUser } = await import('../lib/gateway/auth.js');
const { saveArticogProfile } = await import('../lib/supabase/profileClient.js');
const { requestEmailSignInLink } = await import('../lib/supabase/signIn.js');
const { clearTeamDemoSession, createTeamDemoSession } = await import('../lib/supabase/teamDemoClient.js');
const { createTeamDemoSessionHandlers } = await import('../lib/supabase/teamDemoRoute.js');
const {
  createTeamDemoSessionToken,
  resolveTeamDemoUser,
  TEAM_DEMO_COOKIE,
  TEAM_DEMO_SESSION_TTL_SECONDS,
  verifyTeamDemoAccessCode,
  verifyTeamDemoSessionToken,
} = await import('../lib/supabase/teamDemoSession.js');
const {
  ACCESS_PROFILE_STORAGE_KEY,
  clearStoredAccessProfile,
  readStoredAccessProfile,
  saveStoredAccessProfile,
} = await import('../lib/accessProfileStorage.js');
const { getForwardableApiKey, INTERNAL_SESSION_KEY, stripInternalSessionCredential } = await import('../lib/muapi/auth.js');
const { generateImage, getAppInterests, getUserBalance, registerAppInterest } = await import('../packages/studio/src/muapi.js');

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test('authenticated app interests are read and saved only for the session user', async () => {
  const user = {
    id: 'user-123',
    user_metadata: { display_name: 'Studio User', articog_app_interests: ['Alpha'] },
  };
  let saved;
  let proxyCalls = 0;
  const handlers = createAppInterestsHandlers({
    getUser: async () => user,
    saveInterests: async (authenticatedUser, interests) => {
      saved = { userId: authenticatedUser.id, interests };
    },
    proxyRequest: async () => { proxyCalls += 1; return null; },
  });

  const read = await handlers.GET(new Request('https://studio.test/api/app/interests'));
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), ['Alpha']);

  const write = await handlers.POST(new Request('https://studio.test/api/app/interests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: 'Beta' }),
  }));
  assert.equal(write.status, 200);
  assert.deepEqual(saved, { userId: 'user-123', interests: ['Alpha', 'Beta'] });
  assert.equal(proxyCalls, 0);
});

test('unauthenticated interests requests are rejected without writing or proxying the sentinel', async () => {
  let saveCalls = 0;
  let proxyCalls = 0;
  const handlers = createAppInterestsHandlers({
    getUser: async () => null,
    saveInterests: async () => { saveCalls += 1; },
    proxyRequest: async (_request, apiKey) => {
      const forwardable = getForwardableApiKey(apiKey);
      if (!forwardable) return null;
      proxyCalls += 1;
      return Response.json({});
    },
  });

  for (const method of ['GET', 'POST']) {
    const response = await handlers[method](new Request('https://studio.test/api/app/interests', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': INTERNAL_SESSION_KEY,
      },
      ...(method === 'POST' ? { body: JSON.stringify({ app_name: 'Alpha' }) } : {}),
    }));
    assert.equal(response.status, 401);
  }

  assert.equal(saveCalls, 0);
  assert.equal(proxyCalls, 0);
});

test('genuine BYOK keys retain the existing MuAPI interests proxy path', async () => {
  let forwardedKey;
  let authCalls = 0;
  const handlers = createAppInterestsHandlers({
    getUser: async () => { authCalls += 1; return null; },
    saveInterests: async () => {},
    proxyRequest: async (_request, apiKey) => {
      forwardedKey = getForwardableApiKey(apiKey);
      return Response.json(['MuAPI app']);
    },
  });

  const response = await handlers.GET(new Request('https://studio.test/api/app/interests', {
    headers: { 'x-api-key': 'muapi-byok-key' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), ['MuAPI app']);
  assert.equal(forwardedKey, 'muapi-byok-key');
  assert.equal(authCalls, 0);
});

test('browser helpers route internal balance and interests through same-origin session APIs', async () => {
  globalThis.window = { location: { protocol: 'https:' } };
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('account/balance') ? { balance: 8 } : ['Alpha']);
  };

  await getUserBalance(INTERNAL_SESSION_KEY);
  await getAppInterests(INTERNAL_SESSION_KEY);
  await registerAppInterest(INTERNAL_SESSION_KEY, 'Beta');

  assert.deepEqual(requests.map(({ url }) => url), [
    '/api/v1/account/balance',
    '/api/app/interests',
    '/api/app/interests',
  ]);
  for (const { init } of requests) {
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.headers['x-api-key'], undefined);
  }
});

test('balance helper preserves the unauthorized status for the UI to handle safely', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Please sign in.' }, { status: 401 });

  await assert.rejects(
    getUserBalance(INTERNAL_SESSION_KEY),
    (error) => {
      assert.match(error.message, /Failed to fetch balance: 401/);
      assert.equal(error.status, 401);
      return true;
    },
  );
});

test('first-party balance handler authenticates the Supabase session', async () => {
  const authenticated = createBalanceHandler({
    isOwnGateway: () => true,
    getUser: async () => ({ id: 'user-456' }),
    getBalance: async (userId) => {
      assert.equal(userId, 'user-456');
      return 12;
    },
  });
  const unauthorized = createBalanceHandler({
    isOwnGateway: () => true,
    getUser: async () => null,
    getBalance: async () => assert.fail('balance must not be queried without a session'),
  });

  const success = await authenticated();
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { balance: 12 });

  const denied = await unauthorized();
  assert.equal(denied.status, 401);
});

test('model gateway requires a server-verified Supabase user', async () => {
  const denied = await requireAuthenticatedGatewayUser(async () => null);
  assert.equal(denied.user, null);
  assert.equal(denied.response.status, 401);
  assert.deepEqual(await denied.response.json(), {
    detail: 'Please sign in to use the gateway.',
  });

  const user = { id: 'verified-user' };
  const allowed = await requireAuthenticatedGatewayUser(async () => user);
  assert.equal(allowed.user, user);
  assert.equal(allowed.response, null);
});

test('proxy credential filtering rejects the internal sentinel for every Bearer casing and preserves BYOK credentials', () => {
  assert.equal(getForwardableApiKey(INTERNAL_SESSION_KEY), null);
  assert.equal(getForwardableApiKey('  muapi-byok-key  '), 'muapi-byok-key');

  for (const scheme of ['Bearer', 'bearer', 'bEaReR']) {
    const headers = new Headers({
      'x-api-key': INTERNAL_SESSION_KEY,
      Authorization: `${scheme} ${INTERNAL_SESSION_KEY}`,
    });
    stripInternalSessionCredential(headers);
    assert.equal(headers.has('x-api-key'), false);
    assert.equal(headers.has('authorization'), false);
  }

  const byokHeaders = new Headers({
    'x-api-key': 'muapi-byok-key',
    Authorization: 'Bearer muapi-bearer-key',
  });
  stripInternalSessionCredential(byokHeaders);
  assert.equal(byokHeaders.get('x-api-key'), 'muapi-byok-key');
  assert.equal(byokHeaders.get('authorization'), 'Bearer muapi-bearer-key');
});

test('Supabase session refresh covers authenticated first-party APIs but not upstream MuAPI rewrites', () => {
  assert.equal(shouldRefreshSupabaseSession('/api/v1/account/balance', true), true);
  assert.equal(shouldRefreshSupabaseSession('/api/app/interests', true), true);
  assert.equal(shouldRefreshSupabaseSession('/api/v1/seedream-5.0-pro', true), true);
  assert.equal(shouldRefreshSupabaseSession('/api/v1/seedream-5.0-pro', false), false);
  assert.equal(shouldRefreshSupabaseSession('/api/v1/account/balance', false), true);
  assert.equal(shouldRefreshSupabaseSession('/studio/image', false), true);
});

test('static access profile persists locally and clearing browser storage shows the access screen again', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const submittedProfile = { fullName: ' Studio User ', email: 'USER@example.com' };

  assert.equal(readStoredAccessProfile(storage), null);
  const saved = saveStoredAccessProfile(submittedProfile, storage);
  assert.deepEqual(saved, {
    fullName: 'Studio User',
    email: 'user@example.com',
    company: '',
  });
  assert.equal(values.has(ACCESS_PROFILE_STORAGE_KEY), true);
  assert.deepEqual(readStoredAccessProfile(storage), saved);

  clearStoredAccessProfile(storage);
  assert.equal(readStoredAccessProfile(storage), null);
});

test('internal session marker is not sent as a generation API credential', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return Response.json({ status: 'completed' });
  };

  try {
    await generateImage(INTERNAL_SESSION_KEY, { model: 'test-model', prompt: 'Test image' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.init.headers['x-api-key'], undefined);
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.equal(request.init.credentials, 'same-origin');
});

test('profile completion posts with same-origin cookies and rejects unauthenticated saves', async () => {
  const profile = { fullName: 'Studio User', email: 'user@example.com' };
  let requestInit;

  await assert.rejects(
    saveArticogProfile(profile, async (_url, init) => {
      requestInit = init;
      return Response.json({ detail: 'Sign in to continue.' }, { status: 401 });
    }),
    /Sign in to continue/,
  );
  assert.equal(requestInit.credentials, 'same-origin');
  assert.equal(requestInit.method, 'POST');

  const result = await saveArticogProfile(profile, async () => (
    Response.json({ complete: true, profile: { ...profile, company: '' } })
  ));
  assert.deepEqual(result, { ...profile, company: '' });
});

test('name-and-email sign-in requests a Supabase link back to the callback without creating accounts', async () => {
  let request;
  const message = await requestEmailSignInLink({
    auth: {
      signInWithOtp: async (options) => {
        request = options;
        return { error: null };
      },
    },
  }, 'user@example.com', 'https://articog-studio.vercel.app');

  assert.equal(request.email, 'user@example.com');
  assert.equal(request.options.emailRedirectTo, 'https://articog-studio.vercel.app/auth/callback');
  assert.equal(request.options.shouldCreateUser, false);
  assert.match(message, /Open it in this browser/);
});

const teamDemoEnv = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_USE_OWN_GATEWAY: 'true',
  ARTICOG_ENABLE_TEAM_DEMO_ACCESS: 'true',
  ARTICOG_TEAM_DEMO_ACCESS_CODE: 'team-demo-access-code-'.padEnd(48, 'a'),
  ARTICOG_TEAM_DEMO_SESSION_SECRET: 'server-only-signing-secret-'.padEnd(48, 'b'),
  ARTICOG_TEAM_DEMO_USER_ID: '123e4567-e89b-12d3-a456-426614174000',
};

test('team demo access code and signed session enforce expiry and configured account binding', async () => {
  const now = 1_800_000_000_000;
  assert.equal(verifyTeamDemoAccessCode(teamDemoEnv.ARTICOG_TEAM_DEMO_ACCESS_CODE, teamDemoEnv), true);
  assert.equal(verifyTeamDemoAccessCode('incorrect-code', teamDemoEnv), false);

  const token = createTeamDemoSessionToken(teamDemoEnv, now);
  assert.deepEqual(verifyTeamDemoSessionToken(token, teamDemoEnv, now), {
    userId: teamDemoEnv.ARTICOG_TEAM_DEMO_USER_ID,
    expiresAt: Math.floor(now / 1000) + TEAM_DEMO_SESSION_TTL_SECONDS,
  });
  assert.equal(verifyTeamDemoSessionToken(`${token}tampered`, teamDemoEnv, now), null);
  assert.equal(verifyTeamDemoSessionToken(token, teamDemoEnv, now + TEAM_DEMO_SESSION_TTL_SECONDS * 1000 + 1), null);

  const resolved = await resolveTeamDemoUser(token, async (userId) => ({ id: userId, email: 'demo@example.com' }), teamDemoEnv, now);
  assert.equal(resolved.id, teamDemoEnv.ARTICOG_TEAM_DEMO_USER_ID);
  const wrongUser = await resolveTeamDemoUser(token, async () => ({ id: 'another-user' }), teamDemoEnv, now);
  assert.equal(wrongUser, null);
});

test('team demo session endpoint rejects disabled, cross-origin, and invalid-code requests', async () => {
  let accountLookupCalls = 0;
  const handlers = createTeamDemoSessionHandlers({
    getEnv: () => teamDemoEnv,
    lookupUser: async () => { accountLookupCalls += 1; return { id: teamDemoEnv.ARTICOG_TEAM_DEMO_USER_ID }; },
  });
  const makeRequest = (origin, accessCode = teamDemoEnv.ARTICOG_TEAM_DEMO_ACCESS_CODE) => new Request('https://studio.example/api/team-demo/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });

  assert.equal((await handlers.POST(makeRequest('https://attacker.example'))).status, 403);
  assert.equal((await handlers.POST(makeRequest('https://studio.example', 'wrong-code'))).status, 401);
  assert.equal(accountLookupCalls, 0);

  const disabledHandlers = createTeamDemoSessionHandlers({
    getEnv: () => ({ ...teamDemoEnv, ARTICOG_ENABLE_TEAM_DEMO_ACCESS: 'false' }),
    lookupUser: async () => assert.fail('disabled team access must not look up an account'),
  });
  assert.equal((await disabledHandlers.POST(makeRequest('https://studio.example'))).status, 404);
});

test('team demo session endpoint issues only an HttpOnly cookie for the configured Supabase user', async () => {
  const handlers = createTeamDemoSessionHandlers({
    getEnv: () => teamDemoEnv,
    lookupUser: async (userId) => ({ id: userId, email: 'demo@example.com' }),
  });
  const accessCode = teamDemoEnv.ARTICOG_TEAM_DEMO_ACCESS_CODE;
  const response = await handlers.POST(new Request('https://studio.example/api/team-demo/session', {
    method: 'POST',
    headers: { Origin: 'https://studio.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  }));

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, { ok: true, expiresIn: TEAM_DEMO_SESSION_TTL_SECONDS });
  assert.equal(JSON.stringify(result).includes(accessCode), false);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${TEAM_DEMO_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const token = cookie.split(';', 1)[0].slice(`${TEAM_DEMO_COOKIE}=`.length);
  assert.equal(verifyTeamDemoSessionToken(token, teamDemoEnv)?.userId, teamDemoEnv.ARTICOG_TEAM_DEMO_USER_ID);

  const cleared = await handlers.DELETE(new Request('https://studio.example/api/team-demo/session', { method: 'DELETE' }));
  assert.match(cleared.headers.get('set-cookie'), /Max-Age=0/);
});

test('team demo browser client sends the code same-origin and can clear the cookie session', async () => {
  const calls = [];
  const fakeRequest = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ ok: true });
  };
  await createTeamDemoSession('team-demo-code', fakeRequest);
  await clearTeamDemoSession(fakeRequest);
  assert.deepEqual(calls.map(({ url }) => url), ['/api/team-demo/session', '/api/team-demo/session']);
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(JSON.parse(calls[0].init.body).accessCode, 'team-demo-code');
  assert.equal(calls[1].init.method, 'DELETE');
  assert.equal(calls[1].init.credentials, 'same-origin');
});