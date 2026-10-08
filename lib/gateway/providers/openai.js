import { readAsBuffer, saveBuffer } from '../storage';
const SIZES = { '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536', '16:9': '1536x864', '9:16': '864x1536' };
const auth = () => ({ Authorization: `Bearer ${process.env.OPENAI_API_KEY}` });
export async function start({ input, entry }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const refs = [input.image_url, ...(input.images_list || [])].filter(Boolean);
  const size = SIZES[input.aspect_ratio];
  let res;
  if (refs.length) {
    const form = new FormData();
    form.append('model', entry.model);
    form.append('prompt', input.prompt || '');
    if (size) form.append('size', size);
    if (input.quality) form.append('quality', input.quality);
    for (let i = 0; i < refs.length; i++) {
      const { buffer, mime } = await readAsBuffer(refs[i]);
      form.append('image[]', new Blob([buffer], { type: mime }), `ref-${i}.png`);
    }
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth(), body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: entry.model, prompt: input.prompt, ...(size && { size }), ...(input.quality && { quality: input.quality }) }),
    });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`);
  const outputs = [];
  for (const img of data.data || []) outputs.push(await saveBuffer(Buffer.from(img.b64_json, 'base64'), 'png'));
  return { outputs };
}
// NOTE for later: confirm the size table is valid for the 2.5 models; if not, fall
// back to 1024x1024, 1536x1024, 1024x1536. Do not change this now.
