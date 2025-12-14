/**
 * Spell JSON Validation Script (ESM)
 * 
 * Validates all spell JSON files for basic schema compliance.
 * Run with: node scripts/validateSpellJsons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(__dirname, '../public/data/spells');

// Required fields for a valid spell JSON
const REQUIRED_FIELDS = [
    'id', 'name', 'level', 'school', 'classes',
    'castingTime', 'range', 'components', 'duration',
    'targeting', 'effects', 'description'
];

// Optional fields (for completeness tracking)
const OPTIONAL_FIELDS = [
    'higherLevels', 'tags', 'ritual', 'source', 'legacy', 'rarity'
];

function validateSpellFile(filePath, level) {
    const fileName = path.basename(filePath);
    const errors = [];
    const warnings = [];

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let json;

        try {
            json = JSON.parse(content);
        } catch (e) {
            return { file: fileName, level, valid: false, errors: [`JSON parse error: ${e.message}`] };
        }

        // Check required fields
        for (const field of REQUIRED_FIELDS) {
            if (json[field] === undefined) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Type checks
        if (json.level !== undefined && typeof json.level !== 'number') {
            errors.push(`level should be number, got ${typeof json.level}`);
        }
        if (json.classes !== undefined && !Array.isArray(json.classes)) {
            errors.push(`classes should be array, got ${typeof json.classes}`);
        }
        if (json.effects !== undefined && !Array.isArray(json.effects)) {
            errors.push(`effects should be array, got ${typeof json.effects}`);
        }

        // Check casting time structure
        if (json.castingTime) {
            if (!json.castingTime.value || !json.castingTime.unit) {
                errors.push('castingTime missing value or unit');
            }
        }

        // Check components structure
        if (json.components) {
            if (typeof json.components.verbal !== 'boolean' ||
                typeof json.components.somatic !== 'boolean' ||
                typeof json.components.material !== 'boolean') {
                errors.push('components fields should be booleans');
            }
        }

        // Check duration structure
        if (json.duration) {
            if (!json.duration.type) {
                errors.push('duration missing type');
            }
        }

        // Check for missing optional fields (warnings)
        for (const field of OPTIONAL_FIELDS) {
            if (json[field] === undefined) {
                warnings.push(`Optional field missing: ${field}`);
            }
        }

        return {
            file: fileName,
            level,
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        };

    } catch (e) {
        return { file: fileName, level, valid: false, errors: [`File read error: ${e.message}`] };
    }
}

function main() {
    const results = [];
    const summary = { total: 0, valid: 0, invalid: 0 };

    // Process each level directory
    for (let level = 0; level <= 9; level++) {
        const levelDir = path.join(SPELLS_DIR, `level-${level}`);

        if (!fs.existsSync(levelDir)) {
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
                console.log(`  X ${r.file}`);
                r.errors?.forEach(e => console.log(`      - ${e}`));
            }
        }
    }

    console.log('\n=== END REPORT ===');
}

main();
