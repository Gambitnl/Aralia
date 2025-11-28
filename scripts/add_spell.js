// scripts/add_spell.js
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import buildGlossaryIndex from './generateGlossaryIndex.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to convert a string to kebab-case
const toKebabCase = (str) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // get all lowercase letters that are near to uppercase letters
    .replace(/[\s_]+/g, '-') // replace all spaces and low dash
    .toLowerCase();

const createJsonTemplate = (id, name, ritual, rarity) => `{
  "id": "${id}",
  "name": "${name}",
  "level": 1,
  "school": "Abjuration",
  "classes": [],
  "tags": [],
  "castingTime": {
    "value": 1,
    "unit": "action",
    "combatCost": {
        "type": "action"
    }
  },
  "range": {
    "type": "Touch"
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": false,
    "materialDescription": null
  },
  "duration": {
    "value": null,
    "unit": "Instantaneous",
    "concentration": false
  },
  "ritual": ${ritual},
  "rarity": "${rarity}",
  "description": "ADD PRIMARY SPELL DESCRIPTION HERE.",
  "higherLevelsDescription": "ADD HIGHER-LEVELS CASTING DESCRIPTION HERE, OR NULL.",
  "effects": [
    {
      "type": "Buff",
      "attack": {
        "type": "None"
      },
      "special": "ADD A STRUCTURED DESCRIPTION OF THE EFFECT HERE."
    }
  ],
  "engineHook": {
    "isImplemented": false,
    "notes": "ADD NOTES ABOUT MECHANICAL IMPLEMENTATION HERE."
  }
}`;

const createMarkdownTemplate = (id, name) => `---
id: "${id}"
title: "${name}"
category: "Spells"
tags: ["level 1", "abjuration"]
excerpt: "ADD A SHORT, ONE-SENTENCE EXCERPT HERE."
seeAlso: []
filePath: "/data/glossary/entries/spells/${id}.md"
---
<div class="spell-card">
  <div class="spell-card-header">
    <h1 class="spell-card-title">${name}</h1>
    <!-- Optional: Add Concentration diamond here if needed -->
    <!-- <div class="spell-card-symbol" title="Concentration"><span class="spell-card-symbol-inner">C</span></div> -->
  </div>
  <div class="spell-card-divider"></div>
  <div class="spell-card-stats-grid">
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Level</span>
      <span class="spell-card-stat-value">1st</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Casting Time</span>
      <span class="spell-card-stat-value">1 Action</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Range/Area</span>
      <span class="spell-card-stat-value">Touch</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Components</span>
      <span class="spell-card-stat-value">V, S, M *</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Duration</span>
      <span class="spell-card-stat-value">Instantaneous</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">School</span>
      <span class="spell-card-stat-value">Abjuration</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Attack/Save</span>
      <span class="spell-card-stat-value">None</span>
    </div>
    <div class="spell-card-stat">
      <span class="spell-card-stat-label">Damage/Effect</span>
      <span class="spell-card-stat-value">Buff</span>
    </div>
  </div>
  <div class="spell-card-divider"></div>
  <p class="spell-card-description">
    ADD FULL SPELL DESCRIPTION HERE.
  </p>
   <p class="spell-card-description">
    <strong>At Higher Levels.</strong> ADD HIGHER-LEVELS CASTING DESCRIPTION HERE.
  </p>
  <!-- Optional: Add material component note here -->
  <!-- <p class="spell-card-material-note">* - (a component)</p> -->
  <div class="spell-card-tags-section">
    <span class="spell-card-tags-label">Spell Tags:</span>
    <!-- <span class="spell-card-tag">HEALING</span> -->
  </div>
  <div class="spell-card-tags-section">
    <span class="spell-card-tags-label">Available For:</span>
    <!-- <span class="spell-card-tag">CLASS</span> -->
  </div>
</div>
`;

// --- Main Script Logic ---

rl.question('Enter the spell name: ', (spellName) => {
  rl.question('Is this a ritual spell? (y/n): ', (isRitual) => {
    rl.question('Enter the spell rarity (common, uncommon, rare, very_rare, legendary): ', (rarity) => {
      const spellId = toKebabCase(spellName);
      const __dirname = path.dirname(new URL(import.meta.url).pathname);

      const spellJsonPath = path.join(__dirname, `../public/data/spells/${spellId}.json`);
      const spellMdPath = path.join(__dirname, `../public/data/glossary/entries/spells/${spellId}.md`);
      const manifestPath = path.join(__dirname, `../public/data/spells_manifest.json`);

      // Check if files already exist
      if (fs.existsSync(spellJsonPath) || fs.existsSync(spellMdPath)) {
        console.error(`Error: Files for spell ID "${spellId}" already exist. Please choose a different name or delete the existing files.`);
        rl.close();
        process.exit(1);
      }

      // 1. Create JSON file
      fs.writeFileSync(spellJsonPath, createJsonTemplate(spellId, spellName, isRitual === 'y', rarity));
      console.log(`Created spell data file: ${spellJsonPath}`);

      // 2. Create Markdown file
      const mdDir = path.dirname(spellMdPath);
      if (!fs.existsSync(mdDir)) {
          fs.mkdirSync(mdDir, { recursive: true });
      }
      fs.writeFileSync(spellMdPath, createMarkdownTemplate(spellId, spellName));
      console.log(`Created glossary entry file: ${spellMdPath}`);

      // 3. Update manifest
      try {
        const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifestData[spellId] = {
          name: spellName,
          level: 1, // Default, user should update
          school: "Abjuration", // Default, user should update
          path: `/data/spells/${spellId}.json`
        };

        const sortedManifest = Object.keys(manifestData).sort().reduce(
          (obj, key) => {
            obj[key] = manifestData[key];
            return obj;
          },
          {}
        );

        fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 2));
        console.log(`Updated spell manifest: ${manifestPath}`);
      } catch (e) {
        console.error(`Failed to update manifest: ${e.message}`);
        rl.close();
        process.exit(1);
      }

      // 4. Regenerate glossary index
      try {
          console.log('Running glossary indexer...');
          buildGlossaryIndex();
          console.log('Glossary index updated successfully.');
      } catch (e) {
          console.error(`\n--- SCRIPT HALTED ---`);
          console.error(`Failed to run glossary indexer. This is likely due to a data integrity issue (e.g., duplicate ID, filename mismatch, or YAML syntax error) in one of the glossary's .md files.`);
          console.error(`Please check the specific error message above to identify the problematic file.`);
          rl.close();
          process.exit(1);
      }


      console.log(`\n✅ Spell "${spellName}" added successfully!`);
      console.log('\nNext steps:');
      console.log(`   1. Edit the placeholder content in the JSON file: public/data/spells/${spellId}.json`);
      console.log(`   2. Edit the placeholder content in the Markdown file: public/data/glossary/entries/spells/${spellId}.md`);
      console.log(`   3. Update class spell lists in src/data/classes/index.ts if necessary.`);

      rl.close();
    });
  });
});
