async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || data.message;
    const codePrefix = data.code && !String(message || "").startsWith(`${data.code}:`)
      ? `${data.code}: `
      : "";
    throw new Error(`${codePrefix}${message || `BytePlus request failed (${response.status}).`}`);
  }
  return data;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadBytePlusReferenceImage(file, onProgress) {
  if (!(file instanceof Blob)) throw new Error("Choose a valid reference image file.");
  let uploadTicket;
  try {
    uploadTicket = await requestJson("/api/byteplus/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
  } catch (error) {
    throw new Error(`Supabase upload-ticket request failed: ${error.message || "The server could not be reached."}`);
  }
  if (typeof uploadTicket.uploadUrl !== "string" || typeof uploadTicket.path !== "string") {
    throw new Error("Supabase Storage did not return a signed upload URL.");
  }
  const uploadUrl = new URL(uploadTicket.uploadUrl);
  if (uploadUrl.protocol !== "https:") {
    throw new Error("Supabase Storage returned an insecure upload URL.");
  }

  onProgress?.(1);
  const uploadBody = new FormData();
  uploadBody.append("cacheControl", "3600");
  uploadBody.append("", file);
  let response;
  try {
    response = await fetch(uploadUrl.toString(), {
      method: "PUT",
      body: uploadBody,
    });
  } catch {
    throw new Error("Supabase direct upload failed before an HTTP response was received. Check the upload URL, network/TLS connectivity, and Supabase Storage CORS for this app origin.");
  }
  if (!response.ok) {
    if ([400, 401, 403].includes(response.status)) {
      throw new Error("Supabase signed upload URL expired or was rejected. Please upload the image again.");
    }
    throw new Error(`Supabase image upload failed (${response.status}).`);
  }
  onProgress?.(90);

  let result;
  try {
    result = await requestJson("/api/byteplus/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", path: uploadTicket.path }),
    });
  } catch (error) {
    throw new Error(`Supabase upload verification failed: ${error.message || "The server could not be reached."}`);
  }
  if (typeof result.signedUrl !== "string" || !result.signedUrl.startsWith("https://")) {
    throw new Error("Supabase Storage did not return a temporary image URL for BytePlus.");
  }
  onProgress?.(100);
  return result.signedUrl;
}

export function generateBytePlusImage({ model, prompt, size, n = 1, image }) {
  return requestJson("/api/byteplus/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n, ...(image ? { image } : {}) }),
  });
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const BYTEPLUS_TASK_POLL_INTERVAL_MS = 10_000;
const BYTEPLUS_TASK_TIMEOUT_MS = 30 * 60 * 1000;

export async function pollBytePlusVideoTask(taskId, {
  getTask = (id) => requestJson(`/api/byteplus/video/${encodeURIComponent(id)}`, { method: "GET" }),
  waitImpl = wait,
  pollIntervalMs = BYTEPLUS_TASK_POLL_INTERVAL_MS,
  timeoutMs = BYTEPLUS_TASK_TIMEOUT_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const result = await getTask(taskId);
    const status = String(result.status || "unknown").toLowerCase();
    lastStatus = status;
    if (status === "succeeded") {
      if (result.url) return { ...result, id: taskId, request_id: taskId };
      throw new Error(result.error || "BytePlus marked the task successful without returning content.video_url.");
    }
    if (["failed", "expired", "cancelled", "canceled"].includes(status)) {
      const message = result.error || result.message || `BytePlus video generation ${status}.`;
      const codePrefix = result.code && !String(message).startsWith(`${result.code}:`)
        ? `${result.code}: `
        : "";
      throw new Error(`${codePrefix}${message}`);
    }
    if (Date.now() + pollIntervalMs >= deadline) break;
    await waitImpl(pollIntervalMs);
  }
  throw new Error(`BytePlus video generation timed out after 30 minutes (last task status: ${lastStatus}).`);
}

export async function generateBytePlusVideo({ model, prompt, imageUrls, imageUrl, ratio, duration, resolution }) {
  const urls = Array.isArray(imageUrls) && imageUrls.length > 0
    ? imageUrls
    : imageUrl
      ? [imageUrl]
      : [];
  const task = await requestJson("/api/byteplus/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      image_urls: urls,
      ...(ratio ? { ratio } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(resolution !== undefined ? { resolution } : {}),
    }),
  });
  if (!task.id) throw new Error("BytePlus did not return a video task ID.");
  return pollBytePlusVideoTask(task.id);
}