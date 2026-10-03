/**
 * Hero pipeline stage 1b: pick up the newest Gemini Images download and file
 * it as this creature's reference.png.
 *
 * Rejects stale downloads (older than 15 minutes) loudly — a wrong reference
 * silently becoming a creature's face is worse than a failed run.
 *
 * Usage: npx tsx tools/creatureHero/collect-reference.mjs <entryId> [--prompt-file p.txt] [--base dir] [--downloads dir]
 */
import { copyFileSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [entryId, ...rest] = process.argv.slice(2);
if (!entryId) {
  console.error('usage: npx tsx tools/creatureHero/collect-reference.mjs <entryId> [--prompt-file p.txt]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};
const baseDir = flag('--base', 'public/creatures3d/hero');
const downloads = flag('--downloads', 'C:\\Users\\Gambit\\Downloads');
const promptFile = flag('--prompt-file', null);

const { heroDir, readHero, writeHero } = await import(
  pathToFileURL(path.resolve('src/systems/entities3d/library/heroStore.ts')).href
);

const candidates = readdirSync(downloads)
  .filter((f) => /^Gemini_Generated_Image_.*\.png$/i.test(f))
  .map((f) => ({ f, mtime: statSync(path.join(downloads, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (candidates.length === 0) {
  console.error(`no Gemini_Generated_Image_*.png in ${downloads} — generate and download the reference first`);
  process.exit(1);
}
const newest = candidates[0];
const ageMin = (Date.now() - newest.mtime) / 60_000;
if (ageMin > 15) {
  console.error(
    `newest Gemini download is ${ageMin.toFixed(0)} minutes old (${newest.f}) — refusing a stale reference; generate a fresh one`,
  );
  process.exit(1);
}

const dir = heroDir(baseDir, entryId);
const record = readHero(baseDir, entryId) ?? { entryId, stages: {}, status: 'generated' };
if (promptFile) record.prompt = readFileSync(promptFile, 'utf8').trim();
record.stages.reference = { at: new Date().toISOString(), note: newest.f };
writeHero(baseDir, record); // creates the folder
copyFileSync(path.join(downloads, newest.f), path.join(dir, 'reference.png'));
console.log(`reference.png ← ${newest.f} (${ageMin.toFixed(1)} min old)`);
