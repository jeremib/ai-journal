"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import { uploadWithProgress } from "@/lib/api";
import type { Entry } from "@/lib/db";
import { MicIcon, StopIcon, UploadIcon, VideoIcon } from "./icons";

type Kind = "audio" | "video";
type Phase = "idle" | "recording" | "review" | "uploading";

// Minimal typing for the (prefixed) Web Speech API.
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

function pickMime(kind: Kind) {
  const candidates =
    kind === "video"
      ? ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export default function Recorder({
  kind,
  projectId,
  onSaved,
  onCancel,
}: {
  kind: Kind;
  projectId: string;
  onSaved: (e: Entry) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [progress, setProgress] = useState(0);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [liveTranscribe, setLiveTranscribe] = useState(true);
  const [ready, setReady] = useState(false);
  const speechSupported = getSpeechRecognition() !== null;

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  // Open camera/mic preview (video shows a live preview before recording starts).
  const openStream = useCallback(async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "video"
          ? { audio: true, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { audio: { echoCancellation: true, noiseSuppression: true } },
      );
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }
      setReady(true);
      setError(null);
    } catch (err) {
      setError(
        (err as Error).name === "NotAllowedError"
          ? `Permission denied. Allow ${kind === "video" ? "camera and microphone" : "microphone"} access to record.`
          : `Couldn't access your ${kind === "video" ? "camera" : "microphone"}. You can upload a file instead.`,
      );
    }
  }, [kind, facing, stopStream]);

  useEffect(() => {
    if (phase === "idle") openStream();
  }, [phase, openStream]);

  useEffect(
    () => () => {
      recordingRef.current = false;
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      stopStream();
    },
    [stopStream],
  );

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const startRecognition = () => {
    const SR = getSpeechRecognition();
    if (!SR || !liveTranscribe) return;
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        if (finalText) setTranscript((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
        setInterim(interimText);
      };
      // Browsers end recognition after silences; keep it going while recording.
      rec.onend = () => {
        if (recordingRef.current) {
          try {
            rec.start();
          } catch {}
        }
      };
      rec.onerror = () => {};
      rec.start();
      recognitionRef.current = rec;
    } catch {
      /* live transcription is best-effort */
    }
  };

  const start = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMime(kind);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = (recorder.mimeType || mimeType || (kind === "video" ? "video/webm" : "audio/webm")).split(";")[0];
      const b = new Blob(chunks, { type });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setPhase("review");
      stopStream();
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    recordingRef.current = true;
    setTranscript("");
    setInterim("");
    setElapsed(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    startRecognition();
    setPhase("recording");
  };

  const stop = () => {
    recordingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setError("Please choose an audio or video file.");
      return;
    }
    stopStream();
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setPhase("review");
  };

  const reRecord = () => {
    setBlob(null);
    setPreviewUrl(null);
    setTranscript("");
    setPhase("idle");
  };

  const save = async () => {
    if (!blob) return;
    setPhase("uploading");
    setError(null);
    const form = new FormData();
    const ext = blob.type.includes("mp4") ? (blob.type.startsWith("audio") ? "m4a" : "mp4") : "webm";
    form.append("file", blob, blob instanceof File ? blob.name : `recording.${ext}`);
    form.append("title", title);
    form.append("body", notes);
    form.append("transcript", transcript);
    try {
      const entry = await uploadWithProgress<Entry>(`/api/projects/${projectId}/entries`, form, setProgress);
      onSaved(entry);
    } catch (err) {
      setError((err as Error).message);
      setPhase("review");
    }
  };

  const Icon = kind === "video" ? VideoIcon : MicIcon;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {(phase === "idle" || phase === "recording") && (
        <>
          {kind === "video" ? (
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={liveVideoRef}
                muted
                playsInline
                autoPlay
                className={`aspect-[3/4] w-full object-cover sm:aspect-video ${facing === "user" ? "-scale-x-100" : ""}`}
              />
              {phase === "recording" && (
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  {formatDuration(elapsed)}
                </span>
              )}
              {phase === "idle" && (
                <button
                  onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
                >
                  Flip camera
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-stone-100 py-10 dark:bg-stone-800">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full ${
                  phase === "recording" ? "animate-pulse bg-red-500 text-white" : "bg-white text-stone-600 dark:bg-stone-700 dark:text-stone-200"
                }`}
              >
                <MicIcon width={36} height={36} />
              </div>
              <p className="mt-4 font-mono text-2xl tabular-nums">{formatDuration(elapsed)}</p>
            </div>
          )}

          {phase === "recording" && liveTranscribe && speechSupported && (
            <p className="max-h-28 overflow-y-auto rounded-lg bg-stone-100 p-3 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
              {transcript} <span className="text-stone-400">{interim}</span>
              {!transcript && !interim && <span className="text-stone-400">Listening…</span>}
            </p>
          )}

          <div className="flex items-center justify-center gap-4">
            {phase === "idle" ? (
              <button
                onClick={start}
                disabled={!ready}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95 disabled:opacity-40"
                aria-label="Start recording"
              >
                <Icon width={28} height={28} />
              </button>
            ) : (
              <button
                onClick={stop}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg transition active:scale-95 dark:bg-white dark:text-stone-900"
                aria-label="Stop recording"
              >
                <StopIcon width={26} height={26} />
              </button>
            )}
          </div>

          {phase === "idle" && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              {speechSupported ? (
                <label className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                  <input type="checkbox" checked={liveTranscribe} onChange={(e) => setLiveTranscribe(e.target.checked)} />
                  Live transcript
                </label>
              ) : (
                <span className="text-stone-500">You can add a transcript after recording.</span>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                <UploadIcon width={16} height={16} /> Upload file
                <input type="file" accept={`${kind}/*`} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
        </>
      )}

      {(phase === "review" || phase === "uploading") && previewUrl && (
        <div className="space-y-3">
          {blob?.type.startsWith("video") ? (
            <video src={previewUrl} controls playsInline className="w-full rounded-2xl bg-black" />
          ) : (
            <audio src={previewUrl} controls className="w-full" />
          )}
          <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="input min-h-24"
            placeholder="Transcript — the AI uses this to understand your recording"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          <textarea className="input min-h-16" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={phase === "uploading" ? undefined : reRecord} disabled={phase === "uploading"}>
              Re-record
            </button>
            <button className="btn-primary flex-1" onClick={save} disabled={phase === "uploading"}>
              {phase === "uploading" ? `Uploading ${progress}%` : "Save entry"}
            </button>
          </div>
        </div>
      )}

      {phase !== "uploading" && (
        <button onClick={onCancel} className="w-full py-1 text-sm text-stone-500">
          Cancel
        </button>
      )}
    </div>
  );
}
