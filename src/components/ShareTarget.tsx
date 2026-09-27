"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Entry, Project } from "@/lib/db";
import { formatDate } from "@/lib/format";

/**
 * Confirmation step for a shared link: pick the project it belongs to (or
 * create one), optionally add a note, then save it as a `url` entry.
 */
export default function ShareTarget({
  projects,
  url,
  title,
  note,
}: {
  projects: Project[];
  url: string;
  title: string;
  note: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState(url);
  const [body, setBody] = useState(note);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [creatingProject, setCreatingProject] = useState(projects.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let target = projectId;
      if (creatingProject) {
        const project = await api<Project>("/api/projects", { method: "POST", json: { name: newName } });
        target = project.id;
      }
      await api<Entry>(`/api/projects/${target}/entries`, {
        method: "POST",
        json: { type: "url", url: link, title, body },
      });
      router.push(`/projects/${target}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Save link</h1>
        {title && <p className="mt-1 text-sm font-medium text-stone-700 dark:text-stone-300">{title}</p>}
      </header>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Link</span>
        <input
          className="input"
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
          required
          autoFocus={!link}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Note <span className="font-normal text-stone-500">(optional)</span></span>
        <textarea
          className="input min-h-20"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Why does this matter to the project?"
        />
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium">Project</span>
        {creatingProject ? (
          <div className="space-y-2">
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New project name"
              required
              autoFocus={!!link}
            />
            {projects.length > 0 && (
              <button type="button" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setCreatingProject(false)}>
                Choose an existing project instead
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-2">
              {projects.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 ring-1 transition dark:bg-stone-900 ${
                    projectId === p.id ? "ring-2 ring-indigo-500" : "ring-stone-200 dark:ring-stone-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="project"
                    className="h-4 w-4 accent-indigo-600"
                    checked={projectId === p.id}
                    onChange={() => setProjectId(p.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-xs text-stone-500">Updated {formatDate(p.updated_at)}</span>
                  </span>
                </label>
              ))}
            </div>
            <button type="button" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setCreatingProject(true)}>
              New project instead
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={() => router.push("/")} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary flex-1" disabled={busy || !link.trim()}>
          {busy ? "Saving…" : "Save link"}
        </button>
      </div>
    </form>
  );
}
