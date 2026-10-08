import { readAsBuffer, saveBuffer } from '../storage';
const BASE = 'https://generativelanguage.googleapis.com/v1';
export async function start({ input, entry }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const parts = [{ text: input.prompt || '' }];
  const refs = [input.image_url, ...(input.images_list || [])].filter(Boolean);
  for (const url of refs) {
    const { buffer, mime } = await readAsBuffer(url);
    parts.push({ inline_data: { mime_type: mime, data: buffer.toString('base64') } });
  }
  const image = {};
  if (input.aspect_ratio) image.aspectRatio = input.aspect_ratio;
  if (input.resolution) image.imageSize = String(input.resolution).toUpperCase(); // '1K','2K','4K' (capital K)
  const res = await fetch(`${BASE}/models/${entry.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], responseFormat: { image } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error ${res.status}`);
  const outParts = data.candidates?.[0]?.content?.parts || [];
  const images = outParts.filter((p) => (p.inlineData || p.inline_data) && !p.thought);
  if (!images.length) throw new Error('No image returned. The prompt may have been blocked by safety filters.');
  const outputs = [];
  for (const p of images) {
    const d = p.inlineData || p.inline_data;
    outputs.push(await saveBuffer(Buffer.from(d.data, 'base64'), 'png'));
  }
  return { outputs };
}
// NOTE for later: if aspect ratio or size is ignored, switch `responseFormat: { image }`
// to `imageConfig: image` and retest. Do not change this now.
