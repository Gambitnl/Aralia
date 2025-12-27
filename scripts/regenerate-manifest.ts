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

const manifest: Record<string, ManifestEntry> = {};

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
        // TODO: Add detection for orphaned/duplicate spell files (e.g. key collision check) to ensure data hygiene.
        const webPath = `/data/spells/${file.replace(/\\/g, '/')}`;

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

// Sort keys
const sortedManifest = Object.keys(manifest).sort().reduce((obj, key) => {
    obj[key] = manifest[key];
    return obj;
}, {} as Record<string, ManifestEntry>);

// TODO(safety): Consider diffing old vs new manifest and warning if spells were removed.
// A spell disappearing could indicate an accidental deletion or file rename issue.
fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 2));
console.log(`Generated manifest with ${Object.keys(sortedManifest).length} spells.`);
