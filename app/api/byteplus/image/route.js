import { NextResponse } from "next/server";

// Verify these endpoint paths and request/response fields against the BytePlus ModelArk docs.
const BYTEPLUS_CONFIG = {
  baseUrl: process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3",
  path: "/images/generations",
  defaultModel: "dola-seedream-5-0-pro-260628",
};

function upstreamMessage(data, fallback, apiKey) {
  const message = data?.error?.message || data?.error || data?.message || fallback;
  return String(message).replaceAll(apiKey, "[redacted]");
}

function isValidSize(size) {
  if (["1K", "1.5K", "2K"].includes(size)) return true;
  if (typeof size !== "string") return false;
  const dimensions = /^(\d+)x(\d+)$/i.exec(size);
  if (!dimensions) return false;
  const pixels = Number(dimensions[1]) * Number(dimensions[2]);
  return Number.isSafeInteger(pixels) && pixels >= 921600 && pixels <= 4624220;
}

function isValidImageInput(image) {
  const images = Array.isArray(image) ? image : [image];
  return images.length > 0 && images.length <= 10 &&
    images.every((value) => typeof value === "string" && value.length > 0);
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

  const model = process.env.BYTEPLUS_SEEDREAM_MODEL || BYTEPLUS_CONFIG.defaultModel;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  const size = input.size === undefined ? "2K" : input.size;
  if (!isValidSize(size)) {
    return NextResponse.json(
      { error: "Size must be 1K, 1.5K, 2K, or WxH with between 921600 and 4624220 pixels." },
      { status: 400 },
    );
  }
  const n = input.n === undefined ? 1 : input.n;
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    return NextResponse.json({ error: "Image count must be between 1 and 4." }, { status: 400 });
  }
  if (input.image !== undefined && !isValidImageInput(input.image)) {
    return NextResponse.json({ error: "Image must be a string or an array of up to 10 images." }, { status: 400 });
  }

  try {
    const results = await Promise.all(Array.from({ length: n }, async () => {
      const response = await fetch(`${BYTEPLUS_CONFIG.baseUrl.replace(/\/+$/, "")}${BYTEPLUS_CONFIG.path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          size,
          ...(input.image !== undefined ? { image: input.image } : {}),
          response_format: "url",
          watermark: false,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
      return { response, data };
    }));

    const failedResult = results.find(({ response }) => !response.ok);
    if (failedResult) {
      return NextResponse.json(
        { error: upstreamMessage(failedResult.data, failedResult.response.statusText, apiKey) },
        { status: failedResult.response.status },
      );
    }

    const imageData = results.flatMap(({ data }) => Array.isArray(data.data)
      ? data.data
      : data.url ? [{ url: data.url }] : []);
    const urls = imageData
      .map((image) => typeof image === "string" ? image : image?.url)
      .filter(Boolean);
    if (urls.length === 0) {
      return NextResponse.json({ error: "BytePlus returned no image URLs." }, { status: 502 });
    }
    return NextResponse.json({
      ...results[0].data,
      data: imageData,
      images: urls,
      url: urls[0],
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach BytePlus ModelArk." }, { status: 502 });
  }
}