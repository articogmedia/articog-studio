import { NextResponse, after } from 'next/server';
import { MODEL_REGISTRY } from '@/lib/gateway/registry';
import { createJob } from '@/lib/gateway/jobs';
import { runJob } from '@/lib/gateway/run';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request, { params }) {
  const { endpoint } = await params;
  const entry = MODEL_REGISTRY[endpoint];

  if (!entry) {
    return NextResponse.json({ detail: `Unknown model endpoint: ${endpoint}` }, { status: 404 });
  }

  const input = await request.json();
  if (process.env.NODE_ENV !== 'production') console.log('[gateway]', endpoint, JSON.stringify(input).slice(0, 500));

  const job = createJob({ endpoint, entry, input });
  after(() => runJob(job.id));

  return NextResponse.json({ request_id: job.id, status: 'processing' });
}
