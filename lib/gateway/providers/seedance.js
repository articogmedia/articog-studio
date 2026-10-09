import { toDataUrl, saveFromUrl } from '../storage';
const DEFAULT_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const SEEDANCE_25_MODEL = 'dreamina-seedance-2-5-260628';
const SEEDANCE_20_MODEL = 'dreamina-seedance-2-0-260128';

export function getEntry(endpoint, model) {
  const variant = /^seedance-2\.5-(?:(?:intl|spicy)-)?(text-to-video|image-to-video|first-last-frame|omni-reference)(?:-(480p|1080p))?$/.exec(endpoint || '');
  if (variant) {
    const [, workflow, resolution] = variant;
    return {
      provider: 'seedance',
      model: model || SEEDANCE_25_MODEL,
      ...(workflow === 'image-to-video' && { imageRole: 'first_frame' }),
      ...(workflow === 'first-last-frame' && { imageRole: 'first_last' }),
      ...(workflow === 'omni-reference' && { imageRole: 'reference_image' }),
      ...(resolution && { resolution }),
    };
  }

  const legacyEntries = {
    'seedance-v2.0-t2v': { model: SEEDANCE_20_MODEL },
    'seedance-2-first-last-frame': { model: SEEDANCE_20_MODEL, imageRole: 'first_last' },
    'seedance-2.0-omni-reference': { model: SEEDANCE_20_MODEL, imageRole: 'reference_image' },
  };
  const entry = legacyEntries[endpoint];
  return entry ? { provider: 'seedance', ...entry, model: model || entry.model } : null;
}

function key() {
  if (!process.env.ARK_API_KEY) throw new Error('ARK_API_KEY is not set');
  return process.env.ARK_API_KEY;
}
async function ark(path, init = {}) {
  const base = (process.env.ARK_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Seedance error ${res.status}`);
  return data;
}

function resolveJob(inputOrJob, context) {
  const input = inputOrJob?.input ?? inputOrJob ?? {};
  const endpoint = context.endpoint || inputOrJob?.endpoint;
  const entry = context.entry || inputOrJob?.entry || getEntry(endpoint, context.model || inputOrJob?.model);
  if (!entry) throw new Error(`Unsupported Seedance endpoint: ${endpoint || 'unknown'}`);
  return { input, entry };
}

export async function start(inputOrJob, context = {}) {
  const { input, entry } = resolveJob(inputOrJob, context);
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
    throw new Error('A non-empty prompt is required for Seedance video generation');
  }

  const images = [input.image_url, ...(Array.isArray(input.images_list) ? input.images_list : [])].filter(Boolean);
  const content = [{ type: 'text', text: input.prompt || '' }];
  for (let i = 0; i < images.length; i++) {
    let role = entry.imageRole || 'reference_image';
    if (role === 'first_last') role = i === 0 ? 'first_frame' : 'last_frame';
    content.push({ type: 'image_url', image_url: { url: await toDataUrl(images[i]) }, role });
  }

  const duration = Number(input.duration) || 5;
  const maxDuration = entry.model === SEEDANCE_25_MODEL ? 30 : 15;
  if (duration < 4 || duration > maxDuration) {
    throw new Error(`Seedance duration must be between 4 and ${maxDuration} seconds`);
  }
  const resolution = String(input.resolution || entry.resolution || '').toLowerCase();
  const supportedResolutions = entry.model === SEEDANCE_25_MODEL
    ? ['480p', '720p', '1080p']
    : ['480p', '720p', '1080p', '4k'];
  if (resolution && !supportedResolutions.includes(resolution)) {
    throw new Error(`Seedance does not support ${resolution} resolution`);
  }

  const body = {
    model: entry.model,
    content,
    ratio: input.aspect_ratio || '16:9',
    duration,
    generate_audio: input.generate_audio ?? true,
    watermark: false,
  };
  if (resolution) body.resolution = resolution;
  if (input.seed != null && Number(input.seed) !== -1) body.seed = Number(input.seed);
  const task = await ark('/contents/generations/tasks', { method: 'POST', body: JSON.stringify(body) });
  if (!task.id) throw new Error('Seedance response did not include a task ID');
  return { externalId: task.id };
}

export async function check({ externalId }, { saveVideo = saveFromUrl } = {}) {
  if (!externalId) throw new Error('Seedance task ID is missing');
  const task = await ark(`/contents/generations/tasks/${encodeURIComponent(externalId)}`);
  if (['succeeded', 'completed'].includes(task.status)) {
    const videoUrl = task.content?.video_url;
    if (!videoUrl) throw new Error('Seedance task completed without a video URL');
    const url = await saveVideo(videoUrl, 'mp4');
    return { status: 'completed', outputs: [url], usage: task.usage };
  }
  if (['failed', 'cancelled', 'expired'].includes(task.status)) {
    return { status: 'failed', error: task.error?.message || task.message || `Seedance task ${task.status}` };
  }
  return { status: 'processing' };
}
