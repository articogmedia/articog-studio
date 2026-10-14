const MUAPI_UPLOAD_URL = "https://api.muapi.ai/app/get_file_upload_url";

function redactApiKey(value, apiKey) {
  if (typeof value === "string") return value.replaceAll(apiKey, "[redacted]");
  if (Array.isArray(value)) return value.map((item) => redactApiKey(item, apiKey));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactApiKey(item, apiKey)]),
    );
  }
  return value;
}

export async function requestMuapiSignedUpload({ apiKey, fileName, contentType, fetchImpl = fetch }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return {
      status: 503,
      body: { error: "Server configuration error: MUAPI_KEY is not configured." },
    };
  }
  if (typeof fileName !== "string" || !fileName.trim() || typeof contentType !== "string" || !contentType.trim()) {
    return { status: 400, body: { error: "File name and content type are required." } };
  }

  const query = new URLSearchParams({
    file_name: fileName,
    content_type: contentType,
  });
  try {
    const response = await fetchImpl(`${MUAPI_UPLOAD_URL}?${query}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text || response.statusText || "MuAPI upload URL request failed." };
    }
    return { status: response.status, body: redactApiKey(body, apiKey) };
  } catch {
    return { status: 502, body: { error: "Unable to reach the MuAPI upload URL service." } };
  }
}