/**
 * Spell JSON Formatter Script (ESM)
 * 
 * Normalizes all spell JSON files to consistent formatting:
 * - 2-space indentation
 * - Canonical field ordering
 * - Adds missing optional fields with defaults
 * 
 * Run with: node scripts/formatSpellJsons.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPELLS_DIR = path.join(__dirname, '../public/data/spells');
const DRY_RUN = process.argv.includes('--dry-run');

// Canonical field order for spell JSON
const FIELD_ORDER = [
    'id',
    'name',
    'level',
    'school',
    'source',
    'legacy',
    'classes',
    'description',
    'higherLevels',
    'tags',
    'ritual',
    'rarity',
    'castingTime',
    'range',
    'components',
    'duration',
    'targeting',
    'effects'
];

// Default values for optional fields
const OPTIONAL_DEFAULTS = {
    ritual: false,
    legacy: false,
    // source: undefined - should be set manually per spell
    // higherLevels: "" - only if spell has scaling
};

function orderObject(obj) {
    const ordered = {};

    // First, add fields in canonical order
    for (const field of FIELD_ORDER) {
        if (obj[field] !== undefined) {
            ordered[field] = obj[field];
        }
    }

    // Then add any remaining fields not in the order list
    for (const field of Object.keys(obj)) {
        if (!FIELD_ORDER.includes(field)) {
            ordered[field] = obj[field];
        }
    }

    return ordered;
}

function formatSpellFile(filePath) {
    const fileName = path.basename(filePath);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        // Apply defaults for missing optional fields
        for (const [field, defaultValue] of Object.entries(OPTIONAL_DEFAULTS)) {
            if (json[field] === undefined) {
                json[field] = defaultValue;
            }
        }

        // Reorder fields
        const ordered = orderObject(json);

        // Format with 2-space indent
        const formatted = JSON.stringify(ordered, null, 2) + '\n';

        // Check if anything changed
        if (content === formatted) {
            return { file: fileName, changed: false };
        }

        if (!DRY_RUN) {
            fs.writeFileSync(filePath, formatted, 'utf8');
        }

        return { file: fileName, changed: true };

    } catch (e) {
        return { file: fileName, error: e.message };
    }
}

function main() {
    console.log(`\n=== SPELL JSON FORMATTER ===${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

    let totalFiles = 0;
    let changedFiles = 0;
    let errorFiles = 0;

    // Process each level directory
    for (let level = 0; level <= 9; level++) {
        const levelDir = path.join(SPELLS_DIR, `level-${level}`);

        if (!fs.existsSync(levelDir)) {
            continue;
        }

        const files = fs.readdirSync(levelDir).filter(f => f.endsWith('.json'));
        let levelChanged = 0;

        for (const file of files) {
            const filePath = path.join(levelDir, file);
            const result = formatSpellFile(filePath);
            totalFiles++;

            if (result.error) {
                console.log(`  ERROR ${result.file}: ${result.error}`);
                errorFiles++;
            } else if (result.changed) {
                levelChanged++;
                changedFiles++;
            }
        }

        console.log(`Level ${level}: ${files.length} files, ${levelChanged} changed`);
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total: ${totalFiles} | Changed: ${changedFiles} | Errors: ${errorFiles}`);

    if (DRY_RUN && changedFiles > 0) {
        console.log(`\nRun without --dry-run to apply changes.`);
    }

    console.log('\n=== END ===');
}

main();
