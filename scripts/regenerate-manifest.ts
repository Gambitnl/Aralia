import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const spellsDir = path.join(process.cwd(), 'public/data/spells');
const manifestPath = path.join(process.cwd(), 'public/data/spells_manifest.json');

console.log('Scanning for spells in:', spellsDir);

// glob.sync returns relative paths from cwd
const spellFiles = glob.sync('**/*.json', { cwd: spellsDir });

const manifest: Record<string, any> = {};

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

        manifest[spell.id] = {
            name: spell.name,
            level: spell.level,
            school: spell.school,
            path: webPath
        };
    } catch (e: any) {
        console.error(`Error reading spell file ${file}: ${e.message}`);
    }
});

// Sort keys
const sortedManifest = Object.keys(manifest).sort().reduce((obj, key) => {
    obj[key] = manifest[key];
    return obj;
}, {} as Record<string, any>);

fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 2));
console.log(`Generated manifest with ${Object.keys(sortedManifest).length} spells.`);
