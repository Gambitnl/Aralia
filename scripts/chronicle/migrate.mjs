/**
 * chronicle/migrate.mjs — one-time import of the legacy misc/chronicle_data.json
 * array into the SQLite DB. Idempotent (entries upsert by id), so it's safe to
 * re-run. After import it re-dumps the JSON from the DB.
 *
 * Usage: node scripts/chronicle/migrate.mjs [source.json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { openDb, addEntry, exportJson, JSON_PATH } from './db.mjs';

const src = process.argv[2] || JSON_PATH;
if (!existsSync(src)) {
  console.error(`no source json at ${src}`);
  process.exit(1);
}

const entries = JSON.parse(readFileSync(src, 'utf-8'));
if (!Array.isArray(entries)) {
  console.error('source json is not an array of entries');
  process.exit(1);
}

const db = openDb();
const insertMany = db.transaction((list) => list.map((e) => addEntry(db, e)));
const ids = insertMany(entries);
const total = exportJson(db);

console.log(`migrated ${ids.length} entries into the DB; re-dumped ${total} total`);
