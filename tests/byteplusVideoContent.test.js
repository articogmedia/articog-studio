const test = require('node:test');
const assert = require('node:assert/strict');

test('buildBytePlusContent builds text-to-video requests without images', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.deepEqual(buildBytePlusContent({ prompt: 'A moving scene', imageUrls: [] }), {
        content: [{ type: 'text', text: 'A moving scene' }],
        extraBody: {},
        ratioOverride: null,
    });
});

test('buildBytePlusContent sets a first-frame role and adaptive ratio for one image', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.deepEqual(buildBytePlusContent({
        prompt: 'A moving scene',
        imageUrls: ['https://example.com/one.png'],
    }), {
        content: [
            { type: 'text', text: 'A moving scene' },
            { type: 'image_url', image_url: { url: 'https://example.com/one.png' }, role: 'first_frame' },
        ],
        extraBody: {},
        ratioOverride: 'adaptive',
    });
});

test('buildBytePlusContent marks multiple images as references', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    const result = buildBytePlusContent({
        prompt: 'A moving scene',
        imageUrls: ['https://example.com/one.png', 'data:image/png;base64,ZmFrZQ=='],
    });
    assert.deepEqual(result.content, [
        { type: 'text', text: 'A moving scene' },
        { type: 'image_url', image_url: { url: 'https://example.com/one.png' }, role: 'reference_image' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,ZmFrZQ==' }, role: 'reference_image' },
    ]);
    assert.deepEqual(result.extraBody, { omni_reference_task_type: 'reference' });
    assert.equal(result.ratioOverride, null);
});

test('buildBytePlusContent rejects too many images', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.throws(() => buildBytePlusContent({
        prompt: 'A moving scene',
        imageUrls: ['https://example.com/one.png', 'https://example.com/two.png'],
        maxImages: 1,
    }), /at most 1 reference images/);
});

test('buildBytePlusContent rejects non-HTTPS image URLs', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.throws(() => buildBytePlusContent({
        prompt: 'A moving scene',
        imageUrls: ['http://example.com/one.png'],
    }), /HTTPS URL or a data:image/);
});

test('buildBytePlusContent rejects non-array image input', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.throws(() => buildBytePlusContent({
        prompt: 'A moving scene',
        imageUrls: 'https://example.com/one.png',
    }), /must be an array/);
});

test('only a single image applies the adaptive ratio override', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');

    assert.equal(buildBytePlusContent({ prompt: 'Text only', imageUrls: [] }).ratioOverride, null);
    assert.equal(buildBytePlusContent({
        prompt: 'First frame',
        imageUrls: ['https://example.com/one.png'],
    }).ratioOverride, 'adaptive');
    assert.equal(buildBytePlusContent({
        prompt: 'References',
        imageUrls: ['https://example.com/one.png', 'https://example.com/two.png'],
    }).ratioOverride, null);
});

test('buildBytePlusContent supports six public reference image URLs', async () => {
    const { buildBytePlusContent } = await import('../app/api/byteplus/video/content.mjs');
    const imageUrls = Array.from({ length: 6 }, (_, index) => `https://images.example/${index + 1}.jpg`);

    const result = buildBytePlusContent({ prompt: 'Use each reference', imageUrls, maxImages: 30 });

    assert.equal(result.content.filter(({ role }) => role === 'reference_image').length, 6);
    assert.deepEqual(result.content.slice(1).map(({ image_url }) => image_url.url), imageUrls);
    assert.deepEqual(result.extraBody, { omni_reference_task_type: 'reference' });
    assert.ok(Buffer.byteLength(JSON.stringify(result.content)) < 64 * 1024 * 1024);
});

test('generation route request-size guard rejects bodies over 4 MiB', async () => {
    const {
        BYTEPLUS_GENERATION_BODY_LIMIT_BYTES,
        isBytePlusGenerationBodyTooLarge,
    } = await import('../app/api/byteplus/video/content.mjs');

    assert.equal(isBytePlusGenerationBodyTooLarge(BYTEPLUS_GENERATION_BODY_LIMIT_BYTES), false);
    assert.equal(isBytePlusGenerationBodyTooLarge(BYTEPLUS_GENERATION_BODY_LIMIT_BYTES + 1), true);
});

test('BytePlus reference images upload directly to signed storage and return its public URL', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        if (String(url).startsWith('/api/byteplus/upload-url')) {
            return {
                ok: true,
                json: async () => ({
                    url: 'https://images.s3.amazonaws.com',
                    public_url: 'https://images.s3.amazonaws.com/reference.png',
                    fields: { key: 'reference.png', policy: 'signed-policy' },
                }),
            };
        }
        return { ok: true, type: 'opaque' };
    };

    try {
        const file = new File(['image-bytes'], 'reference.png', { type: 'image/png' });
        const uploadedUrl = await uploadBytePlusReferenceImage(file);

        assert.equal(uploadedUrl, 'https://images.s3.amazonaws.com/reference.png');
        assert.equal(requests.length, 2);
        assert.equal(requests[0].options.headers, undefined);
        assert.equal(requests[1].url, 'https://images.s3.amazonaws.com');
        assert.equal(requests[1].options.mode, 'no-cors');
        assert.equal(requests[1].options.body.get('x-proxy-target-url'), null);
        assert.equal(requests[1].options.body.get('file').name, 'reference.png');
    } finally {
        global.fetch = originalFetch;
    }
});

test('signed upload route reports missing MUAPI_KEY configuration without calling MuAPI', async () => {
    const { requestMuapiSignedUpload } = await import('../app/api/byteplus/upload-url/muapiUploadUrl.mjs');
    let called = false;

    const result = await requestMuapiSignedUpload({
        apiKey: '',
        fileName: 'reference.png',
        contentType: 'image/png',
        fetchImpl: async () => { called = true; },
    });

    assert.equal(result.status, 503);
    assert.match(result.body.error, /MUAPI_KEY is not configured/);
    assert.equal(called, false);
});

test('signed upload route authenticates upstream with MUAPI_KEY and redacts it from responses', async () => {
    const { requestMuapiSignedUpload } = await import('../app/api/byteplus/upload-url/muapiUploadUrl.mjs');
    let sentKey;
    const secret = 'server-only-muapi-key';

    const result = await requestMuapiSignedUpload({
        apiKey: secret,
        fileName: 'reference.png',
        contentType: 'image/png',
        fetchImpl: async (url, options) => {
            sentKey = options.headers['x-api-key'];
            assert.match(url, /get_file_upload_url\?file_name=reference.png&content_type=image%2Fpng/);
            return {
                status: 200,
                text: async () => JSON.stringify({ url: 'https://storage.example', token: secret }),
            };
        },
    });

    assert.equal(sentKey, secret);
    assert.equal(result.status, 200);
    assert.equal(result.body.token, '[redacted]');
});