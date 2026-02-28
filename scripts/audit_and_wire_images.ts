/**
 * @file audit_and_wire_images.ts
 * Scans for race images and ensures they are wired up in both:
 * 1. src/data/races/*.ts (Character Creator)
 * 2. public/data/glossary/entries/races/*.json (Glossary)
 * 
 * MIGRATION (2026-01-21): This script RENAMES files to a hierarchical format (Parent_Subrace_Gender).
 * e.g. wood_elf_male.png -> Elf_Wood_Male.png
 */

/**
 * @file audit_and_wire_images.ts
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Pruning] Refactored 'contentString' to use 'const' 
 * instead of 'let' as it is never reassigned, following ESLint's 
 * 'prefer-const' rule.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const RACES_TS_DIR = path.join(ROOT_DIR, 'src/data/races');
const RACES_JSON_DIR = path.join(ROOT_DIR, 'public/data/glossary/entries/races');
const IMAGES_DIR = path.join(ROOT_DIR, 'public/assets/images/races');

// Helper to check actual filename on disk (case-sensitive)
function getActualFilename(dir: string, name: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    // Find file that matches case-insensitively
    const match = files.find(f => f.toLowerCase() === name.toLowerCase());
    return match || null;
}

// Helper to capitalize first letter
function capitalize(s: string) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Logic to derive the new hierarchical name
function deriveHierarchicalName(id: string, baseRace: string | undefined): string {
    if (!baseRace) return capitalize(id);

    // Explicit overrides for consistency if needed, but logic should work:
    // wood_elf (base elf) -> Elf_Wood

    const baseSlug = baseRace.toLowerCase();
    const idSlug = id.toLowerCase();

    if (idSlug.includes(baseSlug)) {
        const parts = idSlug.split('_');
        const subParts = parts.filter(p => p !== baseSlug);
        const baseCap = capitalize(baseSlug);
        const subCap = subParts.map(p => capitalize(p)).join('_');
        if (!subCap) return baseCap;
        return `${baseCap}_${subCap}`;
    }
    return capitalize(id);
}

async function run() {
    console.log('Starting Migration: Audit, Rename & Wire...\n');
    const tsFiles = fs.readdirSync(RACES_TS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'raceGroups.ts');
    const jsonFiles = fs.readdirSync(RACES_JSON_DIR).filter(f => f.endsWith('.json'));

    const raceIdToNewName: Record<string, string> = {};

    // 1. Audit TS Files & Perform Renaming
    console.log('--- Processing TypeScript Files & Renaming ---');
    for (const file of tsFiles) {
        const filePath = path.join(RACES_TS_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Find the MAIN Race export block to ensure we get the file's primary ID
        // Look for: export const [NAME]: Race = {
        // We make it case-insensitive to catch standard naming conventions
        const raceExportRegex = /export\s+const\s+\w+\s*:\s*Race\s*=\s*{/i;
        const match = content.match(raceExportRegex);

        // Only process if we find the main block, otherwise fallback to start of file (risky but okay for simple files)
        // We slice the content to start searching for ID *after* the export declaration
        let searchContent = content;
        let offset = 0;

        if (match && match.index !== undefined) {
            offset = match.index;
            searchContent = content.slice(offset);
        }

        const idMatch = searchContent.match(/id:\s*['"]([^'"]+)['"]/);
        if (!idMatch) continue;

        const raceId = idMatch[1];
        const baseMatch = searchContent.match(/baseRace:\s*['"]([^'"]+)['"]/);
        const baseRace = baseMatch ? baseMatch[1] : undefined;

        const newBaseName = deriveHierarchicalName(raceId, baseRace);
        raceIdToNewName[raceId] = newBaseName;

        const targets = [
            { suffix: 'male', genderCode: 'Male' },
            { suffix: 'female', genderCode: 'Female' }
        ];

        let contentChanged = false;

        for (const t of targets) {
            const targetFilename = `${newBaseName}_${t.genderCode}.png`;
            const targetPath = path.join(IMAGES_DIR, targetFilename);

            // Potential legacy names to look for
            const candidates = [
                `${raceId}_${t.suffix}.png`,        // wood_elf_male.png
                `${newBaseName}_${t.genderCode}.png`, // Elf_Wood_Male.png (checking case)
                `${newBaseName.toLowerCase()}_${t.suffix}.png` // elf_wood_male.png
            ];

            let actualFile: string | null = null;

            for (const candidate of candidates) {
                const found = getActualFilename(IMAGES_DIR, candidate);
                if (found) {
                    actualFile = found;
                    break;
                }
            }

            if (actualFile) {
                // Check if rename is needed (different name OR different case)
                if (actualFile !== targetFilename) {
                    const oldPath = path.join(IMAGES_DIR, actualFile);
                    console.log(`[RENAME] ${actualFile} -> ${targetFilename}`);
                    fs.renameSync(oldPath, targetPath);
                }

                // Wire up TS inside the Race block
                const tsKey = `${t.suffix}IllustrationPath`;
                const expectedValue = `assets/images/races/${targetFilename}`;
                const exactString = `${tsKey}: '${expectedValue}'`;
                const lineRegex = new RegExp(`${tsKey}:\\s*['"][^'"]+['"]`);

                // Check usage within the *whole* file (imports might be messy if we restrict scope too much, but wiring usually is unique per file)
                // But to be safe, we replace in 'content', and hope regex is specific enough

                if (content.includes(exactString)) {
                    // Done
                } else if (lineRegex.test(content)) {
                    console.log(`[FIX-TS] Updating ${raceId} (${t.suffix}) path`);
                    content = content.replace(lineRegex, exactString);
                    contentChanged = true;
                } else {
                    // Inject into visual block
                    // We must find the visual block relevant to this Race (located after the offset)
                    // We assume there's one visual block per Race export (safe assumption for these files)
                    const visualRegex = /visual:\s*{/;
                    // Find match in searchContent
                    const visualMatchInSearch = searchContent.match(visualRegex);

                    if (visualMatchInSearch && visualMatchInSearch.index !== undefined) {
                        const totalIndex = offset + visualMatchInSearch.index;
                        console.log(`[FIX-TS] Injecting ${raceId} (${t.suffix}) path`);

                        // Helper: slice helper safely
                        const before = content.slice(0, totalIndex + visualMatchInSearch[0].length);
                        const after = content.slice(totalIndex + visualMatchInSearch[0].length);

                        content = before + `\n    ${exactString},` + after;
                        contentChanged = true;
                    }
                }
            }
        }

        if (contentChanged) {
            fs.writeFileSync(filePath, content, 'utf-8');
        }
    }

    // 2. Audit JSON Files
    console.log('\n--- Processing JSON Files ---');
    for (const file of jsonFiles) {
        const filePath = path.join(RACES_JSON_DIR, file);
        const contentString = fs.readFileSync(filePath, 'utf-8');
        let json: any;
        try {
            json = JSON.parse(contentString);
        } catch (e) {
            continue;
        }

        const raceId = json.id;
        const newBaseName = raceIdToNewName[raceId] || capitalize(raceId);

        let changed = false;

        const targets = [
            { suffix: 'male', genderCode: 'Male', jsonKey: 'maleImageUrl' },
            { suffix: 'female', genderCode: 'Female', jsonKey: 'femaleImageUrl' }
        ];

        for (const t of targets) {
            const targetFilename = `${newBaseName}_${t.genderCode}.png`;
            if (getActualFilename(IMAGES_DIR, targetFilename)) {
                const expectedUrl = `/assets/images/races/${targetFilename}`;
                if (json[t.jsonKey] !== expectedUrl) {
                    json[t.jsonKey] = expectedUrl;
                    changed = true;
                    console.log(`[FIX-JSON] Wiring ${raceId} (${t.jsonKey})`);
                }
            }
        }

        if (changed) {
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
        }
    }

    console.log('\nDone.');
}

run();
