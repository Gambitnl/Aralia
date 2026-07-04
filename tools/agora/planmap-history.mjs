// Plan-map history generator. Reconstructs a dated, per-day timeline of
// topics.json from git (the repo auto-commits a daily snapshot), so the
// plan-map's date-progression tracker needs zero manual dating. Writes
// public/planmap/history.json. Run: node tools/agora/planmap-history.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = 'public/planmap/topics.json';
const OUT = 'public/planmap/history.json';

export function parseSnapshot(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j.topics) ? j.topics : null;
  } catch {
    return null;
  }
}

export function collapseDaily(commits) {
  // Map keeps insertion order; a later same-day commit overwrites the value
  // but keeps the day's original slot. commits arrive oldest -> newest.
  const byDay = new Map();
  for (const c of commits) {
    if (!c.topics) continue; // skip unparseable historical snapshots
    const date = c.dateISO.slice(0, 10);
    byDay.set(date, { date, commit: c.hash, topics: c.topics });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildHistory(commits) {
  return { generatedAt: new Date().toISOString(), days: collapseDaily(commits) };
}

function gitCommits(file) {
  const log = execFileSync('git', ['log', '--reverse', '--format=%H|%cI', '--', file], { encoding: 'utf8' }).trim();
  if (!log) return [];
  return log.split('\n').map(line => {
    const [hash, dateISO] = line.split('|');
    let topics = null;
    try {
      topics = parseSnapshot(execFileSync('git', ['show', `${hash}:${file}`], { encoding: 'utf8' }));
    } catch { /* commit predates the file or blob missing — leave null */ }
    return { hash, dateISO, topics };
  });
}

function main() {
  const history = buildHistory(gitCommits(FILE));
  writeFileSync(OUT, JSON.stringify(history, null, 2) + '\n');
  console.log(`plan-map history: ${history.days.length} day(s) written to ${OUT}`);
}

// Run main only when invoked directly, not when imported by the test.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
