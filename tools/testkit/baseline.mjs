// Testkit baseline store + diff. Pure logic in compareRuns; CLI persists runs
// under .agent/testkit/ and diffs against .agent/testkit/baseline.json.
// Usage: node tools/testkit/baseline.mjs <run.json> [--promote]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HEAP_THRESHOLD = 0.15;      // heapMB may grow 15% before it regresses
const GENERIC_THRESHOLD = 0.20;   // every other numeric metric: 20%

export function compareRuns(baseline, run) {
  const regressions = [];
  const improvements = [];
  const notes = [];
  const baseSurfaces = baseline?.surfaces ?? {};
  const runSurfaces = run?.surfaces ?? {};

  for (const name of Object.keys(runSurfaces)) {
    if (!(name in baseSurfaces)) notes.push(`surface "${name}" is new (no baseline)`);
  }
  for (const name of Object.keys(baseSurfaces)) {
    if (!(name in runSurfaces)) notes.push(`surface "${name}" missing from this run`);
  }

  for (const [name, metrics] of Object.entries(runSurfaces)) {
    const baseMetrics = baseSurfaces[name];
    if (!baseMetrics) continue;
    for (const [key, value] of Object.entries(metrics)) {
      const baseValue = baseMetrics[key];
      if (typeof value !== 'number' || typeof baseValue !== 'number') continue;
      if (key === 'consoleErrors') {
        if (value > baseValue) regressions.push(`${name}.consoleErrors: ${baseValue} -> ${value}`);
        continue;
      }
      const threshold = key === 'heapMB' ? HEAP_THRESHOLD : GENERIC_THRESHOLD;
      if (baseValue > 0 && value > baseValue * (1 + threshold)) {
        regressions.push(`${name}.${key}: ${baseValue} -> ${value} (over +${threshold * 100}%)`);
      } else if (baseValue > 0 && value <= baseValue * (1 - GENERIC_THRESHOLD)) {
        improvements.push(`${name}.${key}: ${baseValue} -> ${value}`);
      }
    }
  }
  return { regressions, improvements, notes };
}

function main() {
  const args = process.argv.slice(2);
  const promote = args.includes('--promote');
  const runPath = args.find((a) => !a.startsWith('--'));
  if (!runPath) {
    console.error('Usage: node tools/testkit/baseline.mjs <run.json> [--promote]');
    process.exit(2);
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const storeDir = path.join(repoRoot, '.agent', 'testkit');
  const runsDir = path.join(storeDir, 'runs');
  const baselinePath = path.join(storeDir, 'baseline.json');

  const run = JSON.parse(readFileSync(runPath, 'utf8'));
  mkdirSync(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(path.join(runsDir, `${stamp}.json`), JSON.stringify(run, null, 2));

  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, JSON.stringify(run, null, 2));
    console.log('No baseline existed — this run is now the baseline.');
    return;
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const { regressions, improvements, notes } = compareRuns(baseline, run);
  for (const n of notes) console.log(`note: ${n}`);
  for (const i of improvements) console.log(`improved: ${i}`);
  if (regressions.length) {
    console.log(`REGRESSIONS (${regressions.length}):`);
    for (const r of regressions) console.log(`  ${r}`);
  } else {
    console.log('Clean: no regressions against baseline.');
  }

  if (promote) {
    writeFileSync(baselinePath, JSON.stringify(run, null, 2));
    console.log('Baseline promoted to this run.');
  }
  process.exit(regressions.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
