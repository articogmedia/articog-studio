import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./seedanceEsmLoader.mjs', import.meta.url);
await new Promise((resolve) => process.nextTick(resolve));

const { MODEL_REGISTRY } = await import('../lib/gateway/registry.js');
const { check, getEntry, start } = await import('../lib/gateway/providers/seedance.js');
const { getApiBaseUrl } = await import('../packages/studio/src/muapi.js');
const { pollForGenerationResult } = await import('../packages/studio/src/utils/generationLifecycle.js');
const { t2vModels, i2vModels, v2vModels } = await import('../packages/studio/src/models.js');

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.ARK_API_KEY;
const originalBaseUrl = process.env.ARK_BASE_URL;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.ARK_API_KEY;
  else process.env.ARK_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.ARK_BASE_URL;
  else process.env.ARK_BASE_URL = originalBaseUrl;
});

test('Seedance 2.5 selectable endpoints route to the official ModelArk deployment', () => {
  for (const profile of ['', 'intl-', 'spicy-']) {
    for (const workflow of ['text-to-video', 'image-to-video', 'first-last-frame', 'omni-reference']) {
      for (const resolution of ['', '-480p', '-1080p']) {
        const endpoint = `seedance-2.5-${profile}${workflow}${resolution}`;
        assert.equal(MODEL_REGISTRY[endpoint]?.provider, 'seedance', `${endpoint} provider`);
        assert.equal(MODEL_REGISTRY[endpoint]?.model, 'dreamina-seedance-2-5-260628', `${endpoint} model`);
        assert.deepEqual(getEntry(endpoint), MODEL_REGISTRY[endpoint]);
      }
      assert.equal(MODEL_REGISTRY[`seedance-2.5-${profile}${workflow}-4k`], undefined);
      assert.equal(getEntry(`seedance-2.5-${profile}${workflow}-4k`), null);
    }
  }
});

test('video picker hides only unsupported Seedance 2.5 4K entries', () => {
  const videoModels = [...t2vModels, ...i2vModels, ...v2vModels];
  assert.equal(videoModels.some((model) => /^seedance-2\.5-.+-4k$/.test(model.id)), false);
  assert.ok(t2vModels.some((model) => model.id === 'seedance-2.5-text-to-video-1080p'));
  assert.ok(i2vModels.some((model) => model.id === 'seedance-2.5-image-to-video-1080p'));
  assert.ok(v2vModels.some((model) => model.id === 'seedance-2.5-video-edit'));
  assert.ok(t2vModels.some((model) => model.id === 'seedance-2-vip-text-to-video-4k'));
});

test('start constructs the ModelArk task request and supports both runner contracts', async () => {
  process.env.ARK_API_KEY = 'test-key';
  process.env.ARK_BASE_URL = 'https://ark.test/api/v3/';
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: 'task-123' }), { status: 200 });
  };

  const result = await start(
    { input: { prompt: 'A paper kite above the sea', duration: 8, aspect_ratio: '9:16', resolution: '1080p', seed: 42, generate_audio: false }, endpoint: 'seedance-2.5-text-to-video', entry: getEntry('seedance-2.5-text-to-video') },
  );

  assert.deepEqual(result, { externalId: 'task-123' });
  assert.equal(request.url, 'https://ark.test/api/v3/contents/generations/tasks');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.init.body), {
    model: 'dreamina-seedance-2-5-260628',
    content: [{ type: 'text', text: 'A paper kite above the sea' }],
    ratio: '9:16',
    duration: 8,
    generate_audio: false,
    watermark: false,
    resolution: '1080p',
    seed: 42,
  });

  let supabaseRequest;
  globalThis.fetch = async (_url, init) => {
    supabaseRequest = init;
    return new Response(JSON.stringify({ id: 'task-456' }), { status: 200 });
  };
  assert.deepEqual(await start({ prompt: 'A quiet mountain sunrise' }, {
    endpoint: 'seedance-2.5-text-to-video',
    entry: getEntry('seedance-2.5-text-to-video'),
  }), { externalId: 'task-456' });
  assert.equal(JSON.parse(supabaseRequest.body).content[0].text, 'A quiet mountain sunrise');

  globalThis.fetch = async (_url, init) => {
    supabaseRequest = init;
    return new Response(JSON.stringify({ id: 'task-789' }), { status: 200 });
  };
  await start({ prompt: 'A 4K legacy generation', duration: 15, resolution: '4k' }, {
    endpoint: 'seedance-v2.0-t2v',
    entry: getEntry('seedance-v2.0-t2v'),
  });
  assert.equal(JSON.parse(supabaseRequest.body).model, 'dreamina-seedance-2-0-260128');
  assert.equal(JSON.parse(supabaseRequest.body).resolution, '4k');
});

test('start rejects a missing API key before making a request', async () => {
  delete process.env.ARK_API_KEY;
  let called = false;
  globalThis.fetch = async () => { called = true; };

  await assert.rejects(
    start({ prompt: 'A test prompt' }, { endpoint: 'seedance-2.5-text-to-video' }),
    /ARK_API_KEY is not set/,
  );
  assert.equal(called, false);
});

test('start surfaces provider errors without losing the upstream message', async () => {
  process.env.ARK_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid model deployment' } }), { status: 400 });

  await assert.rejects(
    start({ prompt: 'A test prompt' }, { endpoint: 'seedance-2.5-text-to-video' }),
    /Invalid model deployment/,
  );
});

test('check maps processing, succeeded, and failed ModelArk tasks', async () => {
  process.env.ARK_API_KEY = 'test-key';
  process.env.ARK_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
  const requests = [];
  const tasks = [
    { status: 'queued' },
    { status: 'running' },
    { status: 'succeeded', content: { video_url: 'https://ark.test/video.mp4' }, usage: { duration: 5 } },
    { status: 'failed', error: { message: 'Generation rejected' } },
    { status: 'cancelled' },
    { status: 'expired' },
  ];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return new Response(JSON.stringify(tasks.shift()), { status: 200 });
  };

  assert.deepEqual(await check({ externalId: 'task-queued' }), { status: 'processing' });
  assert.deepEqual(await check({ externalId: 'task-running' }), { status: 'processing' });
  assert.deepEqual(await check({ externalId: 'task-done' }, { saveVideo: async (url, ext) => `${url}.${ext}.saved` }), {
    status: 'completed',
    outputs: ['https://ark.test/video.mp4.mp4.saved'],
    usage: { duration: 5 },
  });
  assert.deepEqual(await check({ externalId: 'task-failed' }), { status: 'failed', error: 'Generation rejected' });
  assert.deepEqual(await check({ externalId: 'task-cancelled' }), { status: 'failed', error: 'Seedance task cancelled' });
  assert.deepEqual(await check({ externalId: 'task-expired' }), { status: 'failed', error: 'Seedance task expired' });
  assert.deepEqual(requests, [
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-queued',
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-running',
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-done',
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-failed',
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-cancelled',
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-expired',
  ]);
});

test('check surfaces ModelArk polling errors without leaking credentials', async () => {
  process.env.ARK_API_KEY = 'test-key';
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    return new Response(JSON.stringify({ error: { message: 'Task lookup unavailable' } }), { status: 503 });
  };

  await assert.rejects(
    check({ externalId: 'task-error' }),
    (error) => {
      assert.match(error.message, /Task lookup unavailable/);
      assert.doesNotMatch(error.message, /test-key/);
      return true;
    },
  );
});

test('generation polling stops at its configured timeout without a live request', async () => {
  let pollCount = 0;

  await assert.rejects(
    pollForGenerationResult({
      baseUrl: '',
      requestId: 'task-timeout',
      apiKey: 'test-key',
      maxAttempts: 2,
      interval: 0,
      fetchImpl: async () => {
        pollCount += 1;
        return new Response(JSON.stringify({ status: 'running' }), { status: 200 });
      },
    }),
    (error) => {
      assert.match(error.message, /Generation timed out/);
      assert.equal(error.requestId, 'task-timeout');
      return true;
    },
  );

  assert.equal(pollCount, 2);
});

test('browser Seedance 2.5 submissions use the app gateway without changing other model routing', () => {
  const existingBase = getApiBaseUrl('nano-banana-pro');
  const previousWindow = globalThis.window;
  globalThis.window = { location: { protocol: 'https:' } };

  try {
    assert.equal(getApiBaseUrl('seedance-2.5-text-to-video'), '');
    assert.equal(getApiBaseUrl('seedance-2.5-text-to-video-4k'), existingBase);
    assert.equal(getApiBaseUrl('seedance-2.5-video-edit'), existingBase);
    assert.equal(getApiBaseUrl('seedance-2.5-motion-control'), existingBase);
    assert.equal(getApiBaseUrl('nano-banana-pro'), existingBase);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});