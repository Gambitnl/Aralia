#!/usr/bin/env node
/**
 * Compresses verbose glossary link spans to shorthand syntax.
 *
 * This script transforms:
 *   <span data-term-id="rage" class="glossary-term-link-from-markdown">Rage</span>
 * Into:
 *   [[rage|Rage]] or [[rage]] if the display text matches the id
 *
 * Usage:
 *   node scripts/compressGlossaryLinks.js                    # Dry run (shows what would change)
 *   node scripts/compressGlossaryLinks.js --write            # Actually modify files
 *   node scripts/compressGlossaryLinks.js --file path/to/file.json  # Single file
 *   node scripts/compressGlossaryLinks.js --validate         # Check for broken links (terms that don't exist)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLOSSARY_DIR = path.join(__dirname, '..', 'public', 'data', 'glossary', 'entries');
const INDEX_DIR = path.join(__dirname, '..', 'public', 'data', 'glossary', 'index');

// Pattern to match verbose glossary spans
const VERBOSE_SPAN_PATTERN = /<span\s+data-term-id="([^"]+)"\s+class="glossary-term-link-from-markdown">([^<]+)<\/span>/g;

/**
 * Compress a single glossary span to shorthand
 */
function compressSpan(match, termId, displayText) {
  // Check if display text is just the title-cased version of termId
  const autoDisplay = termId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (displayText === autoDisplay) {
    // Can use the simpler [[termId]] form
    return `[[${termId}]]`;
  } else {
    // Need explicit display text
    return `[[${termId}|${displayText}]]`;
  }
}

/**
 * Compress all glossary links in a string
 */
function compressContent(content) {
  return content.replace(VERBOSE_SPAN_PATTERN, compressSpan);
}

/**
 * Process a single JSON file
 */
function processFile(filePath, write = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    if (!json.markdown) {
      return { file: filePath, skipped: true, reason: 'no markdown field' };
    }

    const original = json.markdown;
    const compressed = compressContent(original);

    if (original === compressed) {
      return { file: filePath, skipped: true, reason: 'no changes needed' };
    }

    // Count compressions
    const originalMatches = original.match(VERBOSE_SPAN_PATTERN) || [];
    const compressedMatches = compressed.match(VERBOSE_SPAN_PATTERN) || [];
    const linksCompressed = originalMatches.length - compressedMatches.length;
    const charsSaved = original.length - compressed.length;

    if (write) {
      json.markdown = compressed;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    }

    return {
      file: filePath,
      linksCompressed,
      charsSaved,
      written: write
    };
  } catch (err) {
    return { file: filePath, error: err.message };
  }
}

/**
 * Recursively find all JSON files
 */
function findJsonFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findJsonFiles(fullPath, files);
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load all valid term IDs from the glossary index
 */
function loadValidTermIds() {
  const ids = new Set();

  function processIndexFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      if (data.index_files) {
        // It's a meta-index pointing to other index files
        for (const nestedPath of data.index_files) {
          const fullPath = path.join(__dirname, '..', 'public', nestedPath);
          processIndexFile(fullPath);
        }
      } else if (Array.isArray(data)) {
        // It's an array of entries
        const addIds = (entries) => {
          for (const entry of entries) {
            ids.add(entry.id);
            if (entry.aliases) {
              entry.aliases.forEach(alias => ids.add(alias.toLowerCase().replace(/\s+/g, '_')));
            }
            if (entry.subEntries) {
              addIds(entry.subEntries);
            }
          }
        };
        addIds(data);
      }
    } catch (err) {
      console.warn(`Warning: Could not load index file ${filePath}: ${err.message}`);
    }
  }

  const mainIndex = path.join(INDEX_DIR, 'main.json');
  processIndexFile(mainIndex);

  return ids;
}

/**
 * Find all term IDs referenced in a markdown string
 */
function findReferencedTermIds(markdown) {
  const termIds = [];
  const pattern = /<span\s+data-term-id="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    termIds.push(match[1]);
  }
  return termIds;
}

/**
 * Validate a file for broken links
 */
function validateFile(filePath, validTermIds) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    if (!json.markdown) {
      return { file: filePath, skipped: true };
    }

    const referenced = findReferencedTermIds(json.markdown);
    const broken = referenced.filter(id => !validTermIds.has(id));

    if (broken.length === 0) {
      return { file: filePath, valid: true };
    }

    return {
      file: filePath,
      brokenLinks: broken,
      totalLinks: referenced.length
    };
  } catch (err) {
    return { file: filePath, error: err.message };
  }
}

// Main execution
const args = process.argv.slice(2);
const writeMode = args.includes('--write');
const validateMode = args.includes('--validate');
const fileIndex = args.indexOf('--file');
const singleFile = fileIndex !== -1 ? args[fileIndex + 1] : null;

if (validateMode) {
  console.log('Glossary Link Validator');
  console.log('=======================');
  console.log('Checking for broken links (terms that don\'t exist in the glossary)...\n');

  const validTermIds = loadValidTermIds();
  console.log(`Loaded ${validTermIds.size} valid term IDs from glossary index\n`);

  const files = singleFile ? [path.resolve(singleFile)] : findJsonFiles(GLOSSARY_DIR);
  let brokenCount = 0;
  let filesWithBroken = 0;

  for (const file of files) {
    const result = validateFile(file, validTermIds);

    if (result.brokenLinks) {
      filesWithBroken++;
      brokenCount += result.brokenLinks.length;
      const relPath = path.relative(GLOSSARY_DIR, result.file);
      console.log(`  ✗ ${relPath}:`);
      result.brokenLinks.forEach(id => console.log(`      - ${id}`));
    }
  }

  console.log('\nSummary:');
  console.log(`  Files checked: ${files.length}`);
  console.log(`  Files with broken links: ${filesWithBroken}`);
  console.log(`  Total broken links: ${brokenCount}`);

  if (brokenCount > 0) {
    console.log('\nThese term IDs are referenced but don\'t exist in the glossary index.');
    process.exit(1);
  } else {
    console.log('\nAll links are valid!');
  }

  process.exit(0);
}

console.log('Glossary Link Compressor');
console.log('========================');
console.log(`Mode: ${writeMode ? 'WRITE (modifying files)' : 'DRY RUN (preview only)'}`);
console.log('');

let files;
if (singleFile) {
  files = [path.resolve(singleFile)];
} else {
  files = findJsonFiles(GLOSSARY_DIR);
}

console.log(`Found ${files.length} JSON files to process\n`);

let totalLinks = 0;
let totalChars = 0;
let filesModified = 0;

for (const file of files) {
  const result = processFile(file, writeMode);

  if (result.error) {
    console.log(`  ERROR: ${path.relative(GLOSSARY_DIR, result.file)} - ${result.error}`);
  } else if (result.skipped) {
    // Skip silently for dry run noise reduction
  } else {
    const relPath = path.relative(GLOSSARY_DIR, result.file);
    console.log(`  ${writeMode ? '✓' : '→'} ${relPath}: ${result.linksCompressed} links, ${result.charsSaved} chars saved`);
    totalLinks += result.linksCompressed;
    totalChars += result.charsSaved;
    filesModified++;
  }
}

console.log('');
console.log('Summary:');
console.log(`  Files to modify: ${filesModified}`);
console.log(`  Total links to compress: ${totalLinks}`);
console.log(`  Total characters saved: ${totalChars}`);

if (!writeMode && filesModified > 0) {
  console.log('\nRun with --write to apply changes.');
}
