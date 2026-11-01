#!/usr/bin/env node
/**
 * @file scripts/quality/bundle-budget.mjs
 * First-load JavaScript budget for the built game page (C13, agora-9ed9.13).
 *
 * "First load" is what dist/index.html fetches before any lazy import fires:
 * the entry script plus every modulepreload. The script sums those files'
 * gzip sizes and fails when the total passes the budget in
 * scripts/quality/bundle-budget.json. A rise in that number usually means a
 * lazy-only library (three.js, a 3D helper, a big data table) slipped into an
 * eager chunk, as gainmap-js did through vendor-others (fixed in C13).
 *
 * Usage: node scripts/quality/bundle-budget.mjs [distDir]   (default: dist)
 * Raise the budget only on purpose, in the same change as the code that needs it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = path.join(HERE, 'bundle-budget.json');

/** Lists the first-load JS files named by index.html, relative to distDir. */
export function initialScripts(indexHtml) {
  const refs = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+\.js)"[^>]*>/g)]
    .map((match) => match[1])
    .filter((ref) => !/^https?:\/\//.test(ref));
  // Strip the deploy base (for example /Aralia/) so paths resolve inside dist.
  return [...new Set(refs.map((ref) => ref.replace(/^\/[^/]+\/(?=assets\/)/, '').replace(/^\//, '')))];
}

/** Measures the first load of a built page. */
export function measureInitialBundle(distDir) {
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const files = initialScripts(html).map((ref) => {
    const buffer = readFileSync(path.join(distDir, ref));
    return { file: ref, rawBytes: buffer.length, gzipBytes: gzipSync(buffer).length };
  });
  return {
    files: files.sort((a, b) => b.gzipBytes - a.gzipBytes),
    rawBytes: files.reduce((sum, row) => sum + row.rawBytes, 0),
    gzipBytes: files.reduce((sum, row) => sum + row.gzipBytes, 0),
  };
}

/** Compares a measurement with a budget; returns { ok, lines }. */
export function checkBudget(measurement, budget) {
  const kib = (bytes) => (bytes / 1024).toFixed(0);
  const limit = budget.initialGzipKiB * 1024;
  const lines = [`First-load JS: ${measurement.files.length} files, ${kib(measurement.rawBytes)} KiB raw, ${kib(measurement.gzipBytes)} KiB gzip (budget ${budget.initialGzipKiB} KiB gzip).`];
  for (const row of measurement.files.slice(0, 8)) {
    lines.push(`  ${kib(row.gzipBytes).padStart(5)} KiB gzip  ${row.file}`);
  }
  const ok = measurement.gzipBytes <= limit;
  lines.push(ok
    ? 'PASS: first-load JS is within budget.'
    : `FAIL: first-load JS is ${kib(measurement.gzipBytes - limit)} KiB gzip over budget. Find the eager chunk that grew (often a lazy-only library pulled in by a shared chunk); raise ${path.basename(BUDGET_FILE)} only on purpose.`);
  return { ok, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const distDir = path.resolve(process.argv[2] ?? 'dist');
  if (!existsSync(path.join(distDir, 'index.html'))) {
    console.error(`No built page at ${path.join(distDir, 'index.html')}. Run the build first.`);
    process.exitCode = 2;
  } else {
    const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
    const { ok, lines } = checkBudget(measureInitialBundle(distDir), budget);
    for (const line of lines) console.log(line);
    process.exitCode = ok ? 0 : 1;
  }
}
