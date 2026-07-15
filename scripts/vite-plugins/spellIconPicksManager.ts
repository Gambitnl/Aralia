/**
 * Spell Icon Picks + Coverage Manager — backs the design-preview Spell Icons section.
 *
 *   GET  /api/spell-icon-picks            → { picks: { [spellId]: "c2-v3", ... } }
 *   POST /api/spell-icon-picks {id, slot} → set one pick (slot null/"" clears it)
 *   GET  /api/spell-icon-coverage         → { coverage: { [spellId]: {...} } }
 *
 * Coverage reports what is actually on disk per spell, which the lazy-loading UI
 * cannot know. It powers the has-icons / partial / none / overlapping filters.
 *
 * OVERLAP DETECTION — why it is NOT a byte hash.
 * The first version hashed the files and looked for identical bytes. That test is
 * useless in practice: the 2026-07-14 Jules batch scored "0 overlapping" while its
 * three supposedly-distinct concepts shared 88-94% of their markup (one dark-circle
 * + runic-ring scaffold with a small glyph swapped in the middle), and v3 was 96%
 * identical to v2. Nothing was byte-identical, so nothing was flagged.
 *
 * So we measure real content similarity (Jaccard over character trigrams of the
 * normalised markup) and report the two failure modes that actually matter:
 *   - conceptsSimilar: the 3 CONCEPTS are near-copies of each other → you have 1
 *     idea, not 3, so there is nothing to choose between.
 *   - versionsStagnant: v2→v3 barely changed → the iteration did no work.
 *
 * Picks live in public/data/spell-icon-picks.json so they survive reloads and can
 * drive a later promotion pass. No secrets, no credentials — just the choices.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PICKS_FILE = path.join(process.cwd(), 'public', 'data', 'spell-icon-picks.json');
const ICONS_DIR = path.join(process.cwd(), 'public', 'assets', 'icons', 'spells');

const SLOTS: string[] = [];
for (let c = 1; c <= 3; c++) for (let v = 1; v <= 3; v++) SLOTS.push(`c${c}-v${v}`);

/** Two icons this alike are the same picture. Distinct concepts sit well below this. */
const CONCEPT_SIMILARITY_LIMIT = 0.85;
/** An "improvement" this close to its predecessor did nothing. */
const VERSION_STAGNANT_LIMIT = 0.93;

interface SimilarPair { a: string; b: string; score: number; }

interface SpellCoverage {
  /** How many of the 9 candidate files exist (0 to 9). */
  count: number;
  /** Which slots exist, e.g. ["c1-v1", "c2-v3"]. */
  present: string[];
  /** Groups of slots whose SVG bytes are identical (exact copies). */
  duplicates: string[][];
  /** Concept-vs-concept pairs (same version) that are too alike. */
  conceptsSimilar: SimilarPair[];
  /** Version-vs-next-version pairs (same concept) that barely changed. */
  versionsStagnant: SimilarPair[];
  /** Worst concept-vs-concept score seen, 0 to 1. Handy for sorting. */
  worstConceptScore: number;
  /** True when this spell has any overlap problem worth showing. */
  overlapping: boolean;
}

/** Cheap, stable text signature of an SVG: collapse whitespace, drop ids. */
function normaliseSvg(text: string): string {
  return text.replace(/\bid="[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function trigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3));
  return set;
}

/** Jaccard similarity of two trigram sets, 0 (nothing shared) to 1 (identical). */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Re-reading and trigramming 4,000+ files per request is wasteful; cache on mtime. */
const sigCache = new Map<string, { mtimeMs: number; grams: Set<string>; hash: string }>();

function signatureOf(file: string): { grams: Set<string>; hash: string } | null {
  let stat: fs.Stats;
  try { stat = fs.statSync(file); } catch { return null; }
  const hit = sigCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit;
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const entry = {
    mtimeMs: stat.mtimeMs,
    grams: trigrams(normaliseSvg(text)),
    hash: crypto.createHash('sha1').update(text).digest('hex'),
  };
  sigCache.set(file, entry);
  return entry;
}

/**
 * Scan the icons folder. One entry per spell folder that exists. Spells with no
 * folder are simply absent, and the caller treats them as count 0.
 */
function readCoverage(): Record<string, SpellCoverage> {
  const out: Record<string, SpellCoverage> = {};
  let spellDirs: string[];
  try {
    spellDirs = fs.readdirSync(ICONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return out;
  }

  for (const id of spellDirs) {
    const present: string[] = [];
    const grams = new Map<string, Set<string>>();
    const byHash = new Map<string, string[]>();

    for (const slot of SLOTS) {
      const sig = signatureOf(path.join(ICONS_DIR, id, `${slot}.svg`));
      if (!sig) continue;
      present.push(slot);
      grams.set(slot, sig.grams);
      const group = byHash.get(sig.hash) || [];
      group.push(slot);
      byHash.set(sig.hash, group);
    }

    const duplicates = [...byHash.values()].filter((g) => g.length > 1);

    // Concepts should be different IDEAS. Compare c1/c2/c3 at the same version.
    const conceptsSimilar: SimilarPair[] = [];
    let worstConceptScore = 0;
    for (let v = 1; v <= 3; v++) {
      for (const [ca, cb] of [[1, 2], [1, 3], [2, 3]]) {
        const a = `c${ca}-v${v}`;
        const b = `c${cb}-v${v}`;
        const ga = grams.get(a);
        const gb = grams.get(b);
        if (!ga || !gb) continue;
        const score = similarity(ga, gb);
        if (score > worstConceptScore) worstConceptScore = score;
        if (score >= CONCEPT_SIMILARITY_LIMIT) {
          conceptsSimilar.push({ a, b, score: Math.round(score * 100) / 100 });
        }
      }
    }

    // Each version should be a real improvement on the last.
    const versionsStagnant: SimilarPair[] = [];
    for (let c = 1; c <= 3; c++) {
      for (const [va, vb] of [[1, 2], [2, 3]]) {
        const a = `c${c}-v${va}`;
        const b = `c${c}-v${vb}`;
        const ga = grams.get(a);
        const gb = grams.get(b);
        if (!ga || !gb) continue;
        const score = similarity(ga, gb);
        if (score >= VERSION_STAGNANT_LIMIT) {
          versionsStagnant.push({ a, b, score: Math.round(score * 100) / 100 });
        }
      }
    }

    out[id] = {
      count: present.length,
      present,
      duplicates,
      conceptsSimilar,
      versionsStagnant,
      worstConceptScore: Math.round(worstConceptScore * 100) / 100,
      overlapping: duplicates.length > 0 || conceptsSimilar.length > 0,
    };
  }
  return out;
}

function readPicks(): Record<string, string> {
  try {
    const raw = fs.readFileSync(PICKS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return (data && typeof data.picks === 'object' && data.picks) || {};
  } catch {
    return {};
  }
}

function writePicks(picks: Record<string, string>): void {
  fs.mkdirSync(path.dirname(PICKS_FILE), { recursive: true });
  fs.writeFileSync(PICKS_FILE, JSON.stringify({ picks }, null, 2) + '\n');
}

function readBody(req: { on: (e: string, cb: (c?: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { if (c) body += c.toString(); });
    req.on('end', () => resolve(body));
  });
}

export const spellIconPicksManager = () => ({
  name: 'spell-icon-picks-manager',
  configureServer(server: { middlewares: { use: (h: (req: any, res: any, next: any) => void) => void } }) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];

      if (urlPath === '/api/spell-icon-coverage') {
        res.setHeader('Content-Type', 'application/json');
        try {
          res.end(JSON.stringify({ coverage: readCoverage() }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ coverage: {}, error: (e as Error).message }));
        }
        return;
      }

      if (urlPath !== '/api/spell-icon-picks') { next(); return; }
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET') {
        res.end(JSON.stringify({ picks: readPicks() }));
        return;
      }
      if (req.method === 'POST') {
        try {
          const body = JSON.parse((await readBody(req)) || '{}');
          const id = String(body.id || '').trim();
          if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: 'missing id' })); return; }
          const picks = readPicks();
          const slot = String(body.slot || '').trim();
          if (slot) picks[id] = slot; else delete picks[id];
          writePicks(picks);
          res.end(JSON.stringify({ ok: true, picks }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
        return;
      }
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'use GET or POST' }));
    });
  },
});
