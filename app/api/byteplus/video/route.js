import { NextResponse } from "next/server";
import { getBytePlusMaxReferenceImages } from "../../../../packages/studio/src/byteplusModelConfig.js";
import { buildBytePlusContent } from "./content.mjs";

// Verify these endpoint paths and request/response fields against the BytePlus ModelArk docs.
const BYTEPLUS_CONFIG = {
  baseUrl: process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3",
  path: "/contents/generations/tasks",
  defaultModel: "seedance-1-0-pro-250528",
};
const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;

function redactApiKey(value, apiKey) {
  return String(value).replaceAll(apiKey, "[redacted]");
}

function upstreamError(data, fallback, apiKey) {
  const error = data?.error;
  const code = error?.code || data?.code;
  const message = error?.message || (typeof error === "string" ? error : null) || data?.message || fallback;
  const safeCode = code ? redactApiKey(code, apiKey) : null;
  const safeMessage = redactApiKey(message, apiKey);
  return {
    error: safeCode ? `${safeCode}: ${safeMessage}` : safeMessage,
    ...(safeCode ? { code: safeCode } : {}),
  };
}

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json(
      { error: "Image data exceeds the 4 MB request limit. Use smaller or fewer images." },
      { status: 413 },
    );
  }

  let bodyText;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "Request body could not be read." }, { status: 400 });
  }
  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json(
      { error: "Image data exceeds the 4 MB request limit. Use smaller or fewer images." },
      { status: 413 },
    );
  }

  const apiKey = process.env.BYTEPLUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BytePlus API key is not configured." }, { status: 503 });
  }

  let input;
  try {
    input = JSON.parse(bodyText);
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

  const imageUrls = input.image_urls === undefined
    ? typeof input.image_url === "string" && input.image_url.trim()
      ? [input.image_url]
      : []
    : input.image_urls;
  let builtContent;
  try {
    builtContent = buildBytePlusContent({
      prompt: input.prompt,
      imageUrls,
      maxImages: getBytePlusMaxReferenceImages(model),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const ratio = builtContent.ratioOverride || input.ratio;
  const requestBody = {
    model,
    content: builtContent.content,
    ...builtContent.extraBody,
    ...(typeof ratio === "string" && ratio.trim() ? { ratio } : {}),
  };

  try {
    const response = await fetch(`${BYTEPLUS_CONFIG.baseUrl.replace(/\/+$/, "")}${BYTEPLUS_CONFIG.path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
        upstreamError(data, response.statusText, apiKey),
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