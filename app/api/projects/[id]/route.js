import { NextResponse } from "next/server";
import { fetchSupabaseRest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const errorResponse = (message, status) => NextResponse.json({ error: message }, { status });

export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return errorResponse("Invalid project ID.", 400);
  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return errorResponse("Project name must be between 1 and 120 characters.", 400);

  try {
    const query = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const { session, response } = await fetchSupabaseRest(
      request,
      `projects?${query.toString()}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ name }),
      },
    );
    if (!session) return errorResponse("Sign in to update projects.", 401);
    if (!response.ok) return errorResponse("Could not update project.", response.status);
    const rows = await response.json();
    return rows.length ? NextResponse.json(rows[0]) : errorResponse("Project not found.", 404);
  } catch (error) {
    console.error("[api/projects/:id] Could not update project:", error);
    return errorResponse(error.message || "Project service is unavailable.", 503);
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return errorResponse("Invalid project ID.", 400);
  try {
    const query = new URLSearchParams({ id: `eq.${id}`, select: "id" });
    const { session, response } = await fetchSupabaseRest(
      request,
      `projects?${query.toString()}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
    if (!session) return errorResponse("Sign in to delete projects.", 401);
    if (!response.ok) return errorResponse("Could not delete project.", response.status);
    const rows = await response.json();
    return rows.length ? NextResponse.json({ ok: true }) : errorResponse("Project not found.", 404);
  } catch (error) {
    console.error("[api/projects/:id] Could not delete project:", error);
    return errorResponse(error.message || "Project service is unavailable.", 503);
  }
}
