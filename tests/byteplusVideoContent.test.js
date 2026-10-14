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