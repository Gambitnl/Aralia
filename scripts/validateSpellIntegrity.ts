/** Run every mechanical SpellIntegrityValidator rule on every spell JSON file. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpellIntegrityValidator } from '../src/systems/spells/validation/SpellIntegrityValidator';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';
import { filterReviewedMonolithicClearance } from '../src/systems/spells/validation/spellIntegrityClearances';
import type { Spell } from '../src/types/spells';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SPELLS_DIR = path.resolve(SCRIPT_DIR, '../public/data/spells');

export const SPELL_INTEGRITY_RULES = [
  'Concentration Sync',
  'Ritual Sync',
  'Duration Progression Integrity',
  'Mode Choice Integrity',
  'Action Cost Metadata Integrity',
  'Light Metadata Integrity',
  'Enchantment Targeting',
  'Upcast Scaling Sync',
  'Monolithic Effect Formulation',
  'Effect Description Completeness',
  'Effect Target Filter Completeness',
] as const;

export interface SpellIntegrityResult {
  scanned: number;
  checked: number;
  failures: { file: string; issues: string[] }[];
  cleared: { file: string; spellId: string }[];
}

function spellFiles(root: string): string[] {
  if (!fs.existsSync(root)) throw new Error('Spell directory does not exist: ' + root);
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath);
    }
  };
  visit(root);
  if (files.length === 0) throw new Error('No spell JSON files found in ' + root);
  return files.sort();
}

export function checkSpellIntegrity(root = SPELLS_DIR): SpellIntegrityResult {
  const files = spellFiles(root);
  const result: SpellIntegrityResult = { scanned: files.length, checked: 0, failures: [], cleared: [] };
  for (const file of files) {
    const relativeFile = path.relative(root, file).replace(/\\/g, '/');
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      const parsed = SpellValidator.safeParse(raw);
      if (!parsed.success) {
        result.failures.push({
          file: relativeFile,
          issues: parsed.error.issues.map((issue) =>
            'Schema ' + (issue.path.join('.') || '<root>') + ': ' + issue.message),
        });
        continue;
      }

      const spell = parsed.data as Spell;
      const rawErrors = SpellIntegrityValidator.validate(spell);
      const errors = filterReviewedMonolithicClearance(spell, rawErrors);
      result.checked++;
      if (errors.length < rawErrors.length) {
        result.cleared.push({ file: relativeFile, spellId: spell.id });
      }
      if (errors.length > 0) result.failures.push({ file: relativeFile, issues: errors });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push({ file: relativeFile, issues: ['Parse or validator error: ' + message] });
    }
  }
  return result;
}

export function runSpellIntegrity(
  root = SPELLS_DIR,
  emit: (line: string) => void = (line) => console.log(line),
): boolean {
  let result: SpellIntegrityResult;
  try {
    result = checkSpellIntegrity(root);
  } catch (error: unknown) {
    emit('[Spell Integrity] ' + (error instanceof Error ? error.message : String(error)));
    return false;
  }

  emit('[Spell Integrity] Ran SpellIntegrityValidator.validate on ' + result.checked
    + ' of ' + result.scanned + ' spell JSON files. Mechanical rules:');
  SPELL_INTEGRITY_RULES.forEach((rule, index) => emit('  ' + (index + 1) + '. ' + rule));
  emit('[Spell Integrity] Reviewed monolithic-description clearances applied: '
    + (result.cleared.length
      ? result.cleared.map((entry) => entry.spellId).join(', ')
      : 'none'));
  for (const failure of result.failures) {
    emit('[Spell Integrity] ' + failure.file + ':');
    failure.issues.forEach((issue) => emit('  - ' + issue));
  }
  const passed = result.failures.length === 0 && result.checked === result.scanned;
  emit('[Spell Integrity] ' + (passed ? 'PASS' : 'FAIL') + ': '
    + result.checked + ' mechanically checked, ' + result.failures.length + ' failing file(s).');
  return passed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!runSpellIntegrity()) process.exitCode = 1;
}
