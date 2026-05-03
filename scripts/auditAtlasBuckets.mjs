#!/usr/bin/env node
// Audit every bucket in PreviewSpellDataFlow.tsx against the Atlas design rules.
// Run from repo root: node scripts/auditAtlasBuckets.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(
  process.cwd(),
  'src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx',
);
const text = readFileSync(SRC, 'utf8');
const TODAY = new Date('2026-05-02T18:00Z'); // from latest BUCKET_META timestamp

// --- Parse BUCKET_META ----------------------------------------------------

// Find the array literal AFTER the type annotation (`}> = [`).
const metaTypeEnd = text.indexOf('}> = [', text.indexOf('const BUCKET_META: Array<'));
const metaArrayStart = metaTypeEnd + '}> = ['.length - 1; // include the `[`
// Walk balanced brackets to find the matching `]`.
let _depth = 0, _i = metaArrayStart;
while (_i < text.length) {
  const c = text[_i];
  if (c === '[') _depth++;
  else if (c === ']') { _depth--; if (_depth === 0) break; }
  _i++;
}
const metaBlock = text.slice(metaArrayStart, _i + 1);

const metaRows = [];
// Single-line entries
for (const m of metaBlock.matchAll(/\{ bucket: '([^']+)', tracker: '([^']+)', kind: '([^']+)', phase1Gate: '([^']+)', phase2Gate: '([^']+)', lastUpdated: '([^']+)'(?:, note: '([^']*)')? \}/g)) {
  metaRows.push({ bucket: m[1], tracker: m[2], kind: m[3], phase1Gate: m[4], phase2Gate: m[5], lastUpdated: m[6], note: m[7] });
}
// Multi-line entries (Conditions today)
for (const m of metaBlock.matchAll(/\{\s*bucket:\s*'([^']+)',\s*tracker:\s*'([^']+)',\s*kind:\s*'([^']+)',\s*phase1Gate:\s*'([^']+)',\s*phase2Gate:\s*'([^']+)',\s*lastUpdated:\s*'([^']+)',\s*note:\s*'([^']*)',?\s*\}/g)) {
  if (!metaRows.find(r => r.bucket === m[1])) {
    metaRows.push({ bucket: m[1], tracker: m[2], kind: m[3], phase1Gate: m[4], phase2Gate: m[5], lastUpdated: m[6], note: m[7] });
  }
}

// --- Parse EXECUTION_BY_BUCKET --------------------------------------------

const ebbStart = text.indexOf("const EXECUTION_BY_BUCKET");
const ebbEnd = text.indexOf('};', ebbStart);
const ebbBlock = text.slice(ebbStart, ebbEnd);
const registered = new Map();
for (const m of ebbBlock.matchAll(/'([^']+)':\s*([A-Z_]+)/g)) {
  registered.set(m[1], m[2]);
}

// --- Find the body of each EXECUTION constant -----------------------------

function findExecutionBody(constName) {
  const start = text.indexOf(`const ${constName}: PhaseBlock[] = [`);
  if (start < 0) return null;
  // Walk balanced brackets
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    i++;
  }
  return null;
}

// --- Per-step / per-phase parsing -----------------------------------------

function parsePhases(body) {
  // Each phase block starts with `phase: 'Phase ...'`. We approximate by
  // splitting on top-level `phase:` markers.
  const phases = [];
  const re = /phase:\s*'(Phase \d[^']*)'[^]*?(?=phase:\s*'Phase \d|\];)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const phaseLabel = m[1];
    const chunk = m[0];
    // step statuses
    const statuses = [...chunk.matchAll(/status:\s*'(active|done|queued)'/g)].map(s => s[1]);
    // subbucket slugs
    const subbuckets = [...chunk.matchAll(/subbucket:\s*'([^']+)'/g)].map(s => s[1]);
    // count + countValue pairs (heuristic: order in source)
    const counts = [...chunk.matchAll(/count:\s*'([^']+)'/g)].map(s => s[1]);
    const countValues = [...chunk.matchAll(/countValue:\s*([\-0-9]+|null)/g)].map(s => s[1]);
    // edge case statuses (excluding step statuses already grabbed)
    // (matchAll order preserves source order, both kinds of statuses share the same key name)
    // Edge-case statuses
    const edgeStatuses = [...chunk.matchAll(/status:\s*'(open|in-progress|resolved|policy)'/g)].map(s => s[1]);
    // dependsOn / overlapsWith references
    const refs = [
      ...[...chunk.matchAll(/dependsOn:\s*\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(r => ['dependsOn', r[1]])),
      ...[...chunk.matchAll(/overlapsWith:\s*\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(r => ['overlapsWith', r[1]])),
    ];
    phases.push({ phaseLabel, statuses, subbuckets, counts, countValues, edgeStatuses, refs });
  }
  return phases;
}

function isSnakeCase(slug) {
  return /^[a-z][a-z0-9_]*$/.test(slug);
}

const VALID_REF_BUCKETS = new Set([
  'Classes', 'Sub-Classes', 'Casting Time', 'Range/Area', 'Components',
  'Material Component', 'Duration', 'Description', 'Higher Levels',
  'School', 'Damage Type', 'Attack-Roll Riders', 'Conditions',
  'Summoned Entities', 'Structured Markdown',
]);

// --- Run audit ------------------------------------------------------------

const findings = [];

for (const meta of metaRows) {
  const bucket = meta.bucket;
  const constName = registered.get(bucket);
  if (!constName) {
    findings.push({ bucket, severity: 'critical', note: `not registered in EXECUTION_BY_BUCKET` });
    continue;
  }
  const body = findExecutionBody(constName);
  if (!body) {
    findings.push({ bucket, severity: 'critical', note: `${constName} body not found in source` });
    continue;
  }

  // lastUpdated freshness
  const ageDays = Math.floor((TODAY - new Date(meta.lastUpdated)) / (1000 * 60 * 60 * 24));
  if (ageDays > 30) {
    findings.push({ bucket, severity: 'high', note: `lastUpdated rose-stale (${ageDays}d old)` });
  } else if (ageDays > 7) {
    findings.push({ bucket, severity: 'medium', note: `lastUpdated amber-stale (${ageDays}d old)` });
  }

  const phases = parsePhases(body);

  const phase1 = phases.find(p => p.phaseLabel.startsWith('Phase 1'));
  const phase1Open = phase1 && phase1.statuses.length > 0 && phase1.statuses.some(s => s !== 'done');

  for (const phase of phases) {
    // Phase 2 / Phase 3 should not have `active` steps while Phase 1 is open
    if ((phase.phaseLabel.startsWith('Phase 2') || phase.phaseLabel.startsWith('Phase 3')) && phase1Open) {
      const activeInLater = phase.statuses.filter(s => s === 'active').length;
      if (activeInLater > 0) {
        findings.push({
          bucket,
          severity: 'high',
          note: `Gap 15 violation: ${activeInLater} 'active' step(s) in ${phase.phaseLabel} while Phase 1 has open work`,
        });
      }
    }

    // Subbucket slug normalization
    for (const slug of phase.subbuckets) {
      if (!isSnakeCase(slug)) {
        findings.push({
          bucket,
          severity: 'medium',
          note: `non-snake_case subbucket slug in ${phase.phaseLabel}: '${slug}'`,
        });
      }
    }
  }

  // Phase 1 vacuously complete checks
  if (meta.phase1Gate === 'n/a' && phase1 && phase1.statuses.length > 0) {
    findings.push({
      bucket,
      severity: 'low',
      note: `phase1Gate='n/a' but Phase 1 has ${phase1.statuses.length} step(s) authored - inconsistent shape`,
    });
  }

  // Active step count - exactly 0 (idle) or 1 (active) per bucket
  const allStatuses = phases.flatMap(p => p.statuses);
  const activeCount = allStatuses.filter(s => s === 'active').length;
  if (activeCount > 1) {
    findings.push({
      bucket,
      severity: 'medium',
      note: `${activeCount} steps marked 'active' across all phases - convention is at most 1 active per bucket`,
    });
  }

  // dependsOn / overlapsWith reference shape: '<Bucket>:<subbucket_slug>'
  for (const phase of phases) {
    for (const [field, ref] of phase.refs) {
      const colonIdx = ref.indexOf(':');
      if (colonIdx < 0) {
        findings.push({ bucket, severity: 'medium', note: `${field} reference missing ':' separator: '${ref}'` });
        continue;
      }
      const targetBucket = ref.slice(0, colonIdx);
      const targetSlug = ref.slice(colonIdx + 1);
      if (!VALID_REF_BUCKETS.has(targetBucket)) {
        findings.push({ bucket, severity: 'medium', note: `${field} references unknown bucket '${targetBucket}' (full ref: '${ref}')` });
      }
      if (!isSnakeCase(targetSlug)) {
        findings.push({ bucket, severity: 'medium', note: `${field} target slug not snake_case: '${ref}'` });
      }
    }
  }

  // countValue parity: when `count` is `'N spells'` or `'N live'`, countValue should usually be set
  // (heuristic - not all "N spells" need countValue, but missing it is a smell)
  for (const phase of phases) {
    const numericCounts = phase.counts.filter(c => /^\d+\s/.test(c));
    if (numericCounts.length > phase.countValues.length) {
      const missing = numericCounts.length - phase.countValues.length;
      findings.push({
        bucket,
        severity: 'low',
        note: `${phase.phaseLabel}: ${missing} numeric-count step(s) without countValue (heuristic)`,
      });
    }
  }
}

// --- Cross-check: dead EXECUTION constants --------------------------------

const allExecConsts = [...text.matchAll(/^const ([A-Z_]+)_EXECUTION(?:_[A-Z_]+)?: PhaseBlock\[\]/gm)].map(m => `${m[1]}_EXECUTION${m[0].includes('_FIRST') ? '_CANONICAL_FIRST' : ''}`);
const allExecConstsRaw = [...text.matchAll(/^const ([A-Z_]+): PhaseBlock\[\]/gm)].map(m => m[1]);
const registeredConsts = new Set([...registered.values()]);
for (const cn of allExecConstsRaw) {
  if (cn === 'STUB_EXECUTION' || cn === 'EMPTY_BUCKET_EXECUTION') continue;
  if (!registeredConsts.has(cn)) {
    findings.push({ bucket: '(orphan)', severity: 'low', note: `dead EXECUTION constant: ${cn} (declared but not in EXECUTION_BY_BUCKET)` });
  }
}

// --- Cross-check: registered constants that aren't in BUCKET_META ---------

for (const [bucket] of registered) {
  if (!metaRows.find(m => m.bucket === bucket)) {
    findings.push({
      bucket,
      severity: 'critical',
      note: `registered in EXECUTION_BY_BUCKET but not in BUCKET_META`,
    });
  }
}

// --- Cross-check: BUCKET_META count vs registered count -------------------

console.log(`Buckets in BUCKET_META: ${metaRows.length}`);
console.log(`Buckets registered in EXECUTION_BY_BUCKET: ${registered.size}`);
console.log(`Today (anchor): ${TODAY.toISOString().slice(0, 10)}`);
console.log();

// --- Report ---------------------------------------------------------------

if (findings.length === 0) {
  console.log('All buckets adhere to the Atlas design.');
  process.exit(0);
}

const order = { critical: 0, high: 1, medium: 2, low: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.bucket.localeCompare(b.bucket));

console.log(`${findings.length} finding(s):\n`);
for (const f of findings) {
  console.log(`  [${f.severity.toUpperCase()}] ${f.bucket}: ${f.note}`);
}
