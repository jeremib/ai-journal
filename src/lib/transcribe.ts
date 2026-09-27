/**
 * Optional server-side transcription for audio/video entries using any
 * OpenAI-compatible `/audio/transcriptions` endpoint (OpenAI Whisper, Groq, a
 * self-hosted whisper server, ...). Disabled unless TRANSCRIBE_API_KEY is set.
 * Without it, the app relies on in-browser live transcription plus manual edits.
 */
export const transcriptionEnabled = () => Boolean(process.env.TRANSCRIBE_API_KEY);

export async function transcribe(file: Blob, fileName: string): Promise<string> {
  if (!transcriptionEnabled()) return "";
  const base = process.env.TRANSCRIBE_API_URL ?? "https://api.openai.com/v1";
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("model", process.env.TRANSCRIBE_MODEL ?? "whisper-1");
  const res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return json.text?.trim() ?? "";
}
