/**
 * Spell JSON Validation Script
 * 
 * Validates all spell JSON files against the SpellValidator Zod schema.
 * Run with: npx tsx scripts/validateSpellJsons.ts
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added '@ts-ignore' to 
 * 'SpellValidator' import to suppress resolution warnings in the 
 * script environment. Added an explicit type to the 'e' parameter in 
 * the 'map' callback to resolve implicit any warnings.
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';

const SPELLS_DIR = path.join(__dirname, '../public/data/spells');

interface ValidationResult {
    file: string;
    level: number;
    valid: boolean;
    errors?: string[];
}

function validateSpellFile(filePath: string, level: number): ValidationResult {
    const fileName = path.basename(filePath);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        const result = SpellValidator.safeParse(json);

        if (result.success) {
            return { file: fileName, level, valid: true };
        } else {
            const errors = result.error.issues.map((e: import('zod').ZodIssue) =>
                `${e.path.join('.')}: ${e.message}`
            );
            return { file: fileName, level, valid: false, errors };
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            file: fileName,
            level,
            valid: false,
            errors: [`Parse error: ${message}`]
        };
    }
}

function main() {
    const results: ValidationResult[] = [];
    const summary = { total: 0, valid: 0, invalid: 0 };

    // Process each level directory
    for (let level = 0; level <= 9; level++) {
        const levelDir = path.join(SPELLS_DIR, `level-${level}`);

        if (!fs.existsSync(levelDir)) {
            console.log(`Skipping level-${level}: directory not found`);
            continue;
        }

        const files = fs.readdirSync(levelDir).filter(f => f.endsWith('.json'));

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

    // Output results
    console.log('\n=== SPELL JSON VALIDATION REPORT ===\n');
    console.log(`Total: ${summary.total} | Valid: ${summary.valid} | Invalid: ${summary.invalid}\n`);

    // Group by level
    for (let level = 0; level <= 9; level++) {
        const levelResults = results.filter(r => r.level === level);
        if (levelResults.length === 0) continue;

        const invalid = levelResults.filter(r => !r.valid);

        console.log(`--- Level ${level}: ${levelResults.length} files (${invalid.length} invalid) ---`);

        if (invalid.length > 0) {
            for (const r of invalid) {
                console.log(`  ❌ ${r.file}`);
                r.errors?.forEach(e => console.log(`      - ${e}`));
            }
        }
    }

    console.log('\n=== END REPORT ===');

    // Exit with error code if any invalid
    process.exit(summary.invalid > 0 ? 1 : 0);
}

main();
