function normalizeOutputs(record) {
  const outputs = Array.isArray(record.outputs)
    ? record.outputs
    : record.url
      ? [record.url]
      : [];
  return outputs.filter((output) => typeof output === "string" && output.trim());
}

export async function recordGeneration(record) {
  const type = record?.type === "image" ? "image" : record?.type === "video" ? "video" : null;
  const outputs = normalizeOutputs(record || {});
  if (!type || !record?.model || outputs.length === 0) return null;

  const response = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      model: record.model,
      type,
      prompt: typeof record.prompt === "string" ? record.prompt : "",
      input: record.input && typeof record.input === "object" ? record.input : {},
      outputs,
      project_id: record.projectId || null,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `History save failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
