import { NextResponse } from "next/server";
import { normalizeBytePlusProviderError, parseBytePlusTaskResponse } from "../taskResponse.mjs";

// Verify these endpoint paths and request/response fields against the BytePlus ModelArk docs.
const BYTEPLUS_CONFIG = {
  baseUrl: process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3",
  path: "/contents/generations/tasks",
};

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
        normalizeBytePlusProviderError(data, response.statusText, apiKey),
        { status: response.status },
      );
    }

    const task = parseBytePlusTaskResponse(data, id);
    const normalizedTask = task.error
      ? {
          ...task,
          ...(task.code ? { code: String(task.code).replaceAll(apiKey, "[redacted]") } : {}),
          error: String(task.error).replaceAll(apiKey, "[redacted]"),
        }
      : task;
    const responseStatus = task.status === "succeeded" && !task.url ? 502 : response.status;
    return NextResponse.json(normalizedTask, { status: responseStatus });
  } catch {
    return NextResponse.json({ error: "Unable to reach BytePlus ModelArk." }, { status: 502 });
  }
}