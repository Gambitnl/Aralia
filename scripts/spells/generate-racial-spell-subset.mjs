#!/usr/bin/env node
/**
 * @file Generates the small spell file the Design Preview race leaves import.
 *
 * WHY THIS EXISTS.
 * Two race leaves and one test used to `import spellBundle from
 * 'src/data/spells_bundle.json'` — the whole 4.5 MB corpus, pulled into the
 * JavaScript bundle to reach a few dozen spells. That file was also a hand-made
 * hard link to `public/data/spells_bundle.json`, so the two names were one file
 * that nothing created and nothing repaired. Remy chose "a short list, not a
 * full copy" on the question sheet, because a full copy moves the duplication
 * rather than removing it.
 *
 * WHAT IT DERIVES, AND FROM WHERE.
 * The list is read from the race definitions themselves, never typed by hand:
 *   1. every `spellId` on a racial trait of type `spell`, across all races;
 *   2. every id in `availableSpellIds` on a racial spell choice, because the
 *      reader can pick any of them in the preview;
 *   3. every spell a production quick character starts with, for each race, so
 *      a class-granted cantrip is present too.
 * An id that no bundle entry answers is DROPPED and reported. Those ids come
 * from the prose parser splitting a spell name ("purify food and drink" becomes
 * "purify-food" plus "drink"), and shipping them would only hide that bug.
 *
 * WHY VITE AND NOT tsx.
 * `src/data/races/index.ts` uses `import.meta.glob`, which only Vite provides.
 * Plain tsx throws "glob is not a function". This loads the same modules
 * through Vite's own SSR loader, with a minimal config: the project config
 * starts dev middleware this script does not need.
 *
 * RUN IT:  node scripts/spells/generate-racial-spell-subset.mjs
 * CHECK ONLY (no write, non-zero exit if stale):  ... --check
 */
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUNDLE = path.join(ROOT, 'public', 'data', 'spells_bundle.json');
// NOT under src/data/generated/: .gitignore:240 ignores every `generated/`
// folder, and an import of an ignored file builds here and fails in CI. That
// exact trap broke the published site for eleven days once already.
const OUT = path.join(ROOT, 'src', 'data', 'racialSpellSubset.generated.json');
const CHECK_ONLY = process.argv.includes('--check');

async function collectIds(server) {
  const races = await server.ssrLoadModule('/src/data/races/index.ts');
  const quick = await server.ssrLoadModule('/src/utils/sandbox/quickCharacterGenerator.ts');
  const stats = await server.ssrLoadModule('/src/utils/character/stats.ts');

  const library = races.getRacialTraitLibrary();
  const wanted = new Set();

  for (const trait of Object.values(library.byRaceId).flat()) {
    if (trait.type === 'spell' && trait.spellId) wanted.add(trait.spellId);
  }
  for (const choice of Object.values(library.byChoiceRaceId).flat()) {
    (choice.availableSpellIds || []).forEach((id) => wanted.add(id));
  }

  // A quick character carries its class spellbook as well as its race, and the
  // leaves build one. Walking every race costs a few seconds and removes the
  // guesswork about which classes a future leaf might use.
  for (const raceId of Object.keys(library.byRaceId)) {
    const character = quick.createQuickCharacter({
      name: 'subset-derivation',
      raceId,
      classId: 'wizard',
      level: 3,
      stats: [10, 10, 10, 10, 14, 10],
    });
    if (!character) continue;
    const assembled = stats.applyRacialSpellGrantsByLevel(character, 3);
    const book = assembled.spellbook || {};
    [...(book.cantrips || []), ...(book.knownSpells || []), ...(book.preparedSpells || [])]
      .forEach((id) => wanted.add(id));
  }

  return wanted;
}

const server = await createServer({
  configFile: false,
  root: ROOT,
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

let out;
try {
  const wanted = await collectIds(server);
  const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));

  const kept = [...wanted].filter((id) => bundle[id]).sort();
  const dropped = [...wanted].filter((id) => !bundle[id]).sort();

  const subset = {};
  for (const id of kept) subset[id] = bundle[id];
  out = JSON.stringify(subset, null, 2) + '\n';

  console.log(`bundle entries      : ${Object.keys(bundle).length}`);
  console.log(`ids wanted          : ${wanted.size}`);
  console.log(`ids kept            : ${kept.length}`);
  if (dropped.length) {
    console.log(`ids dropped         : ${dropped.length} — no such spell in the bundle`);
    console.log(`  ${dropped.join(', ')}`);
    console.log('  These come from the racial prose parser splitting a spell name.');
    console.log('  They are a real bug in the race data, not in this script.');
  }
} finally {
  await server.close();
}

const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (CHECK_ONLY) {
  if (current === out) {
    console.log('up to date');
    process.exit(0);
  }
  console.error(`STALE: ${path.relative(ROOT, OUT)} does not match the race data. Run this script without --check.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out, 'utf8');
console.log(`wrote ${path.relative(ROOT, OUT)} (${out.length} bytes)`);
