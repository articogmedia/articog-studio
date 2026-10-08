import { NextResponse } from 'next/server';
import { saveBuffer } from '@/lib/gateway/storage';

export const runtime = 'nodejs';
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/wav'];
const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(request) {
  const form = await request.formData();
  const file = form.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ detail: 'No file received' }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ detail: `File type ${file.type} not allowed` }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ detail: 'File too large (max 30 MB)' }, { status: 400 });
  }

  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase();
  const relative = await saveBuffer(Buffer.from(await file.arrayBuffer()), ext);
  return NextResponse.json({ url: new URL(relative, request.url).toString() });
}
