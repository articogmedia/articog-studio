function unwrapTask(data) {
  if (data?.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    return data.data;
  }
  return data;
}

function extractUrl(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = extractUrl(entry);
      if (url) return url;
    }
  }
  if (value && typeof value === "object") {
    return extractUrl(value.url || value.uri || value.video_url);
  }
  return null;
}

export function extractBytePlusTaskId(data) {
  const task = unwrapTask(data);
  const id = task?.id || task?.task_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function parseBytePlusTaskResponse(data, requestedId) {
  const task = unwrapTask(data) || {};
  const status = String(task.status || task.task_status || "unknown").trim().toLowerCase();
  const content = task.content;
  const contentUrl = Array.isArray(content)
    ? content.find((item) => item?.type === "video_url" || item?.video_url)?.video_url
    : content?.video_url || content?.videoUrl;
  const videoUrl = extractUrl(contentUrl) || extractUrl(task.video_url) || extractUrl(task.output?.video_url) || extractUrl(task.output?.url) || extractUrl(task.url);
  const error = task.error;
  const errorCode = error?.code || task.error_code || task.code;
  const errorMessage = error?.message || (typeof error === "string" ? error : null) || task.message || null;

  if (status === "succeeded" && !videoUrl) {
    return {
      id: task.id || requestedId,
      status,
      error: "BytePlus marked this task succeeded but returned no content.video_url. Check the task in the BytePlus console and retry if needed.",
    };
  }
  if (["failed", "expired", "cancelled", "canceled"].includes(status)) {
    return {
      id: task.id || requestedId,
      status,
      ...(errorCode ? { code: String(errorCode) } : {}),
      error: errorMessage || (status === "expired"
        ? "BytePlus task expired before generating a video. Please retry."
        : `BytePlus video generation ${status}. Check the task in the BytePlus console for details.`),
    };
  }
  return {
    id: task.id || requestedId,
    status,
    ...(videoUrl ? { url: videoUrl } : {}),
  };
}