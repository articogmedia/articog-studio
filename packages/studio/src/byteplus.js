async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `BytePlus request failed (${response.status}).`);
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

export function generateBytePlusImage({ model, prompt, size, n = 1, image }) {
  return requestJson("/api/byteplus/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n, ...(image ? { image } : {}) }),
  });
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function generateBytePlusVideo({ model, prompt, imageUrl }) {
  const task = await requestJson("/api/byteplus/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, ...(imageUrl ? { image_url: imageUrl } : {}) }),
  });
  if (!task.id) throw new Error("BytePlus did not return a video task ID.");

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await wait(3000);
    const result = await requestJson(`/api/byteplus/video/${encodeURIComponent(task.id)}`, {
      method: "GET",
    });
    const status = String(result.status || "").toLowerCase();
    if (["succeeded", "success", "completed", "done"].includes(status)) {
      if (result.url) return { ...result, id: task.id, request_id: task.id };
      throw new Error("BytePlus completed the video task without returning a video URL.");
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(result.message || `BytePlus video generation ${status}.`);
    }
  }

  throw new Error("BytePlus video generation timed out.");
}