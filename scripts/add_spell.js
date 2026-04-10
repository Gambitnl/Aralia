// scripts/add_spell.js
// Interactive helper to add a new spell V2 JSON file and update the manifest + glossary index.

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import buildGlossaryIndex from './generateGlossaryIndex.js';

/**
 * This script scaffolds a new spell JSON file plus the manifest/glossary updates
 * needed for the rest of the app to discover it.
 *
 * Why it exists:
 * adding a spell by hand is easy to get wrong because the runtime file, manifest,
 * and glossary index all need to agree. This helper creates the minimum valid
 * structure first so a new spell starts from the repo's live template instead of
 * from memory or copy-paste drift.
 *
 * Called manually by: developers adding new spells from the terminal
 * Depends on: the live spell JSON shape, spells_manifest.json, and the glossary indexer
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const toKebabCase = (str) =>
  String(str)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

// Build a starter targeting object that matches the current runtime spell
// template without pretending every spell uses the same placement rules.
//
// Why this exists:
// recent spell review showed two recurring authoring traps:
// 1. ritual-capable spells get flattened into one visible casting-time phrase
//    instead of keeping ritual as a separate top-level flag
// 2. placed walls, globes, and anchored zones get forced into an overly simple
//    target shape instead of using a point anchor plus explicit geometry
//
// This helper still starts from the common single-target case, but the comments
// make the intended migration path visible for spells like Alarm and Prismatic
// Wall that need richer placement rules.
const createTargetingTemplate = () => ({
  type: 'single',
  range: 5,
  rangeUnit: 'feet',
  maxTargets: 1,
  validTargets: ['creatures', 'objects'],
  lineOfSight: true,
  // Keep a minimal area block even for single-target spells because the live
  // validator still expects the shared targeting object to carry one.
  // Size 0 means "no meaningful area footprint" rather than "this is a sphere
  // spell". Future authors should replace this with the real geometry when the
  // spell actually creates an area, wall, emanation, or placed zone.
  areaOfEffect: {
    shape: 'Sphere',
    size: 0,
    sizeType: 'radius',
    sizeUnit: 'feet',
    height: 0,
    heightUnit: 'feet',
  },
  // Keep the targeting filter explicit so new spells do not start with an
  // under-specified shape that only becomes valid after manual repair.
  filter: {
    creatureTypes: [],
    excludeCreatureTypes: [],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
  },
  // These optional explicit spatial details are for the risky spells whose
  // geometry cannot be described cleanly by one flat range/area pair. Leave the
  // arrays empty for ordinary spells and fill them only when the spell creates
  // alternate forms, constructed walls/panels, or other extra measured rules.
  spatialDetails: {
    forms: [],
    measuredDetails: [],
  },
  // TODO(next-agent): If the spell places an effect at a chosen point in
  // space, switch this to `type: "point"` and add an `areaOfEffect` block.
  // That is the intended shape for placed walls, globes, and anchored zones.
  // TODO(next-agent): If the spell can become more than one geometry at cast
  // time, use `areaOfEffect.shapeVariant` instead of flattening the spell to
  // one default shape.
  // TODO(next-agent): If the spell's geometry meaningfully depends on whether a
  // size is a radius, diameter, edge length, or wall length, set
  // `areaOfEffect.sizeType` and mirror the alternates in `spatialDetails`.
});

// Build a starter higher-level scaling object that matches the new runtime
// spell template. Cantrips default to character-level tiers because that is the
// most common upgrade path for level-0 spells. Leveled spells default to a
// text-only placeholder so the author is forced to decide whether the scaling
// can be modeled structurally or should remain prose-only for now.
const createHigherLevelScalingTemplate = (level) => {
  if (level === 0) {
    return {
      type: 'character_level_tiers',
      tiers: {
        '5': 'TODO: describe the 5th-level upgrade.',
        '11': 'TODO: describe the 11th-level upgrade.',
        '17': 'TODO: describe the 17th-level upgrade.',
      },
      notes: 'Replace these tier descriptions with structured cantrip scaling once the spell is fully modeled.',
    };
  }

  return {
    type: 'special_text_only',
    referenceText: 'TODO: model the higher-level scaling here if this spell improves when cast with a higher-level slot.',
    reason: 'Starter placeholder until the spell author decides whether a structured scaling rule fits this spell.',
  };
};

const createJsonTemplate = (id, name, level, ritual, rarity) => {
  const template = {
    id,
    name,
    level,
    school: 'Abjuration',
    legacy: false,
    classes: [],
    ritual,
    rarity,
    tags: [],
    castingTime: {
      value: 1,
      unit: 'action',
      combatCost: { type: 'action' },
    },
    // Keep units explicit in new scaffolds so future spells do not have to rely
    // on the old "numbers silently mean feet" assumption.
    range: { type: 'touch', distanceUnit: 'feet' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: createTargetingTemplate(),
    effects: [
      {
        type: 'UTILITY',
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        utilityType: 'other',
        description: 'TODO: add structured effect details.',
      },
    ],
    description: 'TODO: add spell description.',
    higherLevels: 'TODO: add higher-levels text, or remove this field.',
    higherLevelScaling: createHigherLevelScalingTemplate(level),
  };

  return JSON.stringify(template, null, 2);
};

const manifestPath = path.join(__dirname, '../public/data/spells_manifest.json');

const updateManifest = (spellId, spellName, level) => {
  const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {};

  existing[spellId] = {
    name: spellName,
    level,
    school: 'Abjuration',
    path: `/data/spells/level-${level}/${spellId}.json`,
  };

  const sorted = Object.keys(existing)
    .sort()
    .reduce((obj, key) => {
      obj[key] = existing[key];
      return obj;
    }, {});

  fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 2));
};

rl.question('Enter the spell name: ', (spellName) => {
  rl.question('Enter the spell level (0-9): ', (levelStr) => {
    const level = parseInt(levelStr, 10);
    if (Number.isNaN(level) || level < 0 || level > 9) {
      console.error('Error: Spell level must be a number between 0 and 9.');
      rl.close();
      process.exit(1);
    }

    rl.question('Is this a ritual spell? (y/n): ', (isRitual) => {
      rl.question('Enter the spell rarity (common, uncommon, rare, very_rare, legendary): ', (rarity) => {
        const spellId = toKebabCase(spellName);
        const spellJsonPath = path.join(__dirname, `../public/data/spells/level-${level}/${spellId}.json`);

        if (fs.existsSync(spellJsonPath)) {
          console.error(`Error: Spell file for ID "${spellId}" already exists: ${spellJsonPath}`);
          rl.close();
          process.exit(1);
        }

        fs.mkdirSync(path.dirname(spellJsonPath), { recursive: true });
        fs.writeFileSync(spellJsonPath, createJsonTemplate(spellId, spellName, level, isRitual.trim().toLowerCase() === 'y', rarity));
        console.log(`Created spell JSON: ${spellJsonPath}`);

        try {
          updateManifest(spellId, spellName, level);
          console.log(`Updated manifest: ${manifestPath}`);
        } catch (e) {
          console.error(`Failed to update manifest: ${e?.message || e}`);
          rl.close();
          process.exit(1);
        }

        try {
          console.log('Running glossary indexer...');
          buildGlossaryIndex();
          console.log('Glossary index updated successfully.');
        } catch (e) {
          console.error('Failed to run glossary indexer:', e?.message || e);
          rl.close();
          process.exit(1);
        }

        console.log(`\n✅ Spell "${spellName}" added successfully!`);
        console.log('\nNext steps:');
        console.log(`  1. Fill in the new spell JSON: public/data/spells/level-${level}/${spellId}.json`);
        console.log('  2. Keep ritual in the top-level "ritual" flag. Do not flatten it into castingTime.unit.');
        console.log('  3. If the spell places a wall, globe, or other anchored zone, switch targeting to type "point" and add areaOfEffect geometry.');
        console.log('  4. If the spell offers multiple geometry choices at cast time, use areaOfEffect.shapeVariant.');
        console.log(`  5. Update class spell lists in src/data/classes/index.ts if necessary.`);

        rl.close();
      });
    });
  });
});

