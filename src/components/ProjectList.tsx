"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/db";
import { PlusIcon } from "./icons";

export default function ProjectList({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(projects.length === 0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api<Project>("/api/projects", { method: "POST", json: { name, description } });
      router.push(`/projects/${p.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {creating ? (
        <form onSubmit={create} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <h2 className="font-semibold">New project</h2>
          <input className="input" placeholder="e.g. Kitchen remodel, Startup idea, Learning Spanish" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <textarea className="input min-h-20" placeholder="What's this project about? (optional — helps the AI)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            {projects.length > 0 && (
              <button type="button" className="btn-secondary flex-1" onClick={() => setCreating(false)}>
                Cancel
              </button>
            )}
            <button className="btn-primary flex-1" disabled={busy}>
              Create project
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-4 font-medium text-stone-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-stone-700 dark:text-stone-300"
        >
          <PlusIcon /> New project
        </button>
      )}

      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-indigo-300 active:scale-[0.99] dark:bg-stone-900 dark:ring-stone-800"
        >
          <h3 className="font-semibold">{p.name}</h3>
          {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{p.description}</p>}
          <p className="mt-2 text-xs text-stone-500" suppressHydrationWarning>
            {p.entry_count ?? 0} {p.entry_count === 1 ? "entry" : "entries"} · Updated {formatDate(p.updated_at)}
          </p>
        </Link>
      ))}
    </div>
  );
}
