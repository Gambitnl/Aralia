// tools/creatureGate/gate.mjs — measure swept silhouettes and flag failures.
//
//   node tools/creatureGate/gate.mjs <sweepDir>
//
// Runs vendor/anyCreature/harness/maskmetrics.py (MIT) on each creature's
// four views, then applies the dullness floors. The numbers MEASURE; the
// blind reader (a context-free agent shown only the small thumbs) JUDGES
// recognition — their own docstring: "MEASURES ONLY, judgment belongs to
// the LLM". Floors here catch only the unarguable failures (calibrated on
// our five-creature test set — sq_fill is pose-dependent, a carried axe
// halves it, so its floor sits at true-line level):
//   - empty:        a view with no mask at all (nothing rendered)
//   - sliver:       sq_fill < 0.012 — the creature is a line, not a body
//   - plank:        straight_max > 0.7 — one straight edge owns the outline
//   - blob:         compactness < 1.3, no pockets, no protrusions
// Writes <sweepDir>/report.json and prints a table.
import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const sweepDir = process.argv[2];
if (!sweepDir) {
  console.error('usage: node tools/creatureGate/gate.mjs <sweepDir>');
  process.exit(1);
}

const creatures = readdirSync(sweepDir).filter((n) => statSync(join(sweepDir, n)).isDirectory());
const report = {};
for (const id of creatures) {
  const dir = join(sweepDir, id);
  const views = readdirSync(dir).filter((n) => n.endsWith('.png') && !n.includes('thumb') && !n.includes('sheet'));
  execFileSync('python', [
    'vendor/anyCreature/harness/maskmetrics.py',
    dir,
    ...views.map((v) => join(dir, v)),
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  const metrics = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8'));
  const flags = [];
  for (const [view, m] of Object.entries(metrics)) {
    if (m === null) { flags.push(`${view}: empty`); continue; }
    if (m.sq_fill < 0.012) flags.push(`${view}: sliver (sq_fill ${m.sq_fill})`);
    if (m.straight_max > 0.7) flags.push(`${view}: plank (straight_max ${m.straight_max})`);
    if (m.compactness < 1.3 && (m.neg_pockets ?? []).length === 0 && (m.protrusions ?? []).length === 0) {
      flags.push(`${view}: blob (compactness ${m.compactness})`);
    }
  }
  report[id] = { flags, metrics };
}
writeFileSync(join(sweepDir, 'report.json'), JSON.stringify(report, null, 1));

for (const [id, r] of Object.entries(report)) {
  const status = r.flags.length ? `FLAG  ${r.flags.join(' | ')}` : 'clean';
  console.log(`${id.padEnd(12)} ${status}`);
}
