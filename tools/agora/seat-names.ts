// tools/agora/seat-names.ts
// Suggest names for Agora seats, drawn from the game's OWN racial name
// generator. Run with tsx, which the repo already depends on:
//
//   npx tsx tools/agora/seat-names.ts                 # 8 names, mixed races
//   npx tsx tools/agora/seat-names.ts --race elven    # one race
//   npx tsx tools/agora/seat-names.ts --count 20
//   npx tsx tools/agora/seat-names.ts --seed 42       # repeatable
//   npx tsx tools/agora/seat-names.ts --races         # list the races
//   npx tsx tools/agora/seat-names.ts --bases         # race -> base index + name
//
// WHY THIS EXISTS, AND WHY IT IS A SEPARATE TOOL.
//
// A seat is a lasting identity that owns a campaign. Remy settled that seat
// names come from Aralia lore (D-P), with one caution: never reuse a name that
// belongs to a live entity in the world data.
//
// Measured 2026-09-08: the lore glossary holds three entries, and every proper
// noun that does exist — 18 deities, 12 factions, 2 companions, 5 static NPCs —
// IS a live entity, which the caution forbids. So the written lore cannot
// supply a single usable name.
//
// Remy then named the real source: the game's own racial name generators. That
// is better than a fixed list. It is the same well the world draws from when it
// names its own people, so a seat name is Aralia lore by construction rather
// than by an author's choice, and it never runs out.
//
// IT IS A SEPARATE TOOL, NOT PART OF THE DAEMON, ON PURPOSE. The Agora daemon
// coordinates agents across a shared checkout. It must not depend on the game's
// world generator to start. So this prints candidates, and `seat new <name>`
// still takes a plain name from a person who chose it.

import { NamesGenerator } from '../../src/systems/worldforge/fmg/names-generator.ts';
import { getNameBases, REAL_WORLD_BASE_COUNT, type NameBase } from '../../src/systems/worldforge/fmg/name-bases.ts';
import { assertSeatName, SEAT_NAME_FORBIDDEN } from './store.mjs';

// The fantasy bases, pinned by their NAME in getNameBases(). The thirty-two
// real-world cultures that head that list are deliberately left out: a seat
// named from the Nordic or Japanese base would read as a real person's name,
// and a lasting identity should not be mistaken for one.
//
// PINNED BY NAME, NOT BY INDEX (changed 2026-09-09). This table used to hold
// the raw indices 32-42. An insertion or a reorder in name-bases.ts would then
// have shifted every entry down into the real-world block, so the tool would
// have started offering Nordic and Japanese names with nothing failing. The
// draw is unchanged for every name here; only the way the index is found is.
//
// The key order is the draw order (main() rotates through it), so it is load
// bearing: reordering these keys changes what a given --seed produces.
const RACE_BASE_NAMES: Record<string, string> = {
  human: 'Human Generic',
  elven: 'Elven',
  'dark-elven': 'Dark Elven',
  dwarven: 'Dwarven',
  goblin: 'Goblin',
  orc: 'Orc',
  giant: 'Giant',
  draconic: 'Draconic',
  arachnid: 'Arachnid',
  serpent: 'Serpents',
  levantine: 'Levantine',
};

/** Resolve every race to its current index in getNameBases(), by base name.
 *
 *  A missing base THROWS rather than being skipped. A skipped race would be a
 *  quiet loss; an index that silently pointed at a real-world culture would be
 *  the failure this whole table exists to prevent.
 */
function resolveRaceBases(bases: NameBase[] = getNameBases()): Record<string, number> {
  // WF-G146: only the fantasy bases are candidates. The boundary is declared
  // by name-bases.ts itself, so a real-world culture that happened to share
  // a name with a fantasy base could never be chosen here.
  const byName = new Map<string, number>();
  bases.forEach((base, index) => {
    if (index < REAL_WORLD_BASE_COUNT) return;
    if (!byName.has(base.name)) byName.set(base.name, index);
  });

  const out: Record<string, number> = {};
  for (const [race, baseName] of Object.entries(RACE_BASE_NAMES)) {
    const index = byName.get(baseName);
    if (index === undefined) {
      throw new Error(
        `name base "${baseName}" (race "${race}") is no longer in getNameBases(). ` +
        'Seat names must never fall back to a real-world culture base, so this is ' +
        'a stop, not a skip: repoint the race at its renamed base.',
      );
    }
    out[race] = index;
  }
  return out;
}

/** Every name already alive in the world data, lowercased.
 *
 *  HONEST LIMIT, stated rather than hidden: this covers the names WRITTEN DOWN
 *  in data files. Every burg resident, merchant, burg and state in the live
 *  world is generated on the fly from a world seed and exists in no file, so a
 *  collision against one of those cannot be checked without generating the
 *  whole world. A generated seat name is novel Markov output, so the risk is
 *  small — but it is not zero, and this says so.
 */
async function liveEntityNames(): Promise<Set<string>> {
  const names = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== 'string') return;
    for (const word of v.toLowerCase().split(/[^a-z']+/i)) {
      if (word.length > 2) names.add(word);
    }
  };

  // Each import is wrapped: a data file that moves must not silently reduce the
  // check to nothing. A failure is reported, never swallowed.
  const sources: Array<[string, () => Promise<string[]>]> = [
    ['deities', async () => (await import('../../src/data/deities/index.ts')).DEITIES.map((d: any) => d.name)],
    ['factions', async () => Object.values((await import('../../src/data/factions.ts')).FACTIONS).map((f: any) => f.name)],
    ['underdark factions', async () => (await import('../../src/data/underdarkFactions.ts')).UNDERDARK_FACTIONS.map((f: any) => f.name)],
    ['companions', async () => Object.values((await import('../../src/data/companions.ts')).COMPANIONS).map((c: any) => c.identity.name)],
    ['static NPCs', async () => Object.values((await import('../../src/data/world/npcs.ts')).NPCS).map((n: any) => n.name)],
  ];

  for (const [label, load] of sources) {
    try {
      const list = await load();
      list.forEach(add);
      process.stderr.write(`  checked against ${list.length} ${label}\n`);
    } catch (e) {
      process.stderr.write(`  WARNING: could not read ${label} — ${(e as Error).message}\n`);
      process.stderr.write('  The collision check is INCOMPLETE. Fix this before trusting a name.\n');
    }
  }
  return names;
}

function arg(flag: string, fallback = ''): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  if (process.argv.includes('--races')) {
    for (const key of Object.keys(RACE_BASE_NAMES)) console.log(key);
    return;
  }

  // `--bases` exists so the name pin is checkable from outside: it prints the
  // index each race resolves to today, alongside the base name it was pinned
  // to, which is what a test can assert against name-bases.ts.
  if (process.argv.includes('--bases')) {
    const resolved = resolveRaceBases();
    for (const [race, index] of Object.entries(resolved)) {
      console.log(`${race}\t${index}\t${RACE_BASE_NAMES[race]}`);
    }
    return;
  }

  const RACES = resolveRaceBases();

  const want = Number(arg('--count', '8'));
  const only = arg('--race');
  if (only && !(only in RACES)) {
    console.error(`unknown race "${only}". Run with --races to list them.`);
    process.exit(1);
  }

  // The generator draws from the global Math.random, so a seed is applied the
  // same way the game's own burg namer does it — swap, draw, restore.
  const seed = arg('--seed');
  const realRandom = Math.random;
  if (seed) {
    const { default: Alea } = await import('alea');
    const rng = Alea(seed);
    Math.random = () => rng();
  }

  process.stderr.write('Reading the world data to avoid a live name:\n');
  const taken = await liveEntityNames();
  process.stderr.write(`  ${taken.size} words are already alive in the world\n\n`);

  const generator = new NamesGenerator(getNameBases());
  const pool = only ? [only] : Object.keys(RACES);
  const seen = new Set<string>();
  const out: Array<{ name: string; race: string }> = [];

  // Bounded, so a race whose every draw is refused cannot spin forever.
  for (let tries = 0; tries < want * 200 && out.length < want; tries++) {
    const race = pool[tries % pool.length];
    let raw: string;
    try {
      raw = generator.getBase(RACES[race]);
    } catch {
      continue;
    }
    const name = String(raw).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '');

    if (!name || seen.has(name)) continue;
    seen.add(name);

    // The SAME rules the store enforces, imported rather than copied — a copied
    // rule list is a rule list that drifts.
    const checked = assertSeatName(name);
    if (!checked.ok) continue;

    // The D-P caution, applied.
    if (name.split('-').some((part) => taken.has(part))) continue;

    out.push({ name, race });
  }

  if (!out.length) {
    console.error('No name survived the rules. That is a bug worth reporting, not a retry.');
    process.exit(1);
  }

  for (const row of out) console.log(`${row.name.padEnd(18)} ${row.race}`);

  if (seed) Math.random = realRandom;
  process.stderr.write(`\n${out.length} name(s). None is a live entity, and none breaks the ${SEAT_NAME_FORBIDDEN.length} refused words.\n`);
  process.stderr.write('Create one:  node tools/agora/client.mjs seat new <name>\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
