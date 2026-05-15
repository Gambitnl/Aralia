import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-shot retirement helper for `subClassesVerification`.
 *
 * The field was kept while the Sub-Classes bucket was open so the gate
 * checker could distinguish "examined-empty" from "never-looked-at". With
 * the bucket closed on 2026-05-11, the flag is redundant: every spell's
 * structured `.md` either carries roster-clean entries or one of the three
 * markers, and the JSON's `subClasses` array mirrors that.
 *
 * This script removes the `subClassesVerification` key from every spell
 * JSON file under `public/data/spells/`. Schema-side, the field has been
 * made optional (see SpellClassAccess in spellValidator.ts), so files
 * without it still validate.
 *
 * Modes:
 *   --apply    actually write the JSON files (default is dry-run)
 *
 * Run:
 *   npx tsx scripts/retireSpellSubClassesVerification.ts          # dry-run
 *   npx tsx scripts/retireSpellSubClassesVerification.ts --apply  # write
 */

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR  = path.dirname(SCRIPT_FILE);
const REPO_ROOT   = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');

function listJsonFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (ent.isFile() && ent.name.endsWith('.json')) out.push(full);
    }
  }
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Textual removal of the `"subClassesVerification": "..."` line plus the
 * trailing comma. We deliberately don't JSON.parse+stringify because the
 * existing files use idiosyncratic formatting (varying indentation, blank
 * lines) that we don't want to normalize on every touch. Two patterns are
 * tried:
 *   - the field appears between two other fields (trailing comma after the value)
 *   - the field appears as the last field of an object (no trailing comma; we
 *     instead strip the trailing comma from the prior line)
 */
function stripField(jsonText: string): { text: string; touched: boolean } {
  // Common case: field followed by a comma and the next field.
  const reWithComma = /\s*"subClassesVerification":\s*"[^"]*",\s*\n?/;
  if (reWithComma.test(jsonText)) {
    return { text: jsonText.replace(reWithComma, '\n  '), touched: true };
  }
  // Final-field case: field with no trailing comma. Strip the previous comma too.
  const reLastField = /,\s*\n\s*"subClassesVerification":\s*"[^"]*"\s*/;
  if (reLastField.test(jsonText)) {
    return { text: jsonText.replace(reLastField, ''), touched: true };
  }
  return { text: jsonText, touched: false };
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const files = listJsonFiles(SPELL_JSON_ROOT);

  let touched = 0;
  let alreadyClean = 0;
  const failures: string[] = [];

  /* eslint-disable no-console */
  console.log(`subClassesVerification retirement (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log(`Scanned: ${files.length} JSON files`);
  console.log('');

  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    if (!text.includes('subClassesVerification')) {
      alreadyClean++;
      continue;
    }
    const result = stripField(text);
    if (!result.touched) {
      failures.push(`${path.basename(f)}: contains the field but neither regex matched`);
      continue;
    }
    if (apply) fs.writeFileSync(f, result.text);
    touched++;
  }

  console.log(`Already clean: ${alreadyClean}`);
  console.log(`Stripped:      ${touched}`);
  console.log(`Failed:        ${failures.length}`);
  if (failures.length) {
    console.log('');
    console.log('Failures:');
    for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  }
  if (!apply) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to write the changes.');
  }
  /* eslint-enable no-console */
}

main();
