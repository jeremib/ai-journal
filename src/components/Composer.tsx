"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Entry } from "@/lib/db";
import Recorder from "./Recorder";
import { CloseIcon, LinkIcon, MicIcon, PenIcon, VideoIcon } from "./icons";

export type Mode = "text" | "audio" | "video" | "url";

const TITLES: Record<Mode, string> = { text: "Write", audio: "Record audio", video: "Record video", url: "Save a link" };

export function ComposerButtons({ onPick }: { onPick: (m: Mode) => void }) {
  const items: { mode: Mode; label: string; Icon: typeof PenIcon }[] = [
    { mode: "text", label: "Write", Icon: PenIcon },
    { mode: "audio", label: "Audio", Icon: MicIcon },
    { mode: "video", label: "Video", Icon: VideoIcon },
    { mode: "url", label: "Link", Icon: LinkIcon },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          onClick={() => onPick(mode)}
          className="flex flex-col items-center gap-1 rounded-xl bg-white py-3 text-xs font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 transition active:scale-95 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700"
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Composer({
  mode,
  projectId,
  onClose,
  onSaved,
}: {
  mode: Mode;
  projectId: string;
  onClose: () => void;
  onSaved: (e: Entry, notice?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const entry = await api<Entry>(`/api/projects/${projectId}/entries`, {
        method: "POST",
        json: mode === "text" ? { type: "text", title, body } : { type: "url", url, body },
      });
      onSaved(entry);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{TITLES[mode]}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {mode === "audio" || mode === "video" ? (
          <Recorder kind={mode} projectId={projectId} onSaved={onSaved} onCancel={onClose} />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === "text" ? (
              <>
                <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea
                  className="input min-h-48"
                  placeholder="What's on your mind?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  autoFocus
                  required
                />
              </>
            ) : (
              <>
                <input
                  className="input"
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoFocus
                  required
                />
                <textarea
                  className="input min-h-24"
                  placeholder="Why is this worth saving? (optional)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <p className="text-xs text-stone-500">We&apos;ll fetch the page text so the AI can read it.</p>
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? (mode === "url" ? "Fetching page…" : "Saving…") : "Save entry"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
