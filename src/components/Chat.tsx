"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/db";
import { SendIcon } from "./icons";

type Msg = Pick<ChatMessage, "id" | "role" | "content">;

const SUGGESTIONS = [
  "Summarize everything in this project so far",
  "What themes or patterns do you notice?",
  "What open questions or next steps came up?",
  "What changed over time?",
];

export default function Chat({ projectId, initial, entryCount }: { projectId: string; initial: Msg[]; entryCount: number }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setStreaming(true);
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message }, { id: assistantId, role: "assistant", content: "" }]);

    const append = (chunk: string) =>
      setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + chunk } : x)));

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") append(`\n\n_(${(err as Error).message})_`);
    } finally {
      setStreaming(false);
    }
  };

  const clear = async () => {
    if (!confirm("Clear this conversation?")) return;
    await api(`/api/projects/${projectId}/chat`, { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-6 text-center">
            <p className="text-stone-600 dark:text-stone-300">
              Ask anything about this project. The AI can see all {entryCount} {entryCount === 1 ? "entry" : "entries"} — your
              writing, recording transcripts, and saved links.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl bg-white px-4 py-2.5 text-left text-sm shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:ring-stone-800 dark:hover:bg-stone-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-white">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="prose-chat max-w-none text-[15px] leading-relaxed">
              {m.content ? (
                <ReactMarkdown>{m.content}</ReactMarkdown>
              ) : (
                <span className="inline-flex gap-1 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" />
                </span>
              )}
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-stone-200 bg-stone-50/90 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90"
      >
        {messages.length > 0 && !streaming && (
          <button type="button" onClick={clear} className="mb-2 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
            Clear conversation
          </button>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about this project…"
            className="input max-h-40 min-h-11 flex-1 resize-none"
          />
          <button
            disabled={streaming || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:opacity-40"
            aria-label="Send"
          >
            <SendIcon width={18} height={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
