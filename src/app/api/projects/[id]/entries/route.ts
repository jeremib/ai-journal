import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getProject, insertEntry, listEntries, newId, uploadPath, type Entry } from "@/lib/db";
import { fetchUrlContent } from "@/lib/fetch-url";
import { transcribe, transcriptionEnabled } from "@/lib/transcribe";
import { badRequest, currentUserId, notFound, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB ?? 200) * 1024 * 1024;

const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
  "audio/x-m4a": "m4a", "audio/aac": "aac", "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov",
};

export async function GET(_req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getProject(uid, id)) return notFound();
  return NextResponse.json(listEntries(id));
}

export async function POST(req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getProject(uid, id)) return notFound();

  const base: Omit<Entry, "id" | "created_at" | "type"> = {
    project_id: id, title: "", body: "", transcript: "",
    file_name: null, mime: null, url: null, url_title: null, url_text: null,
  };

  const ctype = req.headers.get("content-type") ?? "";

  // Audio / video: multipart upload
  if (ctype.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return badRequest("Missing file");
    if (file.size > MAX_UPLOAD) return badRequest("File too large");
    const mime = (file.type || "application/octet-stream").split(";")[0];
    const type = mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : null;
    if (!type) return badRequest("Only audio or video files are supported");

    const fileName = `${newId()}.${EXT[mime] ?? (type === "video" ? "mp4" : "webm")}`;
    await fs.writeFile(uploadPath(fileName), Buffer.from(await file.arrayBuffer()));

    let transcript = String(form.get("transcript") ?? "").trim();
    if (transcriptionEnabled()) {
      try {
        const serverTranscript = await transcribe(file, fileName);
        if (serverTranscript) transcript = serverTranscript;
      } catch (err) {
        console.error(err);
      }
    }

    const entry = insertEntry({
      ...base,
      type,
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      transcript,
      file_name: fileName,
      mime,
    });
    return NextResponse.json(entry, { status: 201 });
  }

  const data = (await req.json().catch(() => ({}))) as { type?: string; title?: string; body?: string; url?: string };

  if (data.type === "text") {
    if (!data.body?.trim()) return badRequest("Text is required");
    return NextResponse.json(
      insertEntry({ ...base, type: "text", title: data.title?.trim() ?? "", body: data.body.trim() }),
      { status: 201 },
    );
  }

  if (data.type === "url") {
    let url: string;
    try {
      const raw = data.url?.trim() ?? "";
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
    } catch {
      return badRequest("Invalid URL");
    }
    let page = { title: "", text: "" };
    try {
      page = await fetchUrlContent(url);
    } catch (err) {
      console.warn(`Could not fetch ${url}:`, (err as Error).message);
    }
    return NextResponse.json(
      insertEntry({
        ...base,
        type: "url",
        url,
        title: data.title?.trim() || page.title,
        body: data.body?.trim() ?? "",
        url_title: page.title || null,
        url_text: page.text || null,
      }),
      { status: 201 },
    );
  }

  return badRequest("Unknown entry type");
}
