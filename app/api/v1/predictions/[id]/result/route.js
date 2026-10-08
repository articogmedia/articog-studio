import { NextResponse } from 'next/server';
import { getJob } from '@/lib/gateway/jobs';
import { refreshJob } from '@/lib/gateway/run';
import { getUser } from '@/lib/supabase/user';
import { getJob as getSupabaseJob } from '@/lib/gateway/jobs.supabase';
import { checkSupabaseJob } from '@/lib/gateway/run.supabase';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { id } = await params;

  if (process.env.NEXT_PUBLIC_USE_OWN_GATEWAY === 'true') {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ detail: 'Please sign in.' }, { status: 401 });
    }

    const job = await getSupabaseJob(id);
    if (!job || job.userId !== user.id) {
      return NextResponse.json({ detail: 'Job not found' }, { status: 404 });
    }

    const fresh = await checkSupabaseJob(id, request);
    return NextResponse.json({ request_id: fresh?.request_id || id, status: fresh?.status || job.status, outputs: fresh?.outputs || job.outputs || [], error: fresh?.error || job.error || null });
  }

  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ detail: 'Job not found' }, { status: 404 });
  }

  const fresh = await refreshJob(job);
  return NextResponse.json({ request_id: fresh.id, status: fresh.status, outputs: fresh.outputs, error: fresh.error });
}
