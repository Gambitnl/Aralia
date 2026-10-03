/**
 * Static Data Bundling Script (WF-G162)
 *
 * This script combines individual JSON files from public/data/ into single
 * bundled JSON files for fast runtime loading by the game client:
 *   - public/data/spells subdirectories -> public/data/spells_bundle.json
 *   - public/data/glossary/index/*.json -> public/data/glossary_bundle.json
 *
 * It supports scoped CLI flags:
 *   --spells    Bundle only spells data (prevents touching glossary in shared checkouts)
 *   --glossary  Bundle only glossary data (prevents touching spells in shared checkouts)
 * If neither flag is provided, both bundles are built.
 *
 * Called by:
 *   - npm run spells:bundle
 *   - npm run glossary:rebuild
 */
import fs from 'fs';
import path from 'path';
import { generateSpellArtifacts } from './spells/artifacts';

// Define paths for data directories and output bundles
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const GLOSSARY_MAIN_INDEX_PATH = path.join(PUBLIC_DIR, 'data', 'glossary', 'index', 'main.json');
const GLOSSARY_BUNDLE_PATH = path.join(PUBLIC_DIR, 'data', 'glossary_bundle.json');

// ============================================================================
// Spells Bundling
// ============================================================================
// Reads all individual spell JSON files referenced by spells_manifest.json
// and packs them into a single key-value dictionary in spells_bundle.json.
// ============================================================================
export async function bundleSpells() {
  // Validate sources first, so a missing or invalid definition cannot produce a partial bundle.
  await generateSpellArtifacts();
}

// ============================================================================
// Glossary Bundling
// ============================================================================
// Reads all index files listed in glossary/index/main.json and bundles
// all unique entries into a deduplicated array in glossary_bundle.json.
// ============================================================================
export function bundleGlossary() {
  console.log('Bundling glossary...');
  if (!fs.existsSync(GLOSSARY_MAIN_INDEX_PATH)) {
    console.warn(`Glossary main index not found at ${GLOSSARY_MAIN_INDEX_PATH}. Skipping glossary bundle.`);
    return;
  }

  const mainIndex = JSON.parse(fs.readFileSync(GLOSSARY_MAIN_INDEX_PATH, 'utf-8'));
  const indexFiles: string[] = mainIndex.index_files || [];

  const allEntries: any[] = [];
  let count = 0;
  let missing = 0;

  for (const relativePath of indexFiles) {
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const absolutePath = path.join(PUBLIC_DIR, cleanPath);

    if (fs.existsSync(absolutePath)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
        if (Array.isArray(fileData)) {
          allEntries.push(...fileData);
          count += fileData.length;
        } else {
          console.warn(`Glossary index file ${absolutePath} is not an array. Skipping.`);
        }
      } catch (err) {
        console.error(`Failed to parse glossary file ${absolutePath}:`, err);
      }
    } else {
      console.warn(`Glossary index file missing: ${absolutePath}`);
      missing++;
    }
  }

  // Deduplicate entries by ID
  const uniqueEntriesMap = new Map();
  for (const entry of allEntries) {
    if (entry && entry.id) {
      uniqueEntriesMap.set(entry.id, entry);
    }
  }
  const finalUniqueEntries = Array.from(uniqueEntriesMap.values());

  fs.writeFileSync(GLOSSARY_BUNDLE_PATH, JSON.stringify(finalUniqueEntries, null, 2), 'utf-8');
  console.log(`Successfully bundled ${finalUniqueEntries.length} unique glossary entries into ${GLOSSARY_BUNDLE_PATH}. (Index files missing: ${missing})`);
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const spellsOnly = args.includes('--spells');
  const glossaryOnly = args.includes('--glossary');

  console.log('--- Starting static data bundling ---');

  if (spellsOnly) {
    await bundleSpells();
  } else if (glossaryOnly) {
    bundleGlossary();
  } else {
    await bundleSpells();
    bundleGlossary();
  }

  console.log('--- Bundling complete ---');
}

if (process.argv[1] && process.argv[1].includes('bundle-static-data')) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
