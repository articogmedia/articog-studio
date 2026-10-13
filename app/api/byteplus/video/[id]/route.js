import { NextResponse } from "next/server";

// Verify these endpoint paths and request/response fields against the BytePlus ModelArk docs.
const BYTEPLUS_CONFIG = {
  baseUrl: process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3",
  path: "/contents/generations/tasks",
};

function upstreamMessage(data, fallback, apiKey) {
  const message = data?.error?.message || data?.error || data?.message || fallback;
  return String(message).replaceAll(apiKey, "[redacted]");
}

function getVideoUrl(data) {
  const videoItem = Array.isArray(data.content)
    ? data.content.find((item) => item?.type === "video_url" || item?.video_url)
    : null;
  const candidates = [
    videoItem?.video_url,
    data.video_url,
    data.output?.video_url,
    data.output?.url,
    data.url,
  ];
  return candidates
    .map((value) => typeof value === "string" ? value : value?.url)
    .find(Boolean);
}

export async function GET(request, { params }) {
  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BytePlus API key is not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const response = await fetch(
      `${BYTEPLUS_CONFIG.baseUrl.replace(/\/+$/, "")}${BYTEPLUS_CONFIG.path}/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: upstreamMessage(data, response.statusText, apiKey) },
        { status: response.status },
      );
    }

    const status = data.status || data.task_status || "unknown";
    const url = getVideoUrl(data);
    return NextResponse.json({ id, status, ...(url ? { url } : {}) }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Unable to reach BytePlus ModelArk." }, { status: 502 });
  }
}