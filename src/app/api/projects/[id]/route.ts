import { NextResponse } from "next/server";
import { deleteProject, getProject, updateProject } from "@/lib/db";
import { badRequest, currentUserId, notFound, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const project = getProject(uid, id);
  if (!project) return notFound();
  const body = (await req.json().catch(() => ({}))) as { name?: string; description?: string };
  const name = body.name?.trim() ?? project.name;
  if (!name) return badRequest("Name is required");
  updateProject(uid, id, name.slice(0, 200), body.description?.trim() ?? project.description);
  return NextResponse.json(getProject(uid, id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getProject(uid, id)) return notFound();
  deleteProject(uid, id);
  return new NextResponse(null, { status: 204 });
}
