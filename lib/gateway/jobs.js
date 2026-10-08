import { randomUUID } from 'crypto';
const jobs = globalThis.__articogJobs ?? (globalThis.__articogJobs = new Map());
export function createJob(data) {
  const job = { id: randomUUID(), status: 'processing', outputs: [], error: null, createdAt: Date.now(), ...data };
  jobs.set(job.id, job);
  return job;
}
export function getJob(id) { return jobs.get(id) ?? null; }
export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
  return job;
}
