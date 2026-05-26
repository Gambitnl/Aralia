import fs from 'fs';
import path from 'path';

// Define paths
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SPELLS_MANIFEST_PATH = path.join(PUBLIC_DIR, 'data', 'spells_manifest.json');
const SPELLS_BUNDLE_PATH = path.join(PUBLIC_DIR, 'data', 'spells_bundle.json');

const GLOSSARY_MAIN_INDEX_PATH = path.join(PUBLIC_DIR, 'data', 'glossary', 'index', 'main.json');
const GLOSSARY_BUNDLE_PATH = path.join(PUBLIC_DIR, 'data', 'glossary_bundle.json');

/**
 * Bundles all individual spell JSON files into a single spells_bundle.json
 */
function bundleSpells() {
  console.log('Bundling spells...');
  if (!fs.existsSync(SPELLS_MANIFEST_PATH)) {
    console.warn(`Spells manifest not found at ${SPELLS_MANIFEST_PATH}. Skipping spells bundle.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(SPELLS_MANIFEST_PATH, 'utf-8'));
  const bundledSpells: Record<string, any> = {};

  let count = 0;
  let missing = 0;

  for (const [id, info] of Object.entries<any>(manifest)) {
    if (!info || !info.path) continue;
    
    // Convert 'data/spells/...' to actual file system path inside public
    const relativePath = info.path;
    const absolutePath = path.join(PUBLIC_DIR, relativePath);

    if (fs.existsSync(absolutePath)) {
      try {
        const spellData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
        bundledSpells[id] = spellData;
        count++;
      } catch (err) {
        console.error(`Failed to parse spell file ${absolutePath}:`, err);
      }
    } else {
      console.warn(`Spell file missing: ${absolutePath}`);
      missing++;
    }
  }

  fs.writeFileSync(SPELLS_BUNDLE_PATH, JSON.stringify(bundledSpells, null, 2), 'utf-8');
  console.log(`Successfully bundled ${count} spells into ${SPELLS_BUNDLE_PATH}. (Missing: ${missing})`);
}

/**
 * Bundles all glossary JSON index files into a single glossary_bundle.json array
 */
function bundleGlossary() {
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
    // Relative paths are like '/data/glossary/index/character_classes.json'
    // Remove leading slash if present to avoid path.join issues
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

function main() {
  console.log('--- Starting static data bundling ---');
  bundleSpells();
  bundleGlossary();
  console.log('--- Bundling complete ---');
}

main();
