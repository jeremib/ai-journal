import fs from "node:fs";
import { Readable } from "node:stream";
import { getEntryForUser, uploadPath } from "@/lib/db";
import { currentUserId, notFound, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// Streams a media file with HTTP Range support (required for seeking, and by iOS Safari for video).
export async function GET(req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const entry = getEntryForUser(uid, id);
  if (!entry?.file_name) return notFound();

  const file = uploadPath(entry.file_name);
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    return notFound();
  }

  const headers: Record<string, string> = {
    "content-type": entry.mime ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=31536000, immutable",
  };

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "content-length": String(size) } });
}
