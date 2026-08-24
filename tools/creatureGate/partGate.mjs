// tools/creatureGate/partGate.mjs — the PART gate: mask metrics with
// part-specific floors on solo renders, plus the blind-read protocol
// (part-quality campaign build item 2, 2026-08-24).
//
//   node tools/creatureGate/partGate.mjs <partDir>            measure + sheet
//   node tools/creatureGate/partGate.mjs <partDir> --score    score blind-reads.json
//
// <partDir> holds partSweep.mjs captures: <label>.png where the label ends
// in the part kind (dwarf-hand.png, human-face.png). Measure mode:
//   1. maskmetrics.py on every capture (vendor/anyCreature, MIT)
//   2. floors — only the unarguable failures, per part kind:
//        all:   empty (no mask), sliver (sq_fill < 0.012)
//        hand:  fewer than 3 protrusions = no separate digits (the
//               paddle-hand class), or blob
//        face:  blob (an egg with no pockets and no protrusions is not a
//               face)
//        foot:  blob
//   3. blind-sheet.png — the captures shuffled under anonymous numbers —
//      and blind-map.json (number -> label; the reader never sees it)
//   Writes <partDir>/part-report.json.
//
// The blind stage stays agent-driven: a context-free reader (a subagent
// shown ONLY the sheet) writes <partDir>/blind-reads.json as
// {"1": "a hand", ...}; --score normalizes synonyms, compares against the
// map, and folds the results into part-report.json. A part kind passes when
// every read names it and no capture carries a floor flag.
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [partDir, mode] = process.argv.slice(2);
if (!partDir) {
  console.error('usage: node tools/creatureGate/partGate.mjs <partDir> [--score]');
  process.exit(1);
}

const KIND_OF = (label) => {
  const m = label.match(/(hand|face|head|foot)$/);
  return m ? (m[1] === 'head' ? 'face' : m[1]) : null;
};
// what a blind reader may call each kind and still be right
const SYNONYMS = {
  hand: ['hand', 'fist', 'palm', 'glove', 'claw hand'],
  face: ['face', 'head', 'skull', 'visage', 'portrait'],
  foot: ['foot', 'feet', 'boot', 'shoe', 'hoof'],
};

const reportPath = join(partDir, 'part-report.json');

if (mode === '--score') {
  const readsPath = join(partDir, 'blind-reads.json');
  if (!existsSync(readsPath)) throw new Error(`partGate --score: missing ${readsPath} — run the blind reader first`);
  const reads = JSON.parse(readFileSync(readsPath, 'utf8'));
  const map = JSON.parse(readFileSync(join(partDir, 'blind-map.json'), 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const byKind = {};
  for (const [num, label] of Object.entries(map)) {
    const kind = KIND_OF(label);
    const read = String(reads[num] ?? '').toLowerCase();
    const hit = (SYNONYMS[kind] ?? [kind]).some((s) => read.includes(s));
    report[label].blindRead = { read: reads[num] ?? null, correct: hit };
    (byKind[kind] ??= { correct: 0, total: 0 }).total++;
    if (hit) byKind[kind].correct++;
    console.log(`#${num} ${label.padEnd(14)} read "${reads[num] ?? ''}" -> ${hit ? 'CORRECT' : 'MISS'}`);
  }
  report.__kinds = {};
  for (const [kind, s] of Object.entries(byKind)) {
    const flagged = Object.entries(report).filter(([l, r]) => KIND_OF(l) === kind && (r.flags ?? []).length > 0).length;
    const pass = s.correct === s.total && flagged === 0;
    report.__kinds[kind] = { blind: `${s.correct}/${s.total}`, flaggedCaptures: flagged, pass };
    console.log(`${kind.padEnd(6)} blind ${s.correct}/${s.total}, ${flagged} flagged capture(s) -> ${pass ? 'PART GATE PASSED' : 'PART GATE FAILED'}`);
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 1));
  process.exit(Object.values(report.__kinds).every((k) => k.pass) ? 0 : 1);
}

// ---------------------------------------------------------------- measure
const shots = readdirSync(partDir).filter((n) => n.endsWith('.png') && !n.startsWith('blind-'));
if (shots.length === 0) throw new Error(`partGate: no captures in ${partDir} — run partSweep.mjs first`);
execFileSync('python', ['vendor/anyCreature/harness/maskmetrics.py', partDir, ...shots.map((s) => join(partDir, s))], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const metrics = JSON.parse(readFileSync(join(partDir, 'metrics.json'), 'utf8'));

const report = {};
for (const shot of shots) {
  const label = shot.replace(/\.png$/, '');
  const kind = KIND_OF(label);
  const m = metrics[shot] ?? metrics[label] ?? null;
  const flags = [];
  if (m === null) flags.push('empty');
  else {
    if (m.sq_fill < 0.012) flags.push(`sliver (sq_fill ${m.sq_fill})`);
    const blob = m.compactness < 1.3 && (m.neg_pockets ?? []).length === 0 && (m.protrusions ?? []).length === 0;
    if (kind === 'hand' && (m.protrusions ?? []).length < 3) flags.push(`no digits (${(m.protrusions ?? []).length} protrusions)`);
    if (blob && kind !== null) flags.push(`blob (compactness ${m.compactness})`);
  }
  report[label] = { kind, flags, metrics: m };
  console.log(`${label.padEnd(14)} ${flags.length ? 'FLAG  ' + flags.join(' | ') : 'clean'}`);
}
writeFileSync(reportPath, JSON.stringify(report, null, 1));

// ---------------------------------------------------------------- blind sheet
// numbers are assigned in shuffled order so position never leaks the label
const shuffled = [...shots].sort(() => Math.random() - 0.5);
const map = {};
shuffled.forEach((s, i) => {
  map[String(i + 1)] = s.replace(/\.png$/, '');
});
writeFileSync(join(partDir, 'blind-map.json'), JSON.stringify(map, null, 1));
const py = `
from PIL import Image, ImageDraw
import json, os
d = ${JSON.stringify(partDir.replaceAll('\\', '/'))}
order = json.load(open(os.path.join(d, 'blind-map.json')))
cell = 300
cols = 3
rows = (len(order) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * (cell + 26)), (255, 255, 255))
draw = ImageDraw.Draw(sheet)
for i in range(1, len(order) + 1):
    img = Image.open(os.path.join(d, order[str(i)] + '.png')).resize((cell - 10, cell - 10))
    x, y = ((i - 1) % cols) * cell, ((i - 1) // cols) * (cell + 26)
    draw.text((x + 6, y + 4), '#' + str(i), fill=(0, 0, 0))
    sheet.paste(img, (x + 5, y + 26))
sheet.save(os.path.join(d, 'blind-sheet.png'))
print('blind-sheet.png:', len(order), 'numbered crops')
`;
const r = spawnSync('python', ['-'], { input: py, encoding: 'utf8' });
if (r.status !== 0) throw new Error(`blind sheet failed: ${r.stderr}`);
console.log(r.stdout.trim());
console.log(`partGate: measured ${shots.length} captures -> ${reportPath}; blind reader next (a context-free agent names each # on blind-sheet.png into blind-reads.json), then --score`);
