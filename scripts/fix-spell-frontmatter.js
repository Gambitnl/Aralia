// scripts/fix-spell-frontmatter.js
// One-time script to fix broken spell frontmatter

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import fm from 'front-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENTRY_BASE_DIR = path.join(__dirname, '../public/data/glossary/entries');
const files = glob.sync('spells/**/*.md', { cwd: ENTRY_BASE_DIR });

let fixed = 0;
files.forEach(relPath => {
  const fullPath = path.join(ENTRY_BASE_DIR, relPath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const { attributes, body } = fm(raw);

  const filename = path.basename(relPath, '.md');
  const expectedFilePath = '/data/glossary/entries/' + relPath.split(path.sep).join('/');

  let needsFix = false;

  // Fix missing/incorrect id
  if (!attributes.id || attributes.id !== filename) {
    attributes.id = filename;
    needsFix = true;
  }

  // Fix missing category
  if (!attributes.category) {
    attributes.category = 'Spells';
    needsFix = true;
  }

  // Fix missing/incorrect filePath
  if (!attributes.filePath || attributes.filePath !== expectedFilePath) {
    attributes.filePath = expectedFilePath;
    needsFix = true;
  }

  // Fix missing excerpt
  if (!attributes.excerpt) {
    attributes.excerpt = attributes.title ? attributes.title + ' spell.' : 'Spell entry.';
    needsFix = true;
  }

  // Fix missing seeAlso
  if (!attributes.seeAlso) {
    attributes.seeAlso = [];
    needsFix = true;
  }

  if (needsFix) {
    // Derive title from filename if missing
    const title = attributes.title || filename.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Rebuild frontmatter
    const newFrontmatter = [
      '---',
      `id: "${attributes.id}"`,
      `title: "${title}"`,
      `category: "${attributes.category}"`,
      `tags: ${JSON.stringify(attributes.tags || ['level 0'])}`,
      `excerpt: "${(attributes.excerpt || '').replace(/"/g, '\\"')}"`,
      `seeAlso: ${JSON.stringify(attributes.seeAlso)}`,
      `filePath: "${attributes.filePath}"`,
      '---'
    ].join('\n');

    fs.writeFileSync(fullPath, newFrontmatter + '\n' + body.trim() + '\n');
    console.log('Fixed:', relPath);
    fixed++;
  }
});

console.log('Total fixed:', fixed);
