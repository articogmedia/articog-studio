import { NextResponse } from "next/server";
import { fetchSupabaseRest, getSessionFromRequest, getSupabaseRestUrl, supabaseRestHeaders } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function apiError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const limit = Math.min(60, Math.max(1, Number.parseInt(params.get("limit") || "24", 10) || 24));
    const query = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: String(limit),
      offset: String((page - 1) * limit),
    });
    const search = (params.get("search") || "").trim().replace(/[\\%_,()*]/g, " ");
    const model = params.get("model");
    const type = params.get("type");
    const projectId = params.get("project_id");
    const favorite = params.get("favorite");
    if (search) query.set("prompt", `wfts(english).${search}`);
    if (model) query.set("model", `eq.${model}`);
    if (type === "image" || type === "video") query.set("type", `eq.${type}`);
    if (projectId && UUID_PATTERN.test(projectId)) query.set("project_id", `eq.${projectId}`);
    if (favorite === "true") query.set("favorite", "eq.true");

    const { session, response } = await fetchSupabaseRest(
      request,
      `articog_history?${query.toString()}`,
      { headers: { Prefer: "count=exact" } },
    );
    if (!session) return apiError("Sign in to view your history.", 401);
    if (!response.ok) return apiError("Could not load generation history.", response.status);
    const items = await response.json();
    const contentRange = response.headers.get("content-range");
    const total = contentRange?.split("/")[1] && contentRange.split("/")[1] !== "*"
      ? Number(contentRange.split("/")[1])
      : items.length;
    return NextResponse.json({ items, page, limit, total });
  } catch (error) {
    console.error("[api/history] Could not load history:", error);
    return apiError(error.message || "History service is unavailable.", 503);
  }
}

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }
  if (
    !input
    || typeof input.model !== "string"
    || !input.model.trim()
    || !["image", "video"].includes(input.type)
    || typeof input.prompt !== "string"
    || !Array.isArray(input.outputs)
    || input.outputs.length === 0
    || input.outputs.some((url) => typeof url !== "string" || !/^https?:\/\//i.test(url))
    || !input.input
    || typeof input.input !== "object"
    || Array.isArray(input.input)
  ) {
    return apiError("A model, media type, prompt, input object, and output URL are required.", 400);
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError("Sign in to save generation history.", 401);
    const projectId = input.project_id || null;
    if (projectId) {
      if (!UUID_PATTERN.test(projectId)) return apiError("Invalid project ID.", 400);
      const projectResponse = await fetch(getSupabaseRestUrl(`projects?id=eq.${projectId}&select=id`), {
        headers: supabaseRestHeaders(session.accessToken),
        cache: "no-store",
      });
      if (!projectResponse.ok) return apiError("Could not verify the selected project.", projectResponse.status);
      if ((await projectResponse.json()).length === 0) return apiError("Project not found.", 404);
    }

    const response = await fetch(getSupabaseRestUrl("articog_history"), {
      method: "POST",
      headers: supabaseRestHeaders(session.accessToken, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        user_id: session.user.id,
        model: input.model.trim(),
        type: input.type,
        prompt: input.prompt.slice(0, 10000),
        input: input.input,
        outputs: input.outputs,
        project_id: projectId,
      }),
      cache: "no-store",
    });
    if (!response.ok) return apiError("Could not save generation history.", response.status);
    return NextResponse.json((await response.json())[0], { status: 201 });
  } catch (error) {
    console.error("[api/history] Could not record generation:", error);
    return apiError(error.message || "History service is unavailable.", 503);
  }
}
