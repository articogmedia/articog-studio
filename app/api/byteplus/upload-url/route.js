import { NextResponse } from "next/server";
import {
  createSupabaseReadUrl,
  createSupabaseUploadTicket,
  StorageUploadError,
} from "./supabaseStorage.mjs";

export const dynamic = "force-dynamic";

const storageConfig = () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.BYTEPLUS_REFERENCE_BUCKET,
});

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    if (input?.action === "create") {
      const result = await createSupabaseUploadTicket({
        ...storageConfig(),
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
      });
      return NextResponse.json(result);
    }
    if (input?.action === "complete") {
      const signedUrl = await createSupabaseReadUrl({
        ...storageConfig(),
        path: input.path,
      });
      return NextResponse.json({ signedUrl });
    }
    return NextResponse.json({ error: "Upload action must be create or complete." }, { status: 400 });
  } catch (error) {
    const status = error instanceof StorageUploadError ? error.status : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
}