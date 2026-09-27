"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, Entry, Project } from "@/lib/db";
import Chat from "./Chat";
import Composer, { ComposerButtons, type Mode } from "./Composer";
import EntryCard from "./EntryCard";
import { BackIcon, BookIcon, ChatIcon, MoreIcon } from "./icons";

export default function ProjectView({
  project: initialProject,
  entries: initialEntries,
  messages,
}: {
  project: Project;
  entries: Entry[];
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [entries, setEntries] = useState(initialEntries);
  const [tab, setTab] = useState<"journal" | "chat">("journal");
  const [mode, setMode] = useState<Mode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  // Transient feedback from the last save (e.g. a recording too large to transcribe).
  const [notice, setNotice] = useState<string | null>(null);

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProject(await api<Project>(`/api/projects/${project.id}`, { method: "PATCH", json: { name, description } }));
    setEditing(false);
  };

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}" and all its entries? This can't be undone.`)) return;
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/90 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-2">
          <Link href="/" className="rounded-full p-2 hover:bg-stone-200 dark:hover:bg-stone-800" aria-label="Back to projects">
            <BackIcon />
          </Link>
          <h1 className="flex-1 truncate text-lg font-semibold">{project.name}</h1>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="rounded-full p-2 hover:bg-stone-200 dark:hover:bg-stone-800" aria-label="Project menu">
              <MoreIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700" onMouseLeave={() => setMenuOpen(false)}>
                <button className="block w-full px-4 py-3 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onClick={() => { setEditing(true); setMenuOpen(false); }}>
                  Edit project
                </button>
                <button className="block w-full px-4 py-3 text-left text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800" onClick={deleteProject}>
                  Delete project
                </button>
              </div>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-2xl px-4">
          {([["journal", "Journal", BookIcon], ["chat", "Ask AI", ChatIcon]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-2.5 text-sm font-medium ${
                tab === key ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" : "border-transparent text-stone-500"
              }`}
            >
              <Icon width={16} height={16} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        {tab === "journal" ? (
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
            {editing ? (
              <form onSubmit={saveProject} className="mb-4 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                <textarea className="input min-h-20" placeholder="Description / goal of this project" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn-primary flex-1">Save</button>
                </div>
              </form>
            ) : (
              project.description && <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">{project.description}</p>
            )}

            {notice && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900">
                <p className="flex-1">{notice}</p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="shrink-0 font-medium text-amber-700 hover:underline dark:text-amber-300"
                  onClick={() => setNotice(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {entries.length === 0 ? (
              <div className="py-16 text-center text-stone-500">
                <p className="text-lg font-medium text-stone-700 dark:text-stone-300">Start your journal</p>
                <p className="mt-1 text-sm">Write, record audio or video, or save a link below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    onChange={(u) => setEntries((list) => list.map((x) => (x.id === u.id ? u : x)))}
                    onDelete={(id) => setEntries((list) => list.filter((x) => x.id !== id))}
                  />
                ))}
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-stone-50/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
              <div className="mx-auto max-w-2xl">
                <ComposerButtons onPick={setMode} />
              </div>
            </div>
          </div>
        ) : (
          <Chat projectId={project.id} initial={messages} entryCount={entries.length} />
        )}
      </main>

      {mode && (
        <Composer
          mode={mode}
          projectId={project.id}
          onClose={() => setMode(null)}
          onSaved={(e, saveNotice) => {
            setEntries((list) => [e, ...list]);
            setNotice(saveNotice ?? null);
            setMode(null);
          }}
        />
      )}
    </div>
  );
}
