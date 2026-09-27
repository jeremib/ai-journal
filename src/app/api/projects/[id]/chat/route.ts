import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { clearMessages, getProject, insertMessage, listEntries, listMessages } from "@/lib/db";
import { anthropic, buildSystem, MODEL, toMessageParams } from "@/lib/ai";
import { badRequest, currentUserId, notFound, unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getProject(uid, id)) return notFound();
  return NextResponse.json(listMessages(id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  if (!getProject(uid, id)) return notFound();
  clearMessages(id);
  return new NextResponse(null, { status: 204 });
}

/** Sends a user message and streams the assistant's reply back as plain text. */
export async function POST(req: Request, { params }: Ctx) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { id } = await params;
  const project = getProject(uid, id);
  if (!project) return notFound();

  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  if (!message?.trim()) return badRequest("Message is required");

  insertMessage(id, "user", message.trim());
  const history = listMessages(id);

  const stream = anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    // If the primary model declines, the API retries on an appropriate fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: buildSystem(project, listEntries(id)),
    messages: toMessageParams(history),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            send(event.delta.text);
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") send("\n\n_(The assistant declined to answer this request.)_");
        else if (final.stop_reason === "max_tokens") send("\n\n_(Response truncated.)_");
      } catch (err) {
        console.error("Chat error:", err);
        send(
          err instanceof Anthropic.RateLimitError
            ? "\n\n_(Rate limited — please try again in a moment.)_"
            : err instanceof Anthropic.AuthenticationError || !process.env.ANTHROPIC_API_KEY
              ? "\n\n_(AI isn't configured — set ANTHROPIC_API_KEY on the server.)_"
              : "\n\n_(Something went wrong talking to the AI. Please try again.)_",
        );
      } finally {
        // Persist only what the model actually said, so status notes never leak into future context.
        if (text.trim()) insertMessage(id, "assistant", text);
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
