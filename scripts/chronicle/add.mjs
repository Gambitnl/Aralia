/**
 * chronicle/add.mjs — append (or edit) a chronicle entry.
 *
 * Usage:
 *   node scripts/chronicle/add.mjs path/to/entry.json   # one entry or an array
 *   echo '<json>' | node scripts/chronicle/add.mjs -     # read JSON from stdin
 *
 * Entry shape (id + date are auto-filled if omitted):
 *   { "date":"YYYY-MM-DD HH:mm", "agent":"...", "categories":["Feature",...],
 *     "summary":"...", "actions":["..."], "challenges":"...", "next_steps":"..." }
 *
 * Inserts inside a transaction, then re-dumps misc/chronicle_data.json.
 */
import { readFileSync } from 'node:fs';
import { openDb, addEntry, exportJson } from './db.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/chronicle/add.mjs <entry.json | ->  (- reads JSON from stdin)');
  process.exit(1);
}

const raw = arg === '-' ? readFileSync(0, 'utf-8') : readFileSync(arg, 'utf-8');
const payload = JSON.parse(raw);
const entries = Array.isArray(payload) ? payload : [payload];

const db = openDb();
const insertMany = db.transaction((list) => list.map((e) => addEntry(db, e)));
const ids = insertMany(entries);
const total = exportJson(db);

console.log(`added/updated ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'}: ${ids.join(', ')}`);
console.log(`re-dumped ${total} total to misc/chronicle_data.json`);
