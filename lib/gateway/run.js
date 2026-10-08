import { getJob, updateJob } from './jobs';
import * as seedance from './providers/seedance';
import * as gemini from './providers/gemini';
import * as openai from './providers/openai';
const PROVIDERS = { seedance, gemini, openai };
const CHECK_EVERY_MS = 5000;
export async function runJob(id) {
  const job = getJob(id);
  try {
    const result = await PROVIDERS[job.entry.provider].start(job);
    if (result.externalId) updateJob(id, { externalId: result.externalId });
    else updateJob(id, { status: 'completed', outputs: result.outputs });
  } catch (err) {
    console.error('[gateway] start failed', id, err);
    updateJob(id, { status: 'failed', error: err.message });
  }
}
export async function refreshJob(job) {
  if (job.status !== 'processing' || !job.externalId) return job;
  if (Date.now() - (job.lastCheckedAt || 0) < CHECK_EVERY_MS) return job;
  updateJob(job.id, { lastCheckedAt: Date.now() });
  try {
    return updateJob(job.id, await PROVIDERS[job.entry.provider].check(job));
  } catch (err) {
    console.error('[gateway] check failed (will retry)', job.id, err.message);
    return job;
  }
}
