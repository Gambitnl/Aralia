
import * as fs from 'fs';
import * as path from 'path';
import { Spell } from '../types/spells';
import { validateEnchantmentConsistency, ValidationIssue } from '../utils/validation/spellConsistencyValidator';

// Simple script to run validation and output Markdown table
// Usage: npx tsx src/scripts/audit_enchantment_consistency.ts

const SPELLS_ROOT = 'public/data/spells';

function getAllSpells(): Spell[] {
  const spells: Spell[] = [];

  if (!fs.existsSync(SPELLS_ROOT)) return spells;

  const levels = fs.readdirSync(SPELLS_ROOT).filter(d => d.startsWith('level-'));

  for (const level of levels) {
    const dir = path.join(SPELLS_ROOT, level);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const spell = JSON.parse(content) as Spell;
        spells.push(spell);
      // TODO(lint-intent): Capture parse errors if we want detailed diagnostics in the audit output.
      // TODO(lint-intent): Consider adding error context (file contents hash, schema version) when expanding the report.
      } catch {
        console.error(`Failed to parse ${file}`);
      }
    }
  }
  return spells;
}

function runAudit() {
  const spells = getAllSpells();
  const enchantmentSpells = spells.filter(s => s.school === 'Enchantment');

  const allIssues: ValidationIssue[] = [];

  for (const spell of enchantmentSpells) {
    const issues = validateEnchantmentConsistency(spell);
    allIssues.push(...issues);
  }

  // Output Markdown Table
  console.log("# 📊 Auditor: Enchantment Consistency Audit\n");
  console.log(`Audited ${enchantmentSpells.length} Enchantment spells.`);
  console.log(`Found ${allIssues.length} potential issues.\n`);

  console.log("| Spell | Level | Issue Category | Message |");
  console.log("|---|---|---|---|");

  for (const issue of allIssues) {
    // Find spell name for context
    const spell = spells.find(s => s.id === issue.spellId);
    console.log(`| ${spell?.name || issue.spellId} | ${spell?.level} | ${issue.category} | ${issue.message} |`);
  }

  console.log("\n## Recommended Action");
  console.log("Run `npm run fix-enchantments` (hypothetical) or manually update these files to include missing `excludeCreatureTypes` or `breakConditions`.");
}

runAudit();
