// scripts/add_spell.js
// Interactive helper to add a new spell V2 JSON file and update the manifest + glossary index.

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import buildGlossaryIndex from './generateGlossaryIndex.js';

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
    range: { type: 'touch' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: {
      type: 'single',
      range: 5,
      validTargets: ['creatures', 'objects'],
      lineOfSight: true,
    },
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
        console.log(`  2. Update class spell lists in src/data/classes/index.ts if necessary.`);

        rl.close();
      });
    });
  });
});

