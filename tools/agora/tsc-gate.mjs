#!/usr/bin/env node
// tools/agora/tsc-gate.mjs — "no NEW type errors" gate for wave workers (WF-G155).
//
//   node tools/agora/tsc-gate.mjs --baseline <file> [--files a.ts b.tsx ...] [--save <file>]
//
// Runs `npx tsc --noEmit -p tsconfig.json`, normalizes every error line by
// stripping its (line,col) so a sibling's edit that shifts an unrelated file's
// errors by one line is NOT reported as new, and prints the errors that are
// genuinely new versus the baseline. With --files, only new errors in those
// files fail the gate (exit 1); without it, any new error fails.
// --save writes the CURRENT normalized error list as a fresh baseline.
//
// Baseline format: one raw tsc error line per row (the sweep's sorted list);
// raw or already-normalized rows both work.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i === -1 ? null : process.argv[i + 1]; };
const listAfter = (n) => { const i = process.argv.indexOf('--' + n); if (i === -1) return []; const out = []; for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j]); return out; };
const baselinePath = arg('baseline');
const savePath = arg('save');
const onlyFiles = listAfter('files').map((f) => f.replace(/\\/g, '/'));

// Quoted type text ('...') is collapsed too: adding one member to a union or one
// field to a state type rewrites the MESSAGE of every pre-existing error that
// prints that type, which showed up as phantom NEW errors on 2026-09-13.
const normalize = (line) => line
  .replace(/\r$/, '')
  .replace(/\((\d+),(\d+)\)/, '')
  .replace(/\\/g, '/')
  .replace(/'[^']*'/g, "'…'")
  .trim();
const dedupe = (rows) => [...new Set(rows.map(normalize).filter((r) => /error TS\d+/.test(r)))].sort();

const tsc = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
const rawNow = (tsc.stdout + '\n' + tsc.stderr).split('\n').filter((l) => /error TS\d+/.test(l));
const now = dedupe(rawNow);

if (savePath) {
  fs.writeFileSync(savePath, now.join('\n') + '\n');
  console.log(`saved ${now.length} normalized error rows to ${savePath}`);
  if (!baselinePath) process.exit(0);
}
if (!baselinePath) { console.error('usage: tsc-gate.mjs --baseline <file> [--files ...] [--save <file>]'); process.exit(2); }
const base = new Set(dedupe(fs.readFileSync(baselinePath, 'utf8').split('\n')));
const fresh = now.filter((r) => !base.has(r));
const inScope = onlyFiles.length ? fresh.filter((r) => onlyFiles.some((f) => r.startsWith(f) || r.includes('/' + f))) : fresh;

// WF-G159: the normalized set answers "is anything new"; a codemod needs the RAW
// sites with line and column. --raw prints every raw line whose normalized form
// is new; the raw-new count is always printed beside the distinct count.
const freshSet = new Set(fresh);
const rawNew = rawNow.map((l) => l.replace(/\r$/, '').trim()).filter((l) => freshSet.has(normalize(l)));
const rawNewInScope = onlyFiles.length ? rawNew.filter((r) => onlyFiles.some((f) => r.replace(/\\/g, '/').startsWith(f) || r.replace(/\\/g, '/').includes('/' + f))) : rawNew;
console.log(`tsc errors now: ${rawNow.length} raw / ${now.length} distinct; baseline: ${base.size} distinct; new: ${fresh.length} distinct / ${rawNew.length} raw${onlyFiles.length ? ` (in your files: ${inScope.length} distinct / ${rawNewInScope.length} raw)` : ''}`);
for (const r of inScope) console.log('  NEW  ' + r);
if (process.argv.includes('--raw')) for (const r of rawNewInScope) console.log('  RAW  ' + r);
// WF-G163: name the outside errors too, so a worker can report them without a second tsc run.
if (onlyFiles.length && fresh.length > inScope.length) {
  console.log(`  (${fresh.length - inScope.length} new error(s) in files outside --files; not your gate, report them:)`);
  for (const r of fresh.filter((x) => !inScope.includes(x))) console.log('  OUTSIDE  ' + r.slice(0, 160));
}
process.exit(inScope.length ? 1 : 0);
