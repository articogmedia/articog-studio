import { NextResponse } from "next/server";
import { requestMuapiSignedUpload } from "./muapiUploadUrl.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const result = await requestMuapiSignedUpload({
    apiKey: process.env.MUAPI_KEY,
    fileName: params.get("file_name"),
    contentType: params.get("content_type"),
  });

  return NextResponse.json(result.body, { status: result.status });
}