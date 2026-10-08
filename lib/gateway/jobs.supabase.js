import { randomUUID } from 'crypto';
import { admin } from '@/lib/supabase/admin';

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    provider: row.provider,
    model: row.model,
    input: row.input || {},
    status: row.status || 'processing',
    externalId: row.external_id || null,
    outputs: Array.isArray(row.outputs) ? row.outputs : [],
    error: row.error || null,
    creditsCharged: Number(row.credits_charged || 0),
    usage: row.usage || null,
    lastCheckedAt: row.last_checked_at || null,
    createdAt: row.created_at || Date.now(),
  };
}

export async function createJob(data) {
  const row = {
    id: randomUUID(),
    user_id: data.userId || null,
    endpoint: data.endpoint,
    provider: data.entry?.provider,
    model: data.entry?.model,
    input: data.input || {},
    status: 'processing',
    external_id: null,
    outputs: [],
    error: null,
    credits_charged: Number(data.creditsCharged || 0),
    usage: null,
    last_checked_at: null,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await admin.from('jobs').insert(row).select().single();
  if (error) throw new Error(error.message || 'Could not create job');
  return fromRow(inserted);
}

export async function getJob(id) {
  const { data, error } = await admin.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message || 'Could not load job');
  return fromRow(data);
}

export async function updateJob(id, patch) {
  const rowPatch = {};
  if (patch.status !== undefined) rowPatch.status = patch.status;
  if (patch.externalId !== undefined) rowPatch.external_id = patch.externalId;
  if (patch.outputs !== undefined) rowPatch.outputs = patch.outputs;
  if (patch.error !== undefined) rowPatch.error = patch.error;
  if (patch.usage !== undefined) rowPatch.usage = patch.usage;
  if (patch.lastCheckedAt !== undefined) rowPatch.last_checked_at = patch.lastCheckedAt;
  if (patch.creditsCharged !== undefined) rowPatch.credits_charged = Number(patch.creditsCharged || 0);
  if (patch.cost !== undefined) rowPatch.cost = patch.cost;

  if (Object.keys(rowPatch).length === 0) {
    const existing = await getJob(id);
    return existing;
  }

  const { data, error } = await admin.from('jobs').update(rowPatch).eq('id', id).select().single();
  if (error) throw new Error(error.message || 'Could not update job');
  return fromRow(data);
}
