// tools/creatureGate/nightly.mjs — the part-quality regression loop.
//
//   node tools/creatureGate/nightly.mjs [--out <dir>]
//
// One unattended pass over the whole creature library plus the fixed
// part-review roster:
//   1. silhouette-sweep every library plan (sweep.mjs, 4 views) + gate floors
//   2. part-sweep the fixed roster (partSweep.mjs)
//   3. diff the gate report against the stored baseline
//      (.agent/part-quality/baseline.json) — NEW floor flags are regressions,
//      resolved flags are wins
//   4. write <out>/nightly-<date>.md + latest report.json
//
// The blind-reader stage stays agent-driven (a context-free reader cannot be
// shelled from here); the nightly's job is the deterministic half — capture
// everything, measure everything, and flag what moved.
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const outIdx = process.argv.indexOf('--out');
const outRoot = outIdx >= 0 ? process.argv[outIdx + 1] : '.agent/part-quality';
const date = new Date().toISOString().slice(0, 10);
const sweepDir = join(outRoot, `sweep-${date}`);
mkdirSync(sweepDir, { recursive: true });

// 1. library ids from the devhub route
const res = await fetch('http://localhost:3000/devhub/api/creature-plans');
const { entries } = await res.json();
const ids = entries.map((e) => e.id);
console.log(`nightly: ${ids.length} library creatures`);

execFileSync('node', ['tools/creatureGate/sweep.mjs', sweepDir, ...ids], { stdio: 'inherit' });
execFileSync('node', ['tools/creatureGate/gate.mjs', sweepDir], { stdio: 'inherit' });

// 2. fixed part roster (three races, the campaign parts)
const partDir = join(outRoot, `parts-${date}`);
const roster = [
  'dwarf-hand:race=hill_dwarf&class=fighter:handL',
  'dwarf-face:race=hill_dwarf&class=fighter:face',
  'dwarf-foot:race=hill_dwarf&class=fighter:foot',
  'drow-hand:race=drow&class=wizard:handL',
  'human-face:race=beastborn_human&class=fighter:face',
];
execFileSync('node', ['tools/creatureGate/partSweep.mjs', partDir, ...roster], { stdio: 'inherit' });

// 3. diff against the baseline
const report = JSON.parse(readFileSync(join(sweepDir, 'report.json'), 'utf8'));
const baselinePath = join(outRoot, 'baseline.json');
let lines = [`# Nightly part-quality report — ${date}`, ''];
if (existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const regressions = [];
  const wins = [];
  const fresh = [];
  for (const [id, r] of Object.entries(report)) {
    // A creature the baseline never saw is NEW COVERAGE, not a regression —
    // first run counted three never-baselined duplicates as 15 regressions.
    if (!(id in baseline)) {
      fresh.push(`${id}: ${r.flags.length} flag(s) on first measurement`);
      continue;
    }
    const before = new Set(baseline[id].flags?.map((f) => f.split(' (')[0]) ?? []);
    const after = new Set(r.flags.map((f) => f.split(' (')[0]));
    for (const f of after) if (!before.has(f)) regressions.push(`${id}: NEW ${f}`);
    for (const f of before) if (!after.has(f)) wins.push(`${id}: resolved ${f}`);
  }
  lines.push(`## Regressions (${regressions.length})`, ...(regressions.length ? regressions.map((r) => `- ${r}`) : ['- none']), '');
  lines.push(`## Wins (${wins.length})`, ...(wins.length ? wins.map((w) => `- ${w}`) : ['- none']), '');
  if (fresh.length) lines.push(`## New coverage (${fresh.length})`, ...fresh.map((f) => `- ${f}`), '');
} else {
  copyFileSync(join(sweepDir, 'report.json'), baselinePath);
  lines.push('No baseline found — this run IS the new baseline.', '');
}
lines.push('## Current flags');
for (const [id, r] of Object.entries(report)) {
  lines.push(`- ${id}: ${r.flags.length ? r.flags.join(' | ') : 'clean'}`);
}
lines.push('', `Part captures for blind review: ${partDir}`);
writeFileSync(join(outRoot, `nightly-${date}.md`), lines.join('\n'));
writeFileSync(join(outRoot, 'latest-report.json'), JSON.stringify(report, null, 1));
console.log(`nightly report: ${join(outRoot, `nightly-${date}.md`)}`);
