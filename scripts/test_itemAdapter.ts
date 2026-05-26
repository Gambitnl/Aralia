import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertGlossaryEntryToItem } from '../src/utils/itemAdapter.js';
import { GlossaryEntry } from '../src/types/ui.js';
import { Item, ItemType } from '../src/types/items.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const glossaryDir = path.join(__dirname, '..', 'public', 'data', 'glossary', 'entries');

function getFilesRecursively(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
        if (entry.isDirectory()) {
            files = files.concat(getFilesRecursively(path.join(dir, entry.name)));
        } else if (entry.name.endsWith('.json')) {
            files.push(path.join(dir, entry.name));
        }
    }
    return files;
}

function main() {
    const files = getFilesRecursively(glossaryDir);
    let success = 0;
    let failed = 0;
    let validItems = 0;
    
    console.log(`Testing ${files.length} glossary entries...`);
    
    for (const file of files) {
        try {
            const data = fs.readFileSync(file, 'utf-8');
            const entry = JSON.parse(data) as GlossaryEntry;
            
            if (entry.itemMetadata) {
                const item = convertGlossaryEntryToItem(entry);
                if (item) {
                    // Very basic validation against the Item type
                    if (!item.id || !item.name || !item.type) {
                        console.error(`Invalid item generated for ${entry.id}: missing required fields`);
                        failed++;
                        continue;
                    }
                    if (!Object.values(ItemType).includes(item.type as ItemType)) {
                        console.error(`Invalid item type generated for ${entry.id}: ${item.type}`);
                        failed++;
                        continue;
                    }
                    validItems++;
                } else {
                    console.error(`Failed to generate item for ${entry.id}`);
                    failed++;
                }
            }
            success++;
        } catch (e) {
            console.error(`Failed to process ${file}:`, e);
            failed++;
        }
    }
    
    console.log(`\nProcessed ${success + failed} total entries.`);
    console.log(`Successfully generated ${validItems} valid Item instances.`);
    if (failed > 0) {
        console.error(`${failed} entries failed to process.`);
    } else {
        console.log(`All items processed successfully! Engine integration is sound.`);
    }
}

main();
