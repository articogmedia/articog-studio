const test = require('node:test');
const assert = require('node:assert/strict');

test('image upload in From prompt mode explains how to switch to an image workflow', async () => {
    const { reportUnavailableReferenceUpload } = await import('../packages/studio/src/videoUploadMessages.js');
    let imageInputMessage = '';
    const errors = [];
    const message = 'Switch the mode from "From prompt" to "Animate image", "Start & end frames" or "Use references" to add images.';

    reportUnavailableReferenceUpload(
        'image',
        { id: 'seedance-2.5', variants: { i2v: [{ id: 'seedance-2.5-i2v' }] } },
        (value) => { imageInputMessage = value; },
        (value) => errors.push(value),
    );

    assert.equal(imageInputMessage, message);
    assert.deepEqual(errors, [message]);
});