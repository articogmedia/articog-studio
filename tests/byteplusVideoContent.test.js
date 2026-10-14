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

test('BytePlus task creation response contains the documented task ID', async () => {
    const { extractBytePlusTaskId } = await import('../app/api/byteplus/video/taskResponse.mjs');

    assert.equal(extractBytePlusTaskId({ id: 'cgt-20261014-abc123' }), 'cgt-20261014-abc123');
    assert.equal(extractBytePlusTaskId({ task_id: 'cgt-20261014-def456' }), 'cgt-20261014-def456');
    assert.equal(extractBytePlusTaskId({}), null);
});

test('BytePlus queued and running task responses remain pending', async () => {
    const { parseBytePlusTaskResponse } = await import('../app/api/byteplus/video/taskResponse.mjs');

    assert.deepEqual(parseBytePlusTaskResponse({ id: 'cgt-1', status: 'queued' }), { id: 'cgt-1', status: 'queued' });
    assert.deepEqual(parseBytePlusTaskResponse({ id: 'cgt-1', status: 'running' }), { id: 'cgt-1', status: 'running' });
});

test('BytePlus succeeded task parses the documented content.video_url object', async () => {
    const { parseBytePlusTaskResponse } = await import('../app/api/byteplus/video/taskResponse.mjs');

    assert.deepEqual(parseBytePlusTaskResponse({
        id: 'cgt-1',
        status: 'succeeded',
        content: { video_url: 'https://cdn.byteplus.example/generated.mp4', last_frame_url: null, file_url: null },
    }), {
        id: 'cgt-1',
        status: 'succeeded',
        url: 'https://cdn.byteplus.example/generated.mp4',
    });
});

test('BytePlus failed task preserves provider code and message for the user', async () => {
    const { parseBytePlusTaskResponse } = await import('../app/api/byteplus/video/taskResponse.mjs');

    assert.deepEqual(parseBytePlusTaskResponse({
        id: 'cgt-1',
        status: 'failed',
        error: { code: 'InvalidParameter.TaskTypeMismatch', message: 'The task type does not match the input.' },
    }), {
        id: 'cgt-1',
        status: 'failed',
        code: 'InvalidParameter.TaskTypeMismatch',
        error: 'The task type does not match the input.',
    });
});

test('BytePlus succeeded task without output returns an actionable diagnostic', async () => {
    const { parseBytePlusTaskResponse } = await import('../app/api/byteplus/video/taskResponse.mjs');

    assert.deepEqual(parseBytePlusTaskResponse({ id: 'cgt-1', status: 'succeeded', content: {} }), {
        id: 'cgt-1',
        status: 'succeeded',
        error: 'BytePlus marked this task succeeded but returned no content.video_url. Check the task in the BytePlus console and retry if needed.',
    });
});

test('BytePlus polling waits through running and returns only after success includes a URL', async () => {
    const { pollBytePlusVideoTask } = await import('../packages/studio/src/byteplus.js');
    const statuses = [
        { id: 'cgt-1', status: 'queued' },
        { id: 'cgt-1', status: 'running' },
        { id: 'cgt-1', status: 'succeeded', url: 'https://cdn.byteplus.example/video.mp4' },
    ];
    const waits = [];
    const result = await pollBytePlusVideoTask('cgt-1', {
        getTask: async () => statuses.shift(),
        waitImpl: async (ms) => waits.push(ms),
        pollIntervalMs: 10_000,
        timeoutMs: 30 * 60 * 1000,
    });

    assert.equal(result.url, 'https://cdn.byteplus.example/video.mp4');
    assert.equal(result.request_id, 'cgt-1');
    assert.deepEqual(waits, [10_000, 10_000]);
});

test('BytePlus polling reports provider failure and completed tasks with no URL', async () => {
    const { pollBytePlusVideoTask } = await import('../packages/studio/src/byteplus.js');

    await assert.rejects(pollBytePlusVideoTask('cgt-failed', {
        getTask: async () => ({ id: 'cgt-failed', status: 'failed', code: 'TaskFailed', error: 'Provider rejected the task.' }),
        waitImpl: async () => {},
    }), /TaskFailed: Provider rejected the task/);
    await assert.rejects(pollBytePlusVideoTask('cgt-empty', {
        getTask: async () => ({ id: 'cgt-empty', status: 'succeeded', error: 'Missing content.video_url. Check task details.' }),
        waitImpl: async () => {},
    }), /Missing content.video_url/);
    await assert.rejects(pollBytePlusVideoTask('cgt-expired', {
        getTask: async () => ({ id: 'cgt-expired', status: 'expired', error: 'Task expired.' }),
        waitImpl: async () => {},
    }), /Task expired/);
});

const storageConfig = {
    supabaseUrl: 'https://project-ref.supabase.co',
    serviceRoleKey: 'server-only-supabase-service-role',
    bucket: 'byteplus-images',
};
const privateBucket = {
    id: 'byteplus-images',
    public: false,
    file_size_limit: 29 * 1024 * 1024,
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
    await assert.rejects(createSupabaseUploadTicket({ ...common, contentType: 'image/gif' }), /Use JPEG, PNG, or WebP/);
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
    await assert.rejects(createSupabaseUploadTicket({
        ...storageConfig,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        fetchImpl: responseFor({ ...privateBucket, file_size_limit: 30 * 1024 * 1024 + 1 }),
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

test('BytePlus reference uploader explains when a signed upload URL has expired', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    global.fetch = async (url) => String(url) === '/api/byteplus/upload-url'
        ? jsonResponse({
            path: 'seedance/12345678-1234-4234-8234-123456789abc.png',
            uploadUrl: 'https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/path?token=expired',
        })
        : { ok: false, status: 403 };

    try {
        const file = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' });
        await assert.rejects(uploadBytePlusReferenceImage(file), /signed upload URL expired or was rejected/);
    } finally {
        global.fetch = originalFetch;
    }
});

test('BytePlus reference uploader identifies a failed Vercel upload-ticket request', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new TypeError('Failed to fetch'); };

    try {
        const file = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' });
        await assert.rejects(uploadBytePlusReferenceImage(file), /Supabase upload-ticket request failed: Failed to fetch/);
    } finally {
        global.fetch = originalFetch;
    }
});

test('BytePlus reference uploader identifies a failed direct Supabase network request without exposing its signed URL', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    const signedUrl = 'https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/path?token=private-ticket';
    let calls = 0;
    global.fetch = async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({ path: 'seedance/12345678-1234-4234-8234-123456789abc.png', uploadUrl: signedUrl });
        throw new TypeError('Failed to fetch');
    };

    try {
        const file = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' });
        await assert.rejects(uploadBytePlusReferenceImage(file), (error) => {
            assert.match(error.message, /Supabase direct upload failed before an HTTP response was received/);
            assert.doesNotMatch(error.message, /private-ticket|project-ref/);
            return true;
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('six reference files each receive a signed upload and private read URL', async () => {
    const { uploadBytePlusReferenceImage } = await import('../packages/studio/src/byteplus.js');
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
        const urlString = String(url);
        calls.push({ url: urlString, options });
        if (urlString === '/api/byteplus/upload-url') {
            const body = JSON.parse(options.body);
            if (body.action === 'create') {
                const suffix = body.fileName.replace('.png', '');
                return jsonResponse({
                    path: `seedance/${suffix}-1234-4234-8234-123456789abc.png`,
                    uploadUrl: `https://project-ref.supabase.co/storage/v1/object/upload/sign/bucket/${suffix}.png?token=upload`,
                });
            }
            return jsonResponse({ signedUrl: `https://project-ref.supabase.co/storage/v1/object/sign/bucket/${JSON.parse(options.body).path}?token=read` });
        }
        return { ok: true, status: 200 };
    };

    try {
        const files = Array.from({ length: 6 }, (_, index) => new File(
            [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
            `ref-${index + 1}.png`,
            { type: 'image/png' },
        ));
        const signedUrls = await Promise.all(files.map((file) => uploadBytePlusReferenceImage(file)));

        assert.equal(signedUrls.length, 6);
        assert.equal(new Set(signedUrls).size, 6);
        assert.equal(calls.filter(({ url }) => url === '/api/byteplus/upload-url').length, 12);
        assert.equal(calls.filter(({ options }) => options.method === 'PUT').length, 6);
    } finally {
        global.fetch = originalFetch;
    }
});

test('Supabase upload ticket uses server credentials and never returns them', async () => {
    const { createSupabaseUploadTicket } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    let callIndex = 0;
    const result = await createSupabaseUploadTicket({
        supabaseUrl: storageConfig.supabaseUrl,
        serviceRoleKey: storageConfig.serviceRoleKey,
        fileName: 'reference.png', contentType: 'image/png', size: 100,
        id: '12345678-1234-4234-8234-123456789abc',
        fetchImpl: async (url, options) => {
            assert.equal(options.headers.apikey, storageConfig.serviceRoleKey);
            assert.equal(options.headers.Authorization, `Bearer ${storageConfig.serviceRoleKey}`);
            callIndex += 1;
            if (callIndex === 1) assert.match(url, /\/bucket\/byteplus-images$/);
            if (callIndex === 2) assert.match(url, /\/byteplus-images\/seedance\//);
            return callIndex === 1
                ? jsonResponse(privateBucket)
                : jsonResponse({ url: '/object/upload/sign/byteplus-images/seedance/file.png?token=upload-token' });
        },
    });

    assert.equal(result.path, 'seedance/12345678-1234-4234-8234-123456789abc.png');
    assert.match(result.uploadUrl, /token=upload-token/);
    assert.equal(JSON.stringify(result).includes(storageConfig.serviceRoleKey), false);
});

test('Supabase signed read URLs remain valid for 24 hours for BytePlus retrieval', async () => {
    const { createSupabaseReadUrl, SIGNED_READ_URL_TTL_SECONDS } = await import('../app/api/byteplus/upload-url/supabaseStorage.mjs');
    let signRequest;
    let requestCount = 0;
    const signedUrl = await createSupabaseReadUrl({
        ...storageConfig,
        path: 'seedance/12345678-1234-4234-8234-123456789abc.png',
        fetchImpl: async (url, options) => {
            requestCount += 1;
            if (requestCount === 1) return jsonResponse({ metadata: { size: 12, mimetype: 'image/png' } });
            if (requestCount === 2) return jsonResponse({ value: true });
            signRequest = JSON.parse(options.body);
            return jsonResponse({ signedURL: '/object/sign/byteplus-images/seedance/ref.png?token=read' });
        },
    });

    assert.equal(SIGNED_READ_URL_TTL_SECONDS, 24 * 60 * 60);
    assert.equal(signRequest.expiresIn, 24 * 60 * 60);
    assert.equal(new URL(signedUrl).protocol, 'https:');
    assert.match(signedUrl, /token=read/);
});