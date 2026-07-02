/**
 * chronicle/db.mjs — SQLite-backed store for the Development Chronicle.
 *
 * The DB (misc/chronicle/chronicle.db) is the single source of truth. Writers
 * insert through here in a transaction (SQLite serializes concurrent writers,
 * so parallel agents can't clobber each other the way the old read-whole-file /
 * rewrite-whole-file JSON procedure did). After each write we re-dump the whole
 * DB to misc/chronicle_data.json so the existing static viewer (misc/chronicle
 * .html, which fetches that file) keeps working with zero changes. The JSON is a
 * throwaway cache — if two agents re-dump at once, nothing is lost because every
 * row already lives in the DB.
 */
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // repo root
export const DB_PATH = resolve(ROOT, 'misc/chronicle/chronicle.db');
export const JSON_PATH = resolve(ROOT, 'misc/chronicle_data.json');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  agent      TEXT,
  summary    TEXT,
  challenges TEXT,
  next_steps TEXT,
  categories TEXT NOT NULL DEFAULT '[]', -- JSON array
  actions    TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
`;

export function openDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // concurrent readers + one writer
  db.pragma('busy_timeout = 5000'); // wait, don't error, if another writer holds the lock
  db.exec(SCHEMA);
  return db;
}

const pad = (n) => String(n).padStart(2, '0');
function nowStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function slugify(s = '') {
  const parts = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').filter(Boolean);
  return parts.slice(0, 6).join('-') || 'entry';
}

/** Coerce a loose entry object into the stored column shape (id/date auto-filled). */
export function normalizeEntry(e) {
  if (!e || typeof e !== 'object') throw new Error('entry must be an object');
  const date = e.date || nowStamp();
  const id = e.id || `${date.slice(0, 10)}-${slugify(e.summary)}`;
  return {
    id,
    date,
    agent: e.agent ?? null,
    summary: e.summary ?? null,
    challenges: e.challenges ?? null,
    next_steps: e.next_steps ?? null,
    categories: JSON.stringify(Array.isArray(e.categories) ? e.categories : []),
    actions: JSON.stringify(Array.isArray(e.actions) ? e.actions : []),
  };
}

/** Upsert one entry (edit an existing id by re-adding it). Returns the id. */
export function addEntry(db, entry) {
  const e = normalizeEntry(entry);
  db.prepare(`
    INSERT INTO entries (id, date, agent, summary, challenges, next_steps, categories, actions)
    VALUES (@id, @date, @agent, @summary, @challenges, @next_steps, @categories, @actions)
    ON CONFLICT(id) DO UPDATE SET
      date=excluded.date, agent=excluded.agent, summary=excluded.summary,
      challenges=excluded.challenges, next_steps=excluded.next_steps,
      categories=excluded.categories, actions=excluded.actions
  `).run(e);
  return e.id;
}

/** All entries, oldest first, in the original chronicle_data.json field shape. */
export function allEntries(db) {
  const rows = db
    .prepare('SELECT id, date, agent, categories, summary, actions, challenges, next_steps FROM entries ORDER BY date ASC, id ASC')
    .all();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    agent: r.agent,
    categories: JSON.parse(r.categories || '[]'),
    summary: r.summary,
    actions: JSON.parse(r.actions || '[]'),
    challenges: r.challenges,
    next_steps: r.next_steps,
  }));
}

/** Re-dump the whole DB to misc/chronicle_data.json for the static viewer. */
export function exportJson(db) {
  const entries = allEntries(db);
  writeFileSync(JSON_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
  return entries.length;
}
