import { NextResponse } from "next/server";

// Verify these endpoint paths and request/response fields against the BytePlus ModelArk docs.
const BYTEPLUS_CONFIG = {
  baseUrl: process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3",
  path: "/contents/generations/tasks",
  defaultModel: "seedance-1-0-pro-250528",
};

function upstreamMessage(data, fallback, apiKey) {
  const message = data?.error?.message || data?.error || data?.message || fallback;
  return String(message).replaceAll(apiKey, "[redacted]");
}

export async function POST(request) {
  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BytePlus API key is not configured." }, { status: 503 });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const model = process.env.BYTEPLUS_SEEDANCE_MODEL || BYTEPLUS_CONFIG.defaultModel;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const content = [{ type: "text", text: input.prompt }];
  if (typeof input.image_url === "string" && input.image_url.trim()) {
    content.push({ type: "image_url", image_url: { url: input.image_url } });
  }

  try {
    const response = await fetch(`${BYTEPLUS_CONFIG.baseUrl.replace(/\/+$/, "")}${BYTEPLUS_CONFIG.path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, content }),
    });

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

    const id = data.id || data.task_id;
    if (!id) return NextResponse.json({ error: "BytePlus did not return a task ID." }, { status: 502 });
    return NextResponse.json({ id, task_id: id }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Unable to reach BytePlus ModelArk." }, { status: 502 });
  }
}