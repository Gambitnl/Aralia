import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const spellsDir = path.join(process.cwd(), 'public/data/spells');
const manifestPath = path.join(process.cwd(), 'public/data/spells_manifest.json');

console.log('Scanning for spells in:', spellsDir);

// glob.sync returns relative paths from cwd
const spellFiles = glob.sync('**/*.json', { cwd: spellsDir });

type ManifestEntry = {
    name: string;
    aliases?: string[];
    level: number;
    school: string;
    path: string;
};

// This object will store the spell manifest, keyed by spell ID
const manifest: Record<string, ManifestEntry> = {};

// Track duplicate spell IDs to ensure data hygiene
// A duplicate ID means two different files claim to be the same spell, which would cause one to overwrite the other
const duplicateIds: Record<string, string[]> = {};

spellFiles.forEach(file => {
    const filePath = path.join(spellsDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const spell = JSON.parse(content);

        // Validate required fields
        if (!spell.id || !spell.name || spell.level === undefined || !spell.school) {
            console.warn(`Skipping invalid spell file: ${file} (missing id, name, level, or school)`);
            return;
        }

        // Path should be relative to public root, starting with /
        // file is relative to spellsDir (e.g. "level-0/acid-splash.json" or "acid-splash.json")
        const webPath = `/data/spells/${file.replace(/\\/g, '/')}`;

        // Check for duplicate spell IDs (key collision detection)
        // If this spell ID already exists in the manifest, we have a duplicate
        if (manifest[spell.id]) {
            // Track this duplicate for reporting
            if (!duplicateIds[spell.id]) {
                duplicateIds[spell.id] = [manifest[spell.id].path];
            }
            duplicateIds[spell.id].push(webPath);
            console.error(`⚠️  DUPLICATE SPELL ID: "${spell.id}" found in multiple files:`);
            duplicateIds[spell.id].forEach(path => console.error(`   - ${path}`));
        }

        manifest[spell.id] = {
            name: spell.name,
            aliases: Array.isArray(spell.aliases) ? spell.aliases : undefined,
            level: spell.level,
            school: spell.school,
            path: webPath
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error reading spell file ${file}: ${message}`);
    }
});

// Sort the manifest keys alphabetically for consistent output
// This makes git diffs cleaner when spells are added/removed
const sortedManifest = Object.keys(manifest).sort().reduce((obj, key) => {
    obj[key] = manifest[key];
    return obj;
}, {} as Record<string, ManifestEntry>);

// Report duplicate spell IDs if any were found
// Duplicates are a data hygiene issue - they mean the manifest will only include one file per ID
if (Object.keys(duplicateIds).length > 0) {
    console.error(`\n❌ Found ${Object.keys(duplicateIds).length} duplicate spell ID(s). Please fix these conflicts.`);
    console.error('Each spell must have a unique ID across all spell files.\n');
}

// TODO(safety): Consider diffing old vs new manifest and warning if spells were removed.
// A spell disappearing could indicate an accidental deletion or file rename issue.
fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 2));
console.log(`Generated manifest with ${Object.keys(sortedManifest).length} spells.`);

// Exit with error code if duplicates were found
// This ensures CI/CD pipelines catch the issue
if (Object.keys(duplicateIds).length > 0) {
    process.exit(1);
}
