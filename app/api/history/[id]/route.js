import { NextResponse } from "next/server";
import { fetchSupabaseRest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const errorResponse = (message, status) => NextResponse.json({ error: message }, { status });

export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return errorResponse("Invalid history ID.", 400);
  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const update = {};
  if (typeof input.favorite === "boolean") update.favorite = input.favorite;
  if (input.project_id === null || typeof input.project_id === "string") {
    update.project_id = input.project_id;
  }
  if (Object.keys(update).length === 0) return errorResponse("No supported history fields were provided.", 400);
  if (update.project_id && !UUID_PATTERN.test(update.project_id)) return errorResponse("Invalid project ID.", 400);

  try {
    if (update.project_id) {
      const { session, response: projectResponse } = await fetchSupabaseRest(
        request,
        `projects?id=eq.${update.project_id}&select=id`,
      );
      if (!session) return errorResponse("Sign in to update history.", 401);
      if (!projectResponse.ok) return errorResponse("Could not verify the selected project.", projectResponse.status);
      if ((await projectResponse.json()).length === 0) return errorResponse("Project not found.", 404);
    }
    const query = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const { session, response } = await fetchSupabaseRest(
      request,
      `articog_history?${query.toString()}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(update),
      },
    );
    if (!session) return errorResponse("Sign in to update history.", 401);
    if (!response.ok) return errorResponse("Could not update history.", response.status);
    const rows = await response.json();
    return rows.length ? NextResponse.json(rows[0]) : errorResponse("History item not found.", 404);
  } catch (error) {
    console.error("[api/history/:id] Could not update history:", error);
    return errorResponse(error.message || "History service is unavailable.", 503);
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return errorResponse("Invalid history ID.", 400);
  try {
    const query = new URLSearchParams({ id: `eq.${id}`, select: "id" });
    const { session, response } = await fetchSupabaseRest(
      request,
      `articog_history?${query.toString()}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
    if (!session) return errorResponse("Sign in to delete history.", 401);
    if (!response.ok) return errorResponse("Could not delete history.", response.status);
    const rows = await response.json();
    return rows.length ? new Response(null, { status: 204 }) : errorResponse("History item not found.", 404);
  } catch (error) {
    console.error("[api/history/:id] Could not delete history:", error);
    return errorResponse(error.message || "History service is unavailable.", 503);
  }
}
