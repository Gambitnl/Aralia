#!/usr/bin/env node
// Per-edge-case audit: how many edge cases across the Atlas carry a `spells`
// roster? Reports per-bucket coverage so authors can see which buckets still
// have chip-less edge cases.
//
// Run: node scripts/auditEdgeCaseSpells.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(
  process.cwd(),
  'src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx',
);
const text = readFileSync(SRC, 'utf8');

// --- Find each EXECUTION constant body ------------------------------------

function findExecutionBody(constName) {
  const decl = `const ${constName}: PhaseBlock[] = [`;
  const declAt = text.indexOf(decl);
  if (declAt < 0) return null;
  // Start AFTER the type annotation's `[]` - the literal array opens at the trailing `[`.
  const arrStart = declAt + decl.length - 1; // points at the literal `[`
  let depth = 0, i = arrStart;
  while (i < text.length) {
    const c = text[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return text.slice(arrStart, i + 1); }
    i++;
  }
  return null;
}

// --- Parse EXECUTION_BY_BUCKET --------------------------------------------

const ebbStart = text.indexOf("const EXECUTION_BY_BUCKET");
const ebbEnd = text.indexOf('};', ebbStart);
const ebbBlock = text.slice(ebbStart, ebbEnd);
const registered = [];
for (const m of ebbBlock.matchAll(/'([^']+)':\s*([A-Z_]+)/g)) {
  registered.push({ bucket: m[1], constName: m[2] });
}

// --- For each bucket, walk the body and count edge cases ------------------
//
// Strategy: every `edgeCases: [` opens a balanced array; each top-level `{`
// inside is one edge case object. We then check whether that object's body
// contains a `spells:` key.

function walkEdgeCases(bucketBody) {
  const cases = [];
  let i = 0;
  while (true) {
    const ecIdx = bucketBody.indexOf('edgeCases:', i);
    if (ecIdx < 0) break;
    const arrStart = bucketBody.indexOf('[', ecIdx);
    if (arrStart < 0) break;
    // Walk balanced brackets to find array end
    let depth = 0, p = arrStart;
    while (p < bucketBody.length) {
      const c = bucketBody[p];
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
      p++;
    }
    const arrBody = bucketBody.slice(arrStart + 1, p);

    // Walk top-level objects in the array
    let objDepth = 0, objStart = -1;
    for (let q = 0; q < arrBody.length; q++) {
      const c = arrBody[q];
      if (c === '{') {
        if (objDepth === 0) objStart = q;
        objDepth++;
      } else if (c === '}') {
        objDepth--;
        if (objDepth === 0 && objStart >= 0) {
          const objBody = arrBody.slice(objStart + 1, q);
          const labelMatch = objBody.match(/label:\s*'([^']+)'/);
          const statusMatch = objBody.match(/status:\s*'(open|in-progress|resolved|policy)'/);
          const hasSpells = /spells:\s*\[/.test(objBody);
          const spellCount = hasSpells
            ? [...objBody.matchAll(/\{\s*id:\s*'([^']+)'/g)].length
            : 0;
          cases.push({
            label: labelMatch ? labelMatch[1] : '(no label)',
            status: statusMatch ? statusMatch[1] : '(no status)',
            hasSpells,
            spellCount,
          });
          objStart = -1;
        }
      }
    }
    i = p + 1;
  }
  return cases;
}

// --- Run audit ------------------------------------------------------------

let totalCases = 0, withSpells = 0;
const perBucket = [];

for (const { bucket, constName } of registered) {
  const body = findExecutionBody(constName);
  if (!body) continue;
  const cases = walkEdgeCases(body);
  const withSpellsHere = cases.filter(c => c.hasSpells).length;
  const withoutHere = cases.filter(c => !c.hasSpells);
  totalCases += cases.length;
  withSpells += withSpellsHere;
  perBucket.push({ bucket, total: cases.length, withSpells: withSpellsHere, withoutHere });
}

console.log(`Atlas edge-case spell-roster audit\n`);
console.log(`Across ${perBucket.length} registered buckets:`);
console.log(`  ${totalCases} total edge cases`);
console.log(`  ${withSpells} carry a 'spells' roster (${((withSpells / totalCases) * 100).toFixed(1)}%)`);
console.log(`  ${totalCases - withSpells} chip-less\n`);

console.log(`Per-bucket coverage:\n`);
const colW = Math.max(...perBucket.map(p => p.bucket.length));
for (const p of perBucket) {
  const pct = p.total === 0 ? '   -' : `${((p.withSpells / p.total) * 100).toFixed(0).padStart(3)}%`;
  console.log(`  ${p.bucket.padEnd(colW)}  ${String(p.withSpells).padStart(3)}/${String(p.total).padStart(3)}  ${pct}`);
}

// List buckets with at least one chip-less edge case so the user can see specifics
console.log(`\nBuckets with chip-less edge cases:\n`);
for (const p of perBucket) {
  if (p.withoutHere.length === 0) continue;
  console.log(`  ${p.bucket}:`);
  for (const c of p.withoutHere) {
    console.log(`    - "${c.label}" [${c.status}]`);
  }
}
