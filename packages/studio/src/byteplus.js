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

export async function uploadBytePlusReferenceImage(apiKey, file, onProgress) {
  if (!apiKey) throw new Error("A MuAPI API key is required to upload reference images.");

  const uploadEndpoint = typeof window !== "undefined" && window.location.protocol === "file:"
    ? "https://api.muapi.ai/app/get_file_upload_url"
    : "/api/v1/get_upload_url";
  const query = new URLSearchParams({
    file_name: file.name,
    content_type: file.type || "application/octet-stream",
  });
  const uploadInfo = await requestJson(`${uploadEndpoint}?${query}`, {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });
  const uploadData = uploadInfo.data && typeof uploadInfo.data === "object"
    ? { ...uploadInfo, ...uploadInfo.data }
    : uploadInfo;
  const fields = uploadData.fields;
  const uploadTarget = fields?.["x-proxy-target-url"] || uploadData.upload_url || uploadData.url;
  if (!uploadTarget || !fields || typeof fields !== "object") {
    throw new Error("Storage did not return a signed image upload target.");
  }
  if (new URL(uploadTarget).protocol !== "https:") {
    throw new Error("Storage returned an insecure image upload target.");
  }

  let publicUrl = uploadData.public_url || uploadData.file_url || uploadData.fileUrl;
  if (!publicUrl && fields.key) {
    const targetUrl = new URL(uploadTarget);
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/+$/, "")}/${String(fields.key)
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    targetUrl.search = "";
    publicUrl = targetUrl.toString();
  }
  if (typeof publicUrl !== "string" || !publicUrl.startsWith("https://")) {
    throw new Error("Storage did not return a public image URL for BytePlus.");
  }

  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (name !== "x-proxy-target-url") formData.append(name, String(value));
  }
  formData.append("file", file);
  onProgress?.(1);
  await fetch(uploadTarget, { method: "POST", body: formData, mode: "no-cors" });
  onProgress?.(100);
  return publicUrl;
}

export function generateBytePlusImage({ model, prompt, size, n = 1, image }) {
  return requestJson("/api/byteplus/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n, ...(image ? { image } : {}) }),
  });
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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