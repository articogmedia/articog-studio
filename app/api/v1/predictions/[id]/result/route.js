import { NextResponse } from 'next/server';
import { getJob } from '@/lib/gateway/jobs';
import { refreshJob } from '@/lib/gateway/run';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ detail: 'Job not found' }, { status: 404 });
  }

  const fresh = await refreshJob(job);
  return NextResponse.json({ request_id: fresh.id, status: fresh.status, outputs: fresh.outputs, error: fresh.error });
}
