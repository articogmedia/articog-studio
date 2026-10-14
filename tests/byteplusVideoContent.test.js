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

const storageConfig = {
    supabaseUrl: 'https://project-ref.supabase.co',
    serviceRoleKey: 'server-only-supabase-service-role',
    bucket: 'byteplus-seedance-references',
};
const privateBucket = {
    id: 'byteplus-seedance-references',
    public: false,
    file_size_limit: 29_000_000,
    allowed_mime_types: ['image/png', 'image/jpeg'],
};
const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).buffer,
});

test('Supabase upload tickets require server storage configuration', async () => {
    const { createSupabaseUploadTicket } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');

    await assert.rejects(createSupabaseUploadTicket({
        fileName: 'reference.png', contentType: 'image/png', size: 100,
    }), (error) => error.status === 503 && /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/.test(error.message));
});

test('Supabase upload tickets reject invalid MIME types and oversized images', async () => {
    const { createSupabaseUploadTicket, MAX_REFERENCE_IMAGE_BYTES } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    const common = { ...storageConfig, fileName: 'reference.png', size: 100, fetchImpl: async () => { throw new Error('must not call storage'); } };

    await assert.rejects(createSupabaseUploadTicket({ ...common, contentType: 'image/svg+xml' }), /Unsupported image type/);
    await assert.rejects(createSupabaseUploadTicket({ ...common, contentType: 'image/png', size: MAX_REFERENCE_IMAGE_BYTES + 1 }), /smaller than 30 MB/);
});

test('Supabase upload tickets reject public or unbounded buckets', async () => {
    const { createSupabaseUploadTicket } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    const responseFor = (bucket) => async () => jsonResponse(bucket);

    await assert.rejects(createSupabaseUploadTicket({
        ...storageConfig,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        fetchImpl: responseFor({ ...privateBucket, public: true }),
    }), /bucket must be private/);
    await assert.rejects(createSupabaseUploadTicket({
        ...storageConfig,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        fetchImpl: responseFor({ ...privateBucket, file_size_limit: null }),
    }), /file size limit/);
});

test('Supabase upload failures return a safe error without exposing storage credentials', async () => {
    const { createSupabaseUploadTicket } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    let callIndex = 0;

    await assert.rejects(createSupabaseUploadTicket({
        ...storageConfig,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        id: '12345678-1234-4234-8234-123456789abc',
        fetchImpl: async () => ++callIndex === 1
            ? jsonResponse(privateBucket)
            : jsonResponse({ message: storageConfig.serviceRoleKey }, 500),
    }), (error) => error.status === 502 && !error.message.includes(storageConfig.serviceRoleKey));
});

test('Supabase rejects uploaded files whose bytes do not match their image MIME type', async () => {
    const { createSupabaseReadUrl } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    let calls = 0;

    await assert.rejects(createSupabaseReadUrl({
        ...storageConfig,
        path: 'seedance/12345678-1234-4234-8234-123456789abc.png',
        fetchImpl: async () => {
            calls += 1;
            return calls === 1
                ? jsonResponse({ metadata: { size: 12, mimetype: 'image/png' } })
                : { ok: true, arrayBuffer: async () => new TextEncoder().encode('<svg/>').buffer };
        },
    }), /not a valid image/);
    assert.equal(calls, 2);
});

test('BytePlus reference image uploads go directly to private Supabase storage and return a signed read URL', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        if (String(url) === '/api/byteplus/upload-url') {
            const body = JSON.parse(options.body);
            return jsonResponse(body.action === 'create'
                ? { path: 'seedance/12345678-1234-4234-8234-123456789abc.png', uploadUrl: 'https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/path?token=one-time' }
                : { signedUrl: 'https://project-ref.supabase.co/storage/v1/object/sign/bucket/path?token=temporary-read' });
        }
        return { ok: true, status: 200, text: async () => '' };
    };

    try {
        const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'reference.png', { type: 'image/png' });
        const signedUrl = await uploadBytePlusReferenceImage(file);

        assert.equal(signedUrl, 'https://project-ref.supabase.co/storage/v1/object/sign/bucket/path?token=temporary-read');
        assert.equal(requests.length, 3);
        assert.equal(JSON.parse(requests[0].options.body).action, 'create');
        assert.equal(requests[1].url, 'https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/path?token=one-time');
        assert.equal(requests[1].options.method, 'PUT');
        assert.equal(requests[1].options.body.get('').name, 'reference.png');
        assert.equal(JSON.parse(requests[2].options.body).action, 'complete');
        assert.ok(requests.every(({ options }) => !JSON.stringify(options.headers || {}).includes(storageConfig.serviceRoleKey)));
    } finally {
        global.fetch = originalFetch;
    }
});

test('BytePlus reference uploader reports Supabase upload failures without returning response data', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
        calls += 1;
        if (calls === 1) {
            return jsonResponse({
                path: 'seedance/12345678-1234-4234-8234-123456789abc.png',
                uploadUrl: 'https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/path?token=one-time',
            });
        }
        return { ok: false, status: 413, text: async () => 'private storage response details' };
    };

    try {
        const file = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' });
        await assert.rejects(uploadBytePlusReferenceImage(file), (error) => {
            assert.match(error.message, /Supabase image upload failed \(413\)/);
            assert.doesNotMatch(error.message, /private storage response details/);
            return true;
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('Supabase upload ticket uses server credentials and never returns them', async () => {
    const { createSupabaseUploadTicket } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    let callIndex = 0;
    const result = await createSupabaseUploadTicket({
        ...storageConfig,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        id: '12345678-1234-4234-8234-123456789abc',
        fetchImpl: async (url, options) => {
            assert.equal(options.headers.apikey, storageConfig.serviceRoleKey);
            assert.equal(options.headers.Authorization, `Bearer ${storageConfig.serviceRoleKey}`);
            callIndex += 1;
            return callIndex === 1
                ? jsonResponse(privateBucket)
                : jsonResponse({ url: '/object/upload/sign/byteplus-seedance-references/seedance/file.png?token=upload-token' });
        },
    });

    assert.equal(result.path, 'seedance/12345678-1234-4234-8234-123456789abc.png');
    assert.match(result.uploadUrl, /token=upload-token/);
    assert.equal(JSON.stringify(result).includes(storageConfig.serviceRoleKey), false);
});