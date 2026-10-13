import { toDataUrl, saveFromUrl } from '../storage';

const DEFAULT_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const MODEL_IDS = {
  'seedream-5.0': 'seedream-5-0-260128',
  'seedream-5.0-pro': 'seedream-5-0-pro-260628',
  'seedream-5.0-flash': 'seedream-5-0-flash-260915',
};
const SIZES = {
  '1K': {
    '1:1': '1024x1024',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '3:2': '1248x832',
    '2:3': '832x1248',
    '21:9': '1512x648',
  },
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
};

export function getEntry(endpoint, model) {
  const isEdit = typeof endpoint === 'string' && endpoint.endsWith('-edit');
  const baseEndpoint = isEdit ? endpoint.slice(0, -5) : endpoint;
  const mappedModel = MODEL_IDS[baseEndpoint];
  if (!mappedModel) return null;

  return { provider: 'seedream', model: model || mappedModel, edit: isEdit };
}

function resolveJob(inputOrJob, context) {
  const input = inputOrJob?.input ?? inputOrJob ?? {};
  const endpoint = context.endpoint || inputOrJob?.endpoint;
  const entry = context.entry || inputOrJob?.entry || getEntry(endpoint, context.model || inputOrJob?.model);
  if (!entry) throw new Error(`Unsupported Seedream endpoint: ${endpoint || 'unknown'}`);
  return { input, entry };
}

function getApiKey() {
  if (!process.env.ARK_API_KEY) throw new Error('ARK_API_KEY is not set');
  return process.env.ARK_API_KEY;
}

function redactApiKey(message, apiKey) {
  return String(message).split(apiKey).join('[redacted]');
}

function getErrorMessage(data, rawBody, status, apiKey) {
  const error = data?.error;
  const message = typeof error === 'string'
    ? error
    : error?.message || error?.detail || data?.message || rawBody || `HTTP ${status}`;
  return redactApiKey(message, apiKey);
}

async function requestImages(body, apiKey) {
  const base = (process.env.ARK_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const response = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }
  return { response, data, rawBody };
}

export async function start(inputOrJob, context = {}) {
  const { input, entry } = resolveJob(inputOrJob, context);
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
    throw new Error('A non-empty prompt is required for Seedream image generation');
  }

  const imageRefs = [input.image_url, ...(Array.isArray(input.images_list) ? input.images_list : [])].filter(Boolean);
  const maxReferences = entry.model === MODEL_IDS['seedream-5.0-pro'] ? 10 : 14;
  if (imageRefs.length > maxReferences) {
    throw new Error(`Seedream accepts at most ${maxReferences} reference images for this model`);
  }

  const tier = String(input.resolution || '2K').toUpperCase();
  if (!Object.hasOwn(SIZES, tier)) {
    throw new Error('Seedream resolution must be 1K or 2K');
  }
  const aspectRatio = input.aspect_ratio || '1:1';
  const size = SIZES[tier][aspectRatio];
  if (!size) throw new Error(`Seedream does not support the ${aspectRatio} aspect ratio`);

  const apiKey = getApiKey();
  const body = {
    model: entry.model,
    prompt: input.prompt.trim(),
    response_format: 'url',
    watermark: false,
    size,
  };
  if (imageRefs.length > 0) {
    const images = await Promise.all(imageRefs.map((url) => toDataUrl(url)));
    body.image = images.length === 1 ? images[0] : images;
  }
  if (input.output_format === 'png') body.output_format = 'png';
  if (input.seed != null && Number(input.seed) !== -1) {
    const seed = Number(input.seed);
    if (!Number.isFinite(seed)) throw new Error('Seedream seed must be a number');
    body.seed = seed;
  }

  let result = await requestImages(body, apiKey);
  if (
    result.response.status === 400 &&
    /size|pixel|resolution/i.test(getErrorMessage(result.data, result.rawBody, result.response.status, apiKey))
  ) {
    result = await requestImages({ ...body, size: tier }, apiKey);
  }
  if (!result.response.ok) {
    throw new Error(`Seedream API error: ${getErrorMessage(result.data, result.rawBody, result.response.status, apiKey)}`);
  }

  const items = result.data?.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Seedream response did not include any generated images');
  }

  const itemError = items.find((item) => item?.error);
  if (itemError) {
    throw new Error(`Seedream image generation failed: ${getErrorMessage(itemError, '', 'unknown', apiKey)}`);
  }

  const urls = items.map((item) => item?.url).filter(Boolean);
  if (urls.length === 0) throw new Error('Seedream response did not include any image URLs');

  const save = context.saveFromUrl || saveFromUrl;
  const extension = input.output_format === 'png' ? 'png' : 'jpeg';
  const outputs = await Promise.all(urls.map((url) => save(url, extension)));
  return { status: 'completed', outputs, usage: result.data.usage };
}