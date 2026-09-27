import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, Entry, Project } from "@/lib/db";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

let client: Anthropic | undefined;
export const anthropic = () => (client ??= new Anthropic());

const INSTRUCTIONS = `You are a thoughtful assistant inside a personal journaling app. The user keeps a journal for a project, made of written notes, audio and video recordings (provided to you as transcripts), and saved web links (provided as extracted page text).

Answer using the journal as your primary source. When you draw on a specific entry, mention it by its date or title so the user can find it. If the journal doesn't contain what's needed to answer, say so plainly, then offer general knowledge if it helps. Transcripts may contain speech-recognition errors; interpret them charitably. Use Markdown formatting where it aids readability.`;

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/[\r\n]+/g, " ");
}

function renderEntry(e: Entry): string {
  const attrs = [`type="${e.type}"`, `date="${e.created_at}"`];
  if (e.title) attrs.push(`title="${escapeAttr(e.title)}"`);
  if (e.url) attrs.push(`url="${escapeAttr(e.url)}"`);
  const parts: string[] = [];
  if (e.body) parts.push(e.type === "text" ? e.body : `<notes>\n${e.body}\n</notes>`);
  if (e.type === "audio" || e.type === "video") {
    parts.push(`<transcript>\n${e.transcript || "(no transcript available)"}\n</transcript>`);
  }
  if (e.type === "url") {
    if (e.url_title) parts.push(`<page_title>${e.url_title}</page_title>`);
    parts.push(`<page_text>\n${e.url_text || "(page text could not be extracted)"}\n</page_text>`);
  }
  return `<entry ${attrs.join(" ")}>\n${parts.join("\n")}\n</entry>`;
}

/** Builds the system prompt: fixed instructions first, then the project journal (oldest first). */
export function buildSystem(project: Project, entries: Entry[]): Anthropic.TextBlockParam[] {
  const chronological = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const journal = `<project name="${escapeAttr(project.name)}">
${project.description ? `<description>\n${project.description}\n</description>\n` : ""}<journal entry_count="${entries.length}">
${chronological.map(renderEntry).join("\n\n") || "(no entries yet)"}
</journal>
</project>`;
  return [
    { type: "text", text: INSTRUCTIONS },
    // Cache the journal: it is re-sent on every chat turn and only changes when entries change.
    { type: "text", text: journal, cache_control: { type: "ephemeral" } },
  ];
}

export function toMessageParams(history: ChatMessage[]): Anthropic.MessageParam[] {
  return history.map((m) => ({ role: m.role, content: m.content }));
}
