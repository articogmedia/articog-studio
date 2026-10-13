import { NextResponse, after } from 'next/server';
import { MODEL_REGISTRY } from '@/lib/gateway/registry';
import { createJob } from '@/lib/gateway/jobs';
import { runJob } from '@/lib/gateway/run';
import { getUser } from '@/lib/supabase/user';
import { requireAuthenticatedGatewayUser } from '@/lib/gateway/auth';
import { admin } from '@/lib/supabase/admin';
import { createJob as createSupabaseJob } from '@/lib/gateway/jobs.supabase';
import { runSupabaseJob } from '@/lib/gateway/run.supabase';

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

  if (process.env.NEXT_PUBLIC_USE_OWN_GATEWAY === 'true') {
    const { user, response } = await requireAuthenticatedGatewayUser(getUser);
    if (response) return response;

    let profile = null;
    try {
      const { data } = await admin.from('profiles').select('credits').eq('id', user.id).maybeSingle();
      profile = data;
    } catch {
      profile = null;
    }

    const credits = Number(profile?.credits ?? 0);
    const requiredCredits = 1;
    if (credits < requiredCredits) {
      return NextResponse.json({ detail: 'Insufficient credits.' }, { status: 402 });
    }

    const job = await createSupabaseJob({
      userId: user.id,
      endpoint,
      entry,
      input,
      creditsCharged: requiredCredits,
    });

    try {
      await admin.from('profiles').update({ credits: Math.max(0, credits - requiredCredits) }).eq('id', user.id);
    } catch {
      // A credit-write failure should not block the job from being created, but the route must remain resilient.
    }

    after(() => runSupabaseJob(job.id));

    return NextResponse.json({ request_id: job.id, status: 'processing' });
  }

  const job = createJob({ endpoint, entry, input });
  after(() => runJob(job.id));

  return NextResponse.json({ request_id: job.id, status: 'processing' });
}
