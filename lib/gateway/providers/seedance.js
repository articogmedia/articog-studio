import { toDataUrl, saveFromUrl } from '../storage';
const BASE = process.env.ARK_BASE_URL || 'https://ark.ap-southeast.bytepluses.com/api/v3';
function key() {
  if (!process.env.ARK_API_KEY) throw new Error('ARK_API_KEY is not set');
  return process.env.ARK_API_KEY;
}
async function ark(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Seedance error ${res.status}`);
  return data;
}
export async function start({ input, entry }) {
  const images = [input.image_url, ...(input.images_list || [])].filter(Boolean);
  const content = [{ type: 'text', text: input.prompt || '' }];
  for (let i = 0; i < images.length; i++) {
    let role = entry.imageRole || 'reference_image';
    if (role === 'first_last') role = i === 0 ? 'first_frame' : 'last_frame';
    // Data URLs work in local dev. Phase 8 will switch this to public R2 URLs.
    content.push({ type: 'image_url', image_url: { url: await toDataUrl(images[i]) }, role });
  }
  const body = {
    model: entry.model,
    content,
    ratio: input.aspect_ratio || '16:9',
    duration: Number(input.duration) || 5,
    generate_audio: input.generate_audio ?? true,
    watermark: false,
  };
  if (input.resolution) body.resolution = String(input.resolution).toLowerCase();
  if (input.seed != null && Number(input.seed) !== -1) body.seed = Number(input.seed);
  const task = await ark('/contents/generations/tasks', { method: 'POST', body: JSON.stringify(body) });
  return { externalId: task.id };
}
export async function check({ externalId }) {
  const task = await ark(`/contents/generations/tasks/${externalId}`);
  if (task.status === 'succeeded') {
    const url = await saveFromUrl(task.content.video_url, 'mp4'); // provider link expires in 24h
    return { status: 'completed', outputs: [url], usage: task.usage };
  }
  if (['failed', 'cancelled', 'expired'].includes(task.status)) {
    return { status: 'failed', error: task.error?.message || `Seedance task ${task.status}` };
  }
  return { status: 'processing' };
}
