#!/usr/bin/env node

/*
 * Orphan triage generator (WF-G74): turns the raw orphan list from
 * import-hygiene.cjs into a dispositioned ledger at
 * scripts/quality/orphan-triage.json.
 *
 * Dispositions:
 *   GLOB-LOADED          imported via import.meta.glob pattern covering its dir
 *                        (scanner cannot see dynamic glob edges)
 *   BUILD-ENTRY          declared as a Vite rollup input in vite.config.ts
 *   NAME-REFERENCED      basename appears as a string token elsewhere in
 *                        tracked sources (by-name registry / data-driven use);
 *                        needs human eyes before any deletion
 *   SALVAGE-CANDIDATE    no mechanism found referencing it; deletion candidate,
 *                        still requires per-file audit before removal
 *
 * Re-run after code changes: node scripts/quality/orphan-triage.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { collectImportEdges } = require('./import-graph.cjs');

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

const SRC = path.join(repoRoot, 'src');
const EXTENSIONS = new Set(['.ts', '.tsx']);
const ORPHAN_EXCLUDE = [
  /(^|\/)main\.tsx?$/,
  /(^|\/)index\.tsx?$/,
  /(^|\/)__tests__\//,
  /\.test\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,
  /\.d\.ts$/,
  /(^|\/)vite-env\.[jt]s$/,
  /(^|\/)workers\//,
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(full, out);
    } else if (EXTENSIONS.has(path.extname(e.name)) && !e.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const { inbound } = collectImportEdges(repoRoot);

// Glob-discovery evidence: collect every import.meta.glob pattern string.
const globPatterns = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/import\.meta(?:\s+as\s+\w+)?\)?\s*\.\s*glob(?:\.lazy)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    globPatterns.push({ pattern: m[1], declaredIn: path.relative(repoRoot, file).replace(/\\/g, '/') });
  }
}
function globCovers(relPath) {
  for (const g of globPatterns) {
    // Patterns look like './leaves/*.tsx' or './*.ts' relative to their
    // declaring file's directory (declaredIn is already repo-relative).
    const dir = path.dirname(g.declaredIn);
    let base = g.pattern.replace(/\*\*?\*?[^/]*$/, ''); // strip the wildcard tail
    const absBase = path.resolve(repoRoot, dir, base);
    const relBase = path.relative(repoRoot, absBase).replace(/\\/g, '/');
    if (relPath.startsWith(relBase + '/')) return g;
  }
  return null;
}

// Build-entry basenames from vite.config.ts plus HTML module entries
// (misc/*.html pages are rollup inputs whose <script src> names entries).
const viteCfg = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
const htmlEntries = [];
for (const html of ['index.html', ...(fs.existsSync(path.join(repoRoot, 'misc')) ? fs.readdirSync(path.join(repoRoot, 'misc')).filter((f) => f.endsWith('.html')).map((f) => `misc/${f}`) : [])]) {
  const p = path.join(repoRoot, html);
  if (!fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/<script[^>]+src=["'`]([^"'`]+)["'`]/g)) {
    htmlEntries.push(m[1].replace(/^\//, ''));
  }
}
function isBuildEntry(relPath) {
  const base = path.basename(relPath);
  if (new RegExp(`['"\`]${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(viteCfg)) return true;
  return htmlEntries.some((e) => e === relPath || e.endsWith(base));
}

// Name-reference scan across all tracked sources (string-token lookup).
const nameIndex = new Map(); // basename -> count of quoting occurrences outside own file
for (const file of files) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/['"`]([A-Za-z0-9_.-]+)\.(?:ts|tsx)['"`]/g)) {
    const key = m[1];
    nameIndex.set(key, (nameIndex.get(key) || 0) + 1);
  }
}

const orphans = [];
for (const f of files) {
  if (inbound.has(f)) continue;
  const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
  if (ORPHAN_EXCLUDE.some((re) => re.test(rel))) continue;
  orphans.push(rel);
}

const ledger = { generatedAt: new Date().toISOString(), counts: {}, entries: {} };
for (const rel of orphans.sort()) {
  let disposition = 'SALVAGE-CANDIDATE';
  let evidence = 'no static importer, no glob coverage, not a build entry, basename unreferenced';
  const g = globCovers(rel);
  if (g) {
    disposition = 'GLOB-LOADED';
    evidence = `import.meta.glob('${g.pattern}') in ${g.declaredIn}`;
  } else if (isBuildEntry(rel)) {
    disposition = 'BUILD-ENTRY';
    evidence = 'basename declared in vite.config.ts rollup input';
  } else {
    const base = path.basename(rel, path.extname(rel));
    if (nameIndex.has(base)) {
      disposition = 'NAME-REFERENCED';
      evidence = `basename '${base}' appears as a quoted module token ${nameIndex.get(base)}x elsewhere`;
    }
  }
  ledger.entries[rel] = { disposition, evidence };
  ledger.counts[disposition] = (ledger.counts[disposition] || 0) + 1;
}
ledger.counts.total = orphans.length;

const out = path.join(__dirname, 'orphan-triage.json');
fs.writeFileSync(out, JSON.stringify(ledger, null, 2) + '\n');
console.log(`wrote ${path.relative(repoRoot, out)}`);
for (const [k, v] of Object.entries(ledger.counts)) console.log(`${k}: ${v}`);
