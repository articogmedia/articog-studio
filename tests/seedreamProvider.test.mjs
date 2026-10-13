import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./seedanceEsmLoader.mjs', import.meta.url);
await new Promise((resolve) => process.nextTick(resolve));

const { MODEL_REGISTRY, getProviderByName } = await import('../lib/gateway/registry.js');
const { getEntry, start } = await import('../lib/gateway/providers/seedream.js');
const { t2iModels, i2iModels } = await import('../packages/studio/src/models.js');

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

test('all UI Seedream endpoints are registered with their ModelArk models', () => {
  const expected = {
    'seedream-5.0': { provider: 'seedream', model: 'seedream-5-0-260128', edit: false },
    'seedream-5.0-edit': { provider: 'seedream', model: 'seedream-5-0-260128', edit: true },
    'seedream-5.0-pro': { provider: 'seedream', model: 'seedream-5-0-pro-260628', edit: false },
    'seedream-5.0-pro-edit': { provider: 'seedream', model: 'seedream-5-0-pro-260628', edit: true },
    'seedream-5.0-flash': { provider: 'seedream', model: 'seedream-5-0-flash-260915', edit: false },
    'seedream-5.0-flash-edit': { provider: 'seedream', model: 'seedream-5-0-flash-260915', edit: true },
  };

  for (const [endpoint, entry] of Object.entries(expected)) {
    assert.deepEqual(MODEL_REGISTRY[endpoint], entry);
    assert.deepEqual(getEntry(endpoint), entry);
  }
  assert.ok(t2iModels.some((model) => model.endpoint === 'seedream-5.0-pro'));
  assert.ok(i2iModels.some((model) => model.endpoint === 'seedream-5.0-pro-edit'));
  assert.equal(t2iModels[0].id, 'nano-banana-pro');
  assert.equal(getEntry('seedream-5.0-flash-layerize'), null);
  assert.equal(getProviderByName('seedream')?.start, start);
});

test('text-to-image posts the mapped model and aspect-ratio size', async () => {
  process.env.ARK_API_KEY = 'test-key';
  process.env.ARK_BASE_URL = 'https://ark.test/api/v3/';
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({
      data: [{ url: 'https://images.test/result.jpg' }],
      usage: { total_tokens: 123 },
    }), { status: 200 });
  };

  const result = await start(
    { prompt: 'A paper kite above the sea', aspect_ratio: '16:9', resolution: '1K' },
    {
      endpoint: 'seedream-5.0',
      saveFromUrl: async (url, extension) => `/api/files/${url.split('/').pop().replace('.jpg', `.${extension}`)}`,
    },
  );

  assert.equal(request.url, 'https://ark.test/api/v3/images/generations');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(request.init.headers, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-key',
  });
  assert.deepEqual(JSON.parse(request.init.body), {
    model: 'seedream-5-0-260128',
    prompt: 'A paper kite above the sea',
    response_format: 'url',
    watermark: false,
    size: '1280x720',
  });
  assert.deepEqual(result, {
    status: 'completed',
    outputs: ['/api/files/result.jpeg'],
    usage: { total_tokens: 123 },
  });
});

test('edit posts base64 references, output options, and enforces model reference limits', async () => {
  process.env.ARK_API_KEY = 'test-key';
  const referenceBytes = Buffer.from('reference image');
  let requestBody;
  globalThis.fetch = async (url, init) => {
    if (url.startsWith('https://images.test/')) {
      return new Response(referenceBytes, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: [{ url: 'https://images.test/result.png' }] }), { status: 200 });
  };

  await start({
    prompt: 'Add soft evening light',
    image_url: 'https://images.test/first.png',
    images_list: ['https://images.test/second.png'],
    output_format: 'png',
    seed: 42,
  }, {
    endpoint: 'seedream-5.0-edit',
    saveFromUrl: async (url, extension) => `/saved/${extension}/${url.split('/').pop()}`,
  });

  const expectedDataUrl = `data:image/png;base64,${referenceBytes.toString('base64')}`;
  assert.deepEqual(requestBody.image, [expectedDataUrl, expectedDataUrl]);
  assert.equal(requestBody.model, 'seedream-5-0-260128');
  assert.equal(requestBody.output_format, 'png');
  assert.equal(requestBody.seed, 42);

  const excessiveReferences = Array.from({ length: 10 }, (_, index) => `https://images.test/${index}.png`);
  await assert.rejects(
    start({ prompt: 'Too many refs', image_url: 'https://images.test/extra.png', images_list: excessiveReferences }, {
      endpoint: 'seedream-5.0-pro-edit',
    }),
    /at most 10 reference images/,
  );
  await assert.rejects(
    start({ prompt: 'Too many refs', images_list: Array.from({ length: 15 }, (_, index) => `https://images.test/${index}.png`) }, {
      endpoint: 'seedream-5.0-flash-edit',
    }),
    /at most 14 reference images/,
  );
});

test('retries a size-related 400 once with the tier keyword', async () => {
  process.env.ARK_API_KEY = 'test-key';
  const requestBodies = [];
  globalThis.fetch = async (_url, init) => {
    requestBodies.push(JSON.parse(init.body));
    if (requestBodies.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'Invalid image size resolution pixels' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ data: [{ url: 'https://images.test/retried.jpg' }] }), { status: 200 });
  };

  await start({ prompt: 'A blue ceramic vase' }, {
    endpoint: 'seedream-5.0-pro',
    saveFromUrl: async () => '/saved/retried.jpeg',
  });

  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0].size, '2048x2048');
  assert.equal(requestBodies[1].size, '2K');
});

test('API errors surface useful messages without revealing the key', async () => {
  process.env.ARK_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: 'Invalid deployment test-key' },
  }), { status: 400 });

  await assert.rejects(
    start({ prompt: 'An image prompt' }, { endpoint: 'seedream-5.0' }),
    (error) => {
      assert.match(error.message, /Invalid deployment/);
      assert.doesNotMatch(error.message, /test-key/);
      return true;
    },
  );
});