import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
const DIR = path.join(process.cwd(), '.data', 'files');
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' };
export const mimeFor = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
export async function saveBuffer(buffer, ext) {
  await fs.mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(DIR, name), buffer);
  return `/api/files/${name}`;
}
export async function saveFromUrl(url, ext) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return saveBuffer(Buffer.from(await res.arrayBuffer()), ext);
}
export async function readAsBuffer(url) {
  const marker = '/api/files/';
  if (url.includes(marker)) {
    const name = path.basename(url.split(marker).pop());
    return { buffer: await fs.readFile(path.join(DIR, name)), mime: mimeFor(name) };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch reference file: ${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/png' };
}
export async function toDataUrl(url) {
  const { buffer, mime } = await readAsBuffer(url);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
