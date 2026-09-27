import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export type EntryType = "text" | "audio" | "video" | "url";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  entry_count?: number;
}

export interface Entry {
  id: string;
  project_id: string;
  type: EntryType;
  title: string;
  body: string; // text content, or notes for media / links
  transcript: string; // audio/video transcript
  file_name: string | null; // stored file inside UPLOAD_DIR
  mime: string | null;
  url: string | null;
  url_title: string | null;
  url_text: string | null; // extracted page text
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const globalForDb = globalThis as unknown as { __journalDb?: Database.Database };

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "journal.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      image TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS projects_user ON projects(user_id, updated_at);
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('text','audio','video','url')),
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      transcript TEXT NOT NULL DEFAULT '',
      file_name TEXT,
      mime TEXT,
      url TEXT,
      url_title TEXT,
      url_text TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS entries_project ON entries(project_id, created_at);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS messages_project ON messages(project_id, created_at);
  `);
  return db;
}

export function db(): Database.Database {
  if (!globalForDb.__journalDb) globalForDb.__journalDb = open();
  return globalForDb.__journalDb;
}

export const newId = () => crypto.randomUUID();

// ---- users ----
export function upsertUser(u: User) {
  db()
    .prepare(
      `INSERT INTO users (id, email, name, image) VALUES (@id, @email, @name, @image)
       ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name, image=excluded.image`,
    )
    .run(u);
}

// ---- projects ----
export function listProjects(userId: string): Project[] {
  return db()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id) AS entry_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`,
    )
    .all(userId) as Project[];
}

export function getProject(userId: string, id: string): Project | undefined {
  return db()
    .prepare(`SELECT * FROM projects WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Project | undefined;
}

export function createProject(userId: string, name: string, description: string): Project {
  const id = newId();
  db()
    .prepare(`INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)`)
    .run(id, userId, name, description);
  return getProject(userId, id)!;
}

export function updateProject(userId: string, id: string, name: string, description: string) {
  db()
    .prepare(
      `UPDATE projects SET name = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ?`,
    )
    .run(name, description, id, userId);
}

export function touchProject(id: string) {
  db()
    .prepare(`UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(id);
}

export function deleteProject(userId: string, id: string) {
  const files = db()
    .prepare(
      `SELECT e.file_name FROM entries e JOIN projects p ON p.id = e.project_id
       WHERE p.id = ? AND p.user_id = ? AND e.file_name IS NOT NULL`,
    )
    .all(id, userId) as { file_name: string }[];
  db().prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`).run(id, userId);
  for (const f of files) removeUpload(f.file_name);
}

// ---- entries ----
export function listEntries(projectId: string): Entry[] {
  return db()
    .prepare(`SELECT * FROM entries WHERE project_id = ? ORDER BY created_at DESC`)
    .all(projectId) as Entry[];
}

/** Returns the entry only if it belongs to a project owned by userId. */
export function getEntryForUser(userId: string, id: string): Entry | undefined {
  return db()
    .prepare(
      `SELECT e.* FROM entries e JOIN projects p ON p.id = e.project_id
       WHERE e.id = ? AND p.user_id = ?`,
    )
    .get(id, userId) as Entry | undefined;
}

export function insertEntry(e: Omit<Entry, "id" | "created_at">): Entry {
  const id = newId();
  db()
    .prepare(
      `INSERT INTO entries (id, project_id, type, title, body, transcript, file_name, mime, url, url_title, url_text)
       VALUES (@id, @project_id, @type, @title, @body, @transcript, @file_name, @mime, @url, @url_title, @url_text)`,
    )
    .run({ id, ...e });
  touchProject(e.project_id);
  return db().prepare(`SELECT * FROM entries WHERE id = ?`).get(id) as Entry;
}

export function updateEntry(id: string, fields: Partial<Pick<Entry, "title" | "body" | "transcript">>) {
  const cur = db().prepare(`SELECT * FROM entries WHERE id = ?`).get(id) as Entry;
  const next = { ...cur, ...fields };
  db()
    .prepare(`UPDATE entries SET title = ?, body = ?, transcript = ? WHERE id = ?`)
    .run(next.title, next.body, next.transcript, id);
  return db().prepare(`SELECT * FROM entries WHERE id = ?`).get(id) as Entry;
}

export function deleteEntry(entry: Entry) {
  db().prepare(`DELETE FROM entries WHERE id = ?`).run(entry.id);
  if (entry.file_name) removeUpload(entry.file_name);
}

// ---- chat ----
export function listMessages(projectId: string): ChatMessage[] {
  return db()
    .prepare(`SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC, rowid ASC`)
    .all(projectId) as ChatMessage[];
}

export function insertMessage(projectId: string, role: ChatMessage["role"], content: string) {
  db()
    .prepare(`INSERT INTO messages (id, project_id, role, content) VALUES (?, ?, ?, ?)`)
    .run(newId(), projectId, role, content);
}

export function clearMessages(projectId: string) {
  db().prepare(`DELETE FROM messages WHERE project_id = ?`).run(projectId);
}

// ---- files ----
export function uploadPath(fileName: string) {
  // fileName is always generated server-side, but guard against traversal anyway.
  const p = path.join(UPLOAD_DIR, path.basename(fileName));
  return p;
}

function removeUpload(fileName: string) {
  fs.rm(uploadPath(fileName), { force: true }, () => {});
}
