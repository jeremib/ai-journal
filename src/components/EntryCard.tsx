"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Entry } from "@/lib/db";
import { LinkIcon, MicIcon, PenIcon, TrashIcon, VideoIcon } from "./icons";

const ICONS = { text: PenIcon, audio: MicIcon, video: VideoIcon, url: LinkIcon };

export default function EntryCard({
  entry,
  onChange,
  onDelete,
}: {
  entry: Entry;
  onChange: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [transcript, setTranscript] = useState(entry.transcript);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[entry.type];
  const isMedia = entry.type === "audio" || entry.type === "video";

  const save = async () => {
    setBusy(true);
    try {
      onChange(await api<Entry>(`/api/entries/${entry.id}`, { method: "PATCH", json: { title, body, transcript } }));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this entry?")) return;
    await api(`/api/entries/${entry.id}`, { method: "DELETE" });
    onDelete(entry.id);
  };

  let host = "";
  try {
    host = entry.url ? new URL(entry.url).hostname.replace(/^www\./, "") : "";
  } catch {}

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <header className="mb-2 flex items-center gap-2 text-xs text-stone-500">
        <Icon width={14} height={14} />
        <span suppressHydrationWarning>{formatDate(entry.created_at)}</span>
        <div className="ml-auto flex gap-3">
          {!editing && (
            <button onClick={() => setEditing(true)} className="hover:text-stone-800 dark:hover:text-stone-200">
              Edit
            </button>
          )}
          <button onClick={remove} aria-label="Delete entry" className="hover:text-red-600">
            <TrashIcon width={14} height={14} />
          </button>
        </div>
      </header>

      {editing ? (
        <div className="space-y-2">
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="input min-h-24"
            placeholder={entry.type === "text" ? "Text" : "Notes"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {isMedia && (
            <textarea className="input min-h-24" placeholder="Transcript" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary flex-1" onClick={save} disabled={busy}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {entry.title && <h3 className="mb-1 font-semibold">{entry.title}</h3>}

          {entry.type === "video" && (
            <video src={`/api/media/${entry.id}`} controls playsInline preload="metadata" className="mb-2 max-h-[70vh] w-full rounded-xl bg-black" />
          )}
          {entry.type === "audio" && <audio src={`/api/media/${entry.id}`} controls preload="metadata" className="mb-2 w-full" />}

          {entry.type === "url" && entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200 hover:bg-stone-100 dark:bg-stone-800 dark:ring-stone-700 dark:hover:bg-stone-700"
            >
              <p className="line-clamp-2 text-sm font-medium">{entry.url_title || entry.url}</p>
              <p className="mt-0.5 text-xs text-stone-500">{host}</p>
              {entry.url_text && <p className="mt-2 line-clamp-3 text-xs text-stone-600 dark:text-stone-400">{entry.url_text.slice(0, 400)}</p>}
              {!entry.url_text && <p className="mt-2 text-xs text-amber-600">Page text couldn&apos;t be fetched — add notes so the AI has context.</p>}
            </a>
          )}

          {entry.body && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{entry.body}</p>}

          {isMedia && (
            <div className="mt-2">
              {entry.transcript ? (
                <>
                  <button onClick={() => setShowTranscript((s) => !s)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {showTranscript ? "Hide transcript" : "Show transcript"}
                  </button>
                  {showTranscript && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-400">{entry.transcript}</p>}
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="text-xs text-amber-600">
                  No transcript — add one so the AI can use this recording
                </button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
