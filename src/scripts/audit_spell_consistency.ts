
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to handle ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELL_DATA_PATH = path.join(__dirname, '../../public/data/spells');

interface AuditResult {
  spellId: string;
  name: string;
  issue: string;
}

function getAllSpellFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllSpellFiles(filePath, fileList);
    } else if (file.endsWith('.json') && !file.includes('manifest')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function auditHealingRestrictions() {
  const files = getAllSpellFiles(SPELL_DATA_PATH);
  const results: AuditResult[] = [];
  const scannedCount = files.length;

  console.log(`Scanning ${scannedCount} spells for Healing/Targeting inconsistencies...`);

  files.forEach((filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const spell = JSON.parse(content);

      const description = (spell.description || '').toLowerCase();
      const excludeTypes = spell.targeting?.filter?.excludeCreatureTypes || [];
      const normalizedExcludes = excludeTypes.map((t: string) => t.toLowerCase());

      // Pattern 1: Explicit Undead/Construct restriction
      // "has no effect on undead or constructs"
      if (description.includes('no effect on undead') || description.includes('no effect on constructs')) {
        const missesUndead = !normalizedExcludes.includes('undead');
        const missesConstruct = !normalizedExcludes.includes('construct');

        if (missesUndead || missesConstruct) {
          results.push({
            spellId: spell.id,
            name: spell.name,
            issue: `Description restricts Undead/Constructs but filter is missing: ${
              missesUndead ? 'Undead' : ''
            } ${missesConstruct ? 'Construct' : ''}`.trim(),
          });
        }
      }

      // Pattern 2: "Constructs and Undead" cannot be healed (Spare the Dying)
      // Note: Spare the Dying says "has no effect on undead or constructs" in 2014,
      // but 2024 description might vary. Checking broadly.

    } catch (e) {
      console.error(`Error processing ${filePath}:`, e);
    }
  });

  console.log('\n--- AUDIT RESULTS ---');
  if (results.length === 0) {
    console.log('✅ No inconsistencies found.');
  } else {
    console.table(results);
    console.log(`\nFound ${results.length} issues.`);
  }
}

// TODO: Expand audit to check for "Ignites" keyword in description vs "Ignited" condition in effects.
// See public/data/spells/level-1/burning-hands.json vs searing-smite.json

auditHealingRestrictions();
