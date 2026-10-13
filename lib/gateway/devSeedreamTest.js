const ENDPOINT = 'seedream-5.0-pro';
const ASPECT_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9']);
const RESOLUTIONS = new Set(['1K', '2K']);

export function isDevSeedreamTestEnabled(env = process.env) {
  return env.NODE_ENV === 'development' && env.ARTICOG_ENABLE_SEEDREAM_DEV_TEST === 'true';
}

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function sanitizeError(error, secret) {
  let message = typeof error?.message === 'string' ? error.message : 'Seedream provider request failed.';
  if (secret) message = message.split(secret).join('[redacted]');
  return message.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]');
}

export function createDevSeedreamTestHandler({ isEnabled, hasApiKey, generate }) {
  return async function POST(request) {
    if (!isEnabled()) return response({ ok: false, error: 'Not found.' }, 404);
    if (!hasApiKey()) {
      return response({
        ok: false,
        endpoint: ENDPOINT,
        error: 'Seedream test is not configured. Set ARK_API_KEY in the local server environment.',
      }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return response({ ok: false, endpoint: ENDPOINT, error: 'Request body must be valid JSON.' }, 400);
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const aspectRatio = body?.aspect_ratio || '1:1';
    const resolution = String(body?.resolution || '2K').toUpperCase();
    if (!prompt || prompt.length > 4000) {
      return response({ ok: false, endpoint: ENDPOINT, error: 'Provide a prompt of 1 to 4000 characters.' }, 400);
    }
    if (!ASPECT_RATIOS.has(aspectRatio)) {
      return response({ ok: false, endpoint: ENDPOINT, error: 'Unsupported aspect ratio.' }, 400);
    }
    if (!RESOLUTIONS.has(resolution)) {
      return response({ ok: false, endpoint: ENDPOINT, error: 'Resolution must be 1K or 2K.' }, 400);
    }

    try {
      const result = await generate({ prompt, aspect_ratio: aspectRatio, resolution });
      return response({
        ok: true,
        endpoint: ENDPOINT,
        status: result.status,
        outputs: result.outputs || [],
        usage: result.usage || null,
      });
    } catch (error) {
      return response({
        ok: false,
        endpoint: ENDPOINT,
        status: 'failed',
        error: sanitizeError(error, process.env.ARK_API_KEY),
      }, 502);
    }
  };
}