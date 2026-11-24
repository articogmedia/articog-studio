import { NextResponse } from "next/server";
import { fetchSupabaseRest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const errorResponse = (message, status) => NextResponse.json({ error: message }, { status });

export async function GET(request) {
  try {
    const { session, response } = await fetchSupabaseRest(
      request,
      "projects?select=*&order=created_at.desc",
    );
    if (!session) return errorResponse("Sign in to view projects.", 401);
    if (!response.ok) return errorResponse("Could not load projects.", response.status);
    return NextResponse.json({ projects: await response.json() });
  } catch (error) {
    console.error("[api/projects] Could not load projects:", error);
    return errorResponse(error.message || "Project service is unavailable.", 503);
  }
}

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return errorResponse("Project name must be between 1 and 120 characters.", 400);

  try {
    const { session, response } = await fetchSupabaseRest(
      request,
      "projects?select=*",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ name }),
      },
    );
    if (!session) return errorResponse("Sign in to create projects.", 401);
    if (!response.ok) return errorResponse("Could not create project.", response.status);
    return NextResponse.json((await response.json())[0], { status: 201 });
  } catch (error) {
    console.error("[api/projects] Could not create project:", error);
    return errorResponse(error.message || "Project service is unavailable.", 503);
  }
}
