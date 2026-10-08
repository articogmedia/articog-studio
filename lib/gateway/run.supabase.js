import { getJob, updateJob } from '@/lib/gateway/jobs.supabase';
import { getProviderByName } from '@/lib/gateway/registry';
import { getUserByRequest } from '@/lib/supabase/user';

export async function runSupabaseJob(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');

  const provider = getProviderByName(job.provider || 'openai');
  if (!provider) throw new Error(`Unsupported provider: ${job.provider}`);

  const entry = provider.getEntry ? provider.getEntry(job.endpoint, job.model) : null;
  const start = provider.start || null;
  if (!start) {
    await updateJob(job.id, { status: 'failed', error: 'Provider start() is not implemented' });
    return { status: 'failed', job: await getJob(job.id) };
  }

  try {
    await updateJob(job.id, { status: 'processing' });
    const result = await start(job.input, { ...job, endpoint: job.endpoint, provider: job.provider, model: job.model, entry, user: null });

    if (result && result.status === 'completed') {
      await updateJob(job.id, {
        status: 'completed',
        outputs: result.outputs || [],
        externalId: result.externalId || null,
        usage: result.usage || null,
        lastCheckedAt: new Date().toISOString(),
      });
    } else if (result && result.status === 'failed') {
      await updateJob(job.id, {
        status: 'failed',
        error: result.error || 'Provider failed',
        lastCheckedAt: new Date().toISOString(),
      });
    } else {
      await updateJob(job.id, {
        status: result?.status || 'processing',
        outputs: result?.outputs || [],
        externalId: result?.externalId || null,
        usage: result?.usage || null,
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return { status: 'ok', job: await getJob(job.id) };
  } catch (error) {
    await updateJob(job.id, { status: 'failed', error: error.message || 'Execution failed', lastCheckedAt: new Date().toISOString() });
    return { status: 'failed', job: await getJob(job.id) };
  }
}

export async function checkSupabaseJob(jobId, request) {
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');

  const provider = getProviderByName(job.provider || 'openai');
  if (!provider || !provider.check) {
    return { status: job.status, outputs: job.outputs, error: job.error, result: job.outputs?.[0] || null };
  }

  try {
    const user = await getUserByRequest(request);
    const result = await provider.check(job, { user });
    if (result?.status === 'completed') {
      await updateJob(job.id, {
        status: 'completed',
        outputs: result.outputs || job.outputs || [],
        error: null,
        lastCheckedAt: new Date().toISOString(),
      });
    } else if (result?.status === 'failed') {
      await updateJob(job.id, {
        status: 'failed',
        error: result.error || 'Provider failed',
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return {
      status: result?.status || job.status,
      outputs: result?.outputs || job.outputs || [],
      error: result?.error || job.error || null,
      result: result?.result || null,
    };
  } catch (error) {
    await updateJob(job.id, { status: 'failed', error: error.message || 'Check failed', lastCheckedAt: new Date().toISOString() });
    return { status: 'failed', outputs: job.outputs || [], error: error.message || 'Check failed', result: null };
  }
}
