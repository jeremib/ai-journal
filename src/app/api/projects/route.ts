import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db";
import { badRequest, currentUserId, unauthorized } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  return NextResponse.json(listProjects(uid));
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { name, description } = (await req.json().catch(() => ({}))) as { name?: string; description?: string };
  if (!name?.trim()) return badRequest("Name is required");
  return NextResponse.json(createProject(uid, name.trim().slice(0, 200), (description ?? "").trim()), { status: 201 });
}
