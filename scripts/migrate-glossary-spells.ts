/**
 * Migration script: Move glossary spell markdown files into level subfolders
 *
 * This script:
 * 1. Reads spells_manifest.json to get spell levels
 * 2. For each .md file in public/data/glossary/entries/spells/
 *    - Looks up the spell's level from the manifest
 *    - Updates the filePath in frontmatter
 *    - Moves the file to level-{N}/{id}.md
 * 3. Reports a summary of what was migrated
 */

import fs from 'fs';
import path from 'path';

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'data', 'spells_manifest.json');
const GLOSSARY_SPELLS_DIR = path.join(process.cwd(), 'public', 'data', 'glossary', 'entries', 'spells');

interface ManifestEntry {
  name: string;
  level: number;
  school: string;
  path: string;
}

const loadManifest = (): Record<string, ManifestEntry> => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('spells_manifest.json not found');
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
};

const updateFrontmatterFilePath = (content: string, newFilePath: string): string => {
  // Match filePath in frontmatter and replace it
  const filePathRegex = /^(filePath:\s*["']?)([^"'\n]+)(["']?\s*)$/m;
  if (filePathRegex.test(content)) {
    return content.replace(filePathRegex, `$1${newFilePath}$3`);
  }
  return content;
};

const main = () => {
  const manifest = loadManifest();

  // Get all .md files in the root spells directory (not in subfolders)
  const files = fs.readdirSync(GLOSSARY_SPELLS_DIR).filter(f => {
    const fullPath = path.join(GLOSSARY_SPELLS_DIR, f);
    return f.endsWith('.md') && fs.statSync(fullPath).isFile();
  });

  console.log(`Found ${files.length} markdown files to migrate\n`);

  const stats = {
    moved: 0,
    skipped: 0,
    notInManifest: [] as string[],
    errors: [] as string[],
  };

  for (const file of files) {
    const spellId = file.replace('.md', '');
    const manifestEntry = manifest[spellId];

    if (!manifestEntry) {
      stats.notInManifest.push(spellId);
      stats.skipped++;
      continue;
    }

    const level = manifestEntry.level;

    // Only migrate level 0, 1, 2 for now (as per plan)
    if (level > 2) {
      console.log(`  Skipping ${spellId} (level ${level} - not migrating yet)`);
      stats.skipped++;
      continue;
    }

    const sourcePath = path.join(GLOSSARY_SPELLS_DIR, file);
    const targetDir = path.join(GLOSSARY_SPELLS_DIR, `level-${level}`);
    const targetPath = path.join(targetDir, file);
    const newFilePath = `/data/glossary/entries/spells/level-${level}/${spellId}.md`;

    try {
      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Read file content
      let content = fs.readFileSync(sourcePath, 'utf-8');

      // Update filePath in frontmatter
      content = updateFrontmatterFilePath(content, newFilePath);

      // Write to new location
      fs.writeFileSync(targetPath, content, 'utf-8');

      // Delete original
      fs.unlinkSync(sourcePath);

      console.log(`  Moved: ${spellId} -> level-${level}/`);
      stats.moved++;
    } catch (err) {
      stats.errors.push(`${spellId}: ${(err as Error).message}`);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Moved: ${stats.moved}`);
  console.log(`Skipped: ${stats.skipped}`);

  if (stats.notInManifest.length > 0) {
    console.log(`\nNot in manifest (${stats.notInManifest.length}):`);
    stats.notInManifest.forEach(id => console.log(`  - ${id}`));
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
};

main();
