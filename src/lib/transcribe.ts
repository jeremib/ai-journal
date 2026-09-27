/**
 * Optional server-side transcription for audio/video entries using any
 * OpenAI-compatible `/audio/transcriptions` endpoint (Groq, OpenAI Whisper, a
 * self-hosted whisper server, ...). Disabled unless TRANSCRIBE_API_KEY is set.
 * Without it, the app relies on in-browser live transcription plus manual edits.
 *
 * Transcription is best-effort: an entry is never lost because the provider
 * rejected the file. Failures come back as a `warning` for the UI to show.
 */

export type TranscribeResult = {
  /** Transcript text, or "" when transcription was skipped or failed. */
  text: string;
  /** Reader-facing explanation, set only when there is no usable text. */
  warning?: string;
};

/** Provider upload cap. Groq's free tier rejects anything over 25MB. */
export const TRANSCRIBE_MAX_BYTES = Number(process.env.TRANSCRIBE_MAX_MB ?? 24) * 1024 * 1024;

export const transcriptionEnabled = () => Boolean(process.env.TRANSCRIBE_API_KEY);

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const tooLarge = (size: number) =>
  `Recording saved, but it is ${mb(size)} — too large to transcribe automatically ` +
  `(limit ${mb(TRANSCRIBE_MAX_BYTES)}). Type or paste the transcript by hand, or record in shorter parts.`;

export async function transcribe(file: Blob, fileName: string): Promise<TranscribeResult> {
  if (!transcriptionEnabled()) return { text: "" };
  if (file.size > TRANSCRIBE_MAX_BYTES) return { text: "", warning: tooLarge(file.size) };

  const base = process.env.TRANSCRIBE_API_URL ?? "https://api.openai.com/v1";
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("model", process.env.TRANSCRIBE_MODEL ?? "whisper-1");

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error("Transcription request failed:", err);
    return {
      text: "",
      warning: timedOut
        ? "Recording saved, but transcription timed out. Add the transcript by hand, or try a shorter recording."
        : "Recording saved, but the transcription service could not be reached. Add the transcript by hand.",
    };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`Transcription failed (${res.status}): ${detail}`);
    // 413 from the provider means our own cap is set higher than theirs.
    if (res.status === 413) return { text: "", warning: tooLarge(file.size) };
    if (res.status === 429)
      return { text: "", warning: "Recording saved, but the transcription service is rate-limited right now. Add the transcript by hand, or retry later." };
    if (res.status === 401 || res.status === 403)
      return { text: "", warning: "Recording saved, but the transcription service rejected our API key. Add the transcript by hand." };
    return { text: "", warning: `Recording saved, but transcription failed (${res.status}). Add the transcript by hand.` };
  }

  const json = (await res.json().catch(() => ({}))) as { text?: string };
  const text = json.text?.trim() ?? "";
  return text
    ? { text }
    : { text: "", warning: "Recording saved, but no speech was detected. Add the transcript by hand if needed." };
}
