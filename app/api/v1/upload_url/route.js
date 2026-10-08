import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/user';
import { createUploadUrl, extFor } from '@/lib/gateway/r2';

export const runtime = 'nodejs';
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ detail: 'Please sign in.' }, { status: 401 });
  const { type, size } = await request.json();
  if (!extFor(type)) return NextResponse.json({ detail: `File type ${type} not allowed` }, { status: 400 });
  if (!size || size > MAX_BYTES) return NextResponse.json({ detail: 'File too large (max 50 MB)' }, { status: 400 });
  return NextResponse.json(await createUploadUrl({ userId: user.id, type, size }));
}
