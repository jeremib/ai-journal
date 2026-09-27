import { NextResponse } from "next/server";
import { deleteEntry, getEntryForUser, updateEntry } from "@/lib/db";
import { currentUserId, notFound, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getEntryForUser(uid, id)) return notFound();
  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string; transcript?: string };
  const fields: Parameters<typeof updateEntry>[1] = {};
  if (typeof body.title === "string") fields.title = body.title.trim();
  if (typeof body.body === "string") fields.body = body.body.trim();
  if (typeof body.transcript === "string") fields.transcript = body.transcript.trim();
  return NextResponse.json(updateEntry(id, fields));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const entry = getEntryForUser(uid, id);
  if (!entry) return notFound();
  deleteEntry(entry);
  return new NextResponse(null, { status: 204 });
}
