/**
 * This script validates every spell JSON file against the live SpellValidator schema.
 *
 * It exists as the spell-only validation path for the spell data validation track.
 * The broader `validate-data.ts` flow touches more systems and can fail for unrelated
 * reasons, so this file gives the project a narrow answer to a narrow question:
 * "Do the spell JSON files currently match the repo's machine-checkable spell schema?"
 *
 * Called by: developers running `npx tsx scripts/validateSpellJsons.ts`
 * Depends on: the spell JSON files in `public/data/spells` and the live Zod schema in
 * `src/systems/spells/validation/spellValidator.ts`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodIssue } from 'zod';
// @ts-expect-error -- tsx resolves local TS entrypoints at runtime; keep extensionless for script stability.
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';

// ============================================================================
// Path Resolution
// ============================================================================
// This section converts the ESM module URL into a normal filesystem path.
// The previous version used `__dirname`, which only exists in CommonJS and caused
// the script to crash before any spell files could be checked.
// ============================================================================
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const SPELLS_DIR = path.resolve(SCRIPT_DIR, '../public/data/spells');

// ============================================================================
// Validation Result Shape
// ============================================================================
// These result objects let the report stay human-readable while still preserving
// enough detail to see which spell failed and why.
// ============================================================================
interface ValidationResult {
    file: string;
    level: number;
    valid: boolean;
    errors?: string[];
}

// ============================================================================
// Semantic Spell-Truth Checks
// ============================================================================
// The Zod schema proves that the spell JSON has the right structure, but some
// trust-system problems still exist even when the file is formally valid.
//
// One example is redundant subclass/domain access. If a spell already grants the
// full base class in `classes`, then a `subClasses` entry for that same base
// class does not add new access information; it only repeats the base lane in a
// more specific form. The owner asked for this pattern to be flagged as
// problematic so it can be arbitrated instead of silently normalized.
// ============================================================================
const NON_CASTER_BASE_CLASSES = new Set([
    'Barbarian',
    'Fighter',
    'Monk',
    'Rogue',
]);

function collectSemanticSpellErrors(json: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const classes = Array.isArray(json.classes)
        ? json.classes.map((entry) => String(entry))
        : [];
    const subClasses = Array.isArray(json.subClasses)
        ? json.subClasses.map((entry) => String(entry))
        : [];

    for (const subClassEntry of subClasses) {
        // The current subclass/domain convention is "Base Class - Subclass Name".
        // Only entries that match that shape can be checked for base-class
        // redundancy; everything else should remain visible for separate review.
        const match = subClassEntry.match(/^(.+?)\s*-\s+(.+)$/);
        if (!match) {
            continue;
        }

        const baseClass = match[1].trim();
        if (!classes.includes(baseClass)) {
            continue;
        }

        errors.push(
            `subClasses: redundant access entry "${subClassEntry}" repeats base class "${baseClass}" that is already present in classes`,
        );
    }

    for (const classEntry of classes) {
        // These base classes are not full spellcasting classes in the project's
        // current class model. If a spell lists one of them in `classes`, the
        // access is suspicious and should move into extra checking instead of
        // being treated as ordinary broad spell-list membership.
        if (!NON_CASTER_BASE_CLASSES.has(classEntry)) {
            continue;
        }

        errors.push(
            `classes: non-caster base class "${classEntry}" is listed as a broad spellcasting class and should be reviewed explicitly`,
        );
    }

    return errors;
}

// ============================================================================
// File Validation
// ============================================================================
// This section loads a single spell JSON file, parses it, and asks the live
// SpellValidator schema whether the structure is acceptable.
// ============================================================================
function validateSpellFile(filePath: string, level: number): ValidationResult {
    const fileName = path.basename(filePath);

    try {
        // Read the raw JSON file exactly as the repo stores it.
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        // Use safeParse so we can keep scanning the rest of the spell set even if
        // one file fails validation.
        const result = SpellValidator.safeParse(json);

        if (result.success) {
            // Only run the semantic spell-truth checks after the file has already
            // passed shape validation. That keeps the report honest about whether
            // a failure is "bad JSON shape" or "valid shape but problematic data."
            const semanticErrors = collectSemanticSpellErrors(json as Record<string, unknown>);
            if (semanticErrors.length === 0) {
                return { file: fileName, level, valid: true };
            }

            return { file: fileName, level, valid: false, errors: semanticErrors };
        }

        // Convert the Zod issue list into compact path + message lines that are
        // easy to read in terminal output or paste into an arbitration ledger later.
        const errors = result.error.issues.map((issue: ZodIssue) =>
            `${issue.path.join('.')}: ${issue.message}`,
        );

        return { file: fileName, level, valid: false, errors };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            file: fileName,
            level,
            valid: false,
            errors: [`Parse error: ${message}`],
        };
    }
}

// ============================================================================
// Level Scan
// ============================================================================
// This section walks the standard spell level folders so the validator answers
// the whole-project question instead of only checking one hand-picked file.
// ============================================================================
function collectValidationResults(): { results: ValidationResult[]; summary: { total: number; valid: number; invalid: number } } {
    const results: ValidationResult[] = [];
    const summary = { total: 0, valid: 0, invalid: 0 };

    for (let level = 0; level <= 9; level++) {
        const levelDir = path.join(SPELLS_DIR, `level-${level}`);

        // Keep the script resilient if a level folder is temporarily missing.
        if (!fs.existsSync(levelDir)) {
            console.log(`Skipping level-${level}: directory not found`);
            continue;
        }

        const files = fs.readdirSync(levelDir).filter((file) => file.endsWith('.json'));

        for (const file of files) {
            const filePath = path.join(levelDir, file);
            const result = validateSpellFile(filePath, level);
            results.push(result);
            summary.total++;

            if (result.valid) {
                summary.valid++;
            } else {
                summary.invalid++;
            }
        }
    }

    return { results, summary };
}

// ============================================================================
// Report Output
// ============================================================================
// This section prints a grouped terminal report that mirrors how the spell docs
// are organized by level, so bad files are easier to find and repair.
// ============================================================================
function printReport(results: ValidationResult[], summary: { total: number; valid: number; invalid: number }): void {
    console.log('\n=== SPELL JSON VALIDATION REPORT ===\n');
    console.log(`Total: ${summary.total} | Valid: ${summary.valid} | Invalid: ${summary.invalid}\n`);

    for (let level = 0; level <= 9; level++) {
        const levelResults = results.filter((result) => result.level === level);
        if (levelResults.length === 0) continue;

        const invalid = levelResults.filter((result) => !result.valid);
        console.log(`--- Level ${level}: ${levelResults.length} files (${invalid.length} invalid) ---`);

        for (const result of invalid) {
            console.log(`  X ${result.file}`);
            result.errors?.forEach((error) => console.log(`      - ${error}`));
        }
    }

    console.log('\n=== END REPORT ===');
}

// ============================================================================
// Main Entry
// ============================================================================
// This section ties the scan together and returns a failing exit code when any
// spell file breaks schema expectations, which makes the script CI-friendly later.
// ============================================================================
function main(): void {
    const { results, summary } = collectValidationResults();
    printReport(results, summary);
    process.exit(summary.invalid > 0 ? 1 : 0);
}

main();
