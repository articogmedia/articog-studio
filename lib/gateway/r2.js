import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

let s3;

function client() {
  if (!s3) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error('R2 env vars are not set');
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' };
const EXT = Object.fromEntries(Object.entries(MIME).map(([ext, type]) => [type, ext]));

export const mimeFor = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
export const extFor = (type) => EXT[type];
const newKey = (folder, ext) => `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

export async function saveBuffer(buffer, ext, folder = 'outputs') {
  const Key = newKey(folder, ext);
  await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key, Body: buffer, ContentType: mimeFor(Key) }));
  return `${process.env.R2_PUBLIC_BASE_URL}/${Key}`;
}

export async function saveFromUrl(url, ext) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return saveBuffer(Buffer.from(await res.arrayBuffer()), ext);
}

export async function readAsBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch reference file: ${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/png' };
}

export async function toDataUrl(url) {
  const { buffer, mime } = await readAsBuffer(url);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function createUploadUrl({ userId, type, size }) {
  const Key = newKey(`uploads/${userId}`, extFor(type));
  const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key, ContentType: type, ContentLength: size });
  const uploadUrl = await getSignedUrl(client(), command, { expiresIn: 600 });
  return { uploadUrl, publicUrl: `${process.env.R2_PUBLIC_BASE_URL}/${Key}` };
}
