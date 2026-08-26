/**
 * @file scripts/generate-class-spell-lists.mjs
 *
 * Generates src/data/classes/spellLists.generated.ts from the spell JSON corpus
 * under public/data/spells.
 *
 * Every spell JSON carries a `classes` array naming the classes whose spell list
 * it belongs to. Before this script those lists were hand-authored in
 * src/data/classes/index.ts, which meant a new spell JSON silently failed to
 * appear for its class. This script makes the JSON the single source of truth.
 *
 * Usage:
 *   node scripts/generate-class-spell-lists.mjs           write the generated file
 *   node scripts/generate-class-spell-lists.mjs --check    exit 1 if the file is stale
 *   node scripts/generate-class-spell-lists.mjs --diff     print the diff against the
 *                                                          CURRENT generated file
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SPELL_ROOT = path.join(ROOT, 'public', 'data', 'spells');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'classes', 'spellLists.generated.ts');

/**
 * Classes that own a spellcasting.spellList in src/data/classes/index.ts.
 * The export name is what index.ts imports; the match key is the string the
 * spell JSON uses in its `classes` array.
 */
const CLASSES = [
  { key: 'Artificer', exportName: 'ARTIFICER_SPELL_LIST' },
  { key: 'Bard', exportName: 'BARD_SPELL_LIST' },
  { key: 'Cleric', exportName: 'CLERIC_SPELL_LIST' },
  { key: 'Druid', exportName: 'DRUID_SPELL_LIST' },
  { key: 'Paladin', exportName: 'PALADIN_SPELL_LIST' },
  { key: 'Ranger', exportName: 'RANGER_SPELL_LIST' },
  { key: 'Sorcerer', exportName: 'SORCERER_SPELL_LIST' },
  { key: 'Warlock', exportName: 'WARLOCK_SPELL_LIST' },
  { key: 'Wizard', exportName: 'WIZARD_SPELL_LIST' },
];

/** Walks public/data/spells/level-*\/*.json and returns every parsed spell. */
const readSpells = () => {
  if (!fs.existsSync(SPELL_ROOT)) {
    throw new Error(`Spell corpus not found at ${SPELL_ROOT}`);
  }
  const spells = [];
  const levelDirs = fs
    .readdirSync(SPELL_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^level-\d+$/.test(entry.name))
    .sort((a, b) => Number(a.name.slice(6)) - Number(b.name.slice(6)));

  for (const dir of levelDirs) {
    const dirPath = path.join(SPELL_ROOT, dir.name);
    for (const file of fs.readdirSync(dirPath).sort()) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(dirPath, file);
      let spell;
      try {
        spell = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        throw new Error(`Malformed spell JSON at ${filePath}: ${e.message}`);
      }
      if (typeof spell.id !== 'string' || spell.id.length === 0) {
        throw new Error(`Spell JSON at ${filePath} has no usable id`);
      }
      spells.push({
        id: spell.id,
        level: typeof spell.level === 'number' ? spell.level : Number(dir.name.slice(6)),
        classes: Array.isArray(spell.classes) ? spell.classes : [],
      });
    }
  }
  return spells;
};

/**
 * Buckets spell ids by class.
 *
 * Stable sort: by spell level ascending, then by id, so a new spell lands in a
 * deterministic position and the generated file only churns where the data
 * actually changed.
 */
const buildLists = (spells) => {
  const lists = new Map(CLASSES.map((c) => [c.key, []]));
  for (const spell of spells) {
    for (const className of spell.classes) {
      const bucket = lists.get(String(className).trim());
      if (bucket) bucket.push(spell);
    }
  }
  for (const [key, bucket] of lists) {
    bucket.sort((a, b) => (a.level - b.level) || a.id.localeCompare(b.id));
    lists.set(key, bucket);
  }
  return lists;
};

const renderFile = (lists) => {
  const lines = [];
  lines.push('/**');
  lines.push(' * @file src/data/classes/spellLists.generated.ts');
  lines.push(' *');
  lines.push(' * GENERATED FILE - DO NOT EDIT BY HAND.');
  lines.push(' *');
  lines.push(' * Source of truth: the `classes` array inside every spell JSON under');
  lines.push(' * public/data/spells. Regenerate with:');
  lines.push(' *   node scripts/generate-class-spell-lists.mjs');
  lines.push(' * Staleness is enforced by:');
  lines.push(' *   node scripts/generate-class-spell-lists.mjs --check   (npm run validate:class-spell-lists)');
  lines.push(' *');
  lines.push(' * Ordering is spell level ascending, then spell id, so the file only churns');
  lines.push(' * where the corpus actually changed.');
  lines.push(' */');
  lines.push('');

  for (const { key, exportName } of CLASSES) {
    const bucket = lists.get(key) ?? [];
    lines.push(`/** ${key}: ${bucket.length} spell(s) from public/data/spells. */`);
    lines.push(`export const ${exportName}: string[] = [`);
    let currentLevel = null;
    for (const spell of bucket) {
      if (spell.level !== currentLevel) {
        currentLevel = spell.level;
        lines.push(`  // Level ${currentLevel}`);
      }
      lines.push(`  '${spell.id}',`);
    }
    lines.push('];');
    lines.push('');
  }
  return lines.join('\n');
};

/** Parses the ids out of an existing generated file, per export name. */
const parseExisting = (source) => {
  const result = new Map();
  for (const { exportName } of CLASSES) {
    const start = source.indexOf(`export const ${exportName}`);
    if (start === -1) continue;
    const end = source.indexOf('];', start);
    if (end === -1) continue;
    const body = source.slice(start, end);
    result.set(exportName, [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  }
  return result;
};

const main = () => {
  const check = process.argv.includes('--check');
  const wantDiff = process.argv.includes('--diff');

  const lists = buildLists(readSpells());
  const rendered = renderFile(lists);

  if (wantDiff) {
    const existing = fs.existsSync(OUT_PATH)
      ? parseExisting(fs.readFileSync(OUT_PATH, 'utf-8'))
      : new Map();
    for (const { key, exportName } of CLASSES) {
      const now = (lists.get(key) ?? []).map((s) => s.id);
      const before = existing.get(exportName) ?? [];
      const added = now.filter((id) => !before.includes(id));
      const removed = before.filter((id) => !now.includes(id));
      console.log(
        `${exportName}: ${before.length} -> ${now.length}  +${added.length} -${removed.length}`,
      );
      if (added.length) console.log(`    added:   ${added.join(', ')}`);
      if (removed.length) console.log(`    removed: ${removed.join(', ')}`);
    }
    return;
  }

  if (check) {
    if (!fs.existsSync(OUT_PATH)) {
      console.error(
        `[class spell lists] ${path.relative(ROOT, OUT_PATH)} is missing. Run: node scripts/generate-class-spell-lists.mjs`,
      );
      process.exit(1);
    }
    const onDisk = fs.readFileSync(OUT_PATH, 'utf-8').replace(/\r\n/g, '\n');
    if (onDisk !== rendered.replace(/\r\n/g, '\n')) {
      console.error(
        `[class spell lists] ${path.relative(ROOT, OUT_PATH)} is STALE relative to public/data/spells. Run: node scripts/generate-class-spell-lists.mjs`,
      );
      process.exit(1);
    }
    console.log('[class spell lists] generated file is up to date.');
    return;
  }

  fs.writeFileSync(OUT_PATH, rendered, 'utf-8');
  const total = CLASSES.reduce((sum, c) => sum + (lists.get(c.key) ?? []).length, 0);
  console.log(
    `[class spell lists] wrote ${path.relative(ROOT, OUT_PATH)} (${CLASSES.length} classes, ${total} class-spell entries).`,
  );
};

main();
