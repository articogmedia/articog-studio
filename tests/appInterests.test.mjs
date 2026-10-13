import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./seedanceEsmLoader.mjs', import.meta.url);
await new Promise((resolve) => process.nextTick(resolve));

const { createAppInterestsHandlers } = await import('../lib/supabase/appInterestsHandlers.js');
const { createBalanceHandler } = await import('../lib/supabase/balanceHandler.js');
const { shouldRefreshSupabaseSession } = await import('../lib/supabase/middlewarePolicy.js');
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
});