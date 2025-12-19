/**
 * Migration script: Convert glossary entry files from Markdown (+ YAML frontmatter) to JSON.
 *
 * - Input:  public/data/glossary/entries/**\/*.md
 * - Output: public/data/glossary/entries/**\/*.json
 * - Deletes the original .md files after successful conversion.
 *
 * Notes:
 * - Spell entries are ignored; spells are manifest-driven in the glossary now.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import fm from 'front-matter';

type Frontmatter = {
  id?: string;
  title?: string;
  category?: string;
  tags?: string[];
  excerpt?: string;
  aliases?: string[];
  seeAlso?: string[];
  filePath?: string;
};

type EntryJson = {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  excerpt?: string;
  aliases?: string[];
  seeAlso?: string[];
  filePath: string;
  markdown: string;
};

const ENTRY_BASE_DIR = path.join(process.cwd(), 'public', 'data', 'glossary', 'entries');

const categoryFromRelPath = (relPath: string): string => {
  const top = relPath.split(/[\\/]/)[0];
  const map: Record<string, string> = {
    rules: 'Rules Glossary',
    classes: 'Character Classes',
    races: 'Character Races',
    magic_items: 'Magic Items',
    dev: 'Developer',
  };
  return map[top] || '';
};

const titleFromId = (id: string) =>
  id
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
};

const main = () => {
  const files = glob.sync('**/*.md', {
    cwd: ENTRY_BASE_DIR,
    ignore: ['spells/**'],
  });

  console.log(`[Glossary MD->JSON] Converting ${files.length} entries...`);

  let converted = 0;
  const skipped: string[] = [];

  for (const relPath of files) {
    const fullPath = path.join(ENTRY_BASE_DIR, relPath);
    const raw = fs.readFileSync(fullPath, 'utf-8');

    const parsed = fm<Frontmatter>(raw.replace(/^\uFEFF/, '').trimStart());
    const attrs = parsed.attributes || {};

    const fileNameWithoutExt = path.basename(relPath, '.md');
    const outRelPath = relPath.replace(/\.md$/i, '.json');
    const outFullPath = path.join(ENTRY_BASE_DIR, outRelPath);
    const webPath = `/data/glossary/entries/${outRelPath.replace(/\\/g, '/')}`;

    const id = attrs.id ? String(attrs.id) : fileNameWithoutExt;
    const category = attrs.category ? String(attrs.category) : categoryFromRelPath(relPath);
    if (!category) {
      skipped.push(relPath);
      continue;
    }

    const title = attrs.title ? String(attrs.title) : titleFromId(id);

    const entryJson: EntryJson = {
      id,
      title,
      category,
      tags: normalizeStringArray(attrs.tags),
      excerpt: attrs.excerpt ? String(attrs.excerpt) : 'No excerpt available.',
      aliases: normalizeStringArray(attrs.aliases),
      seeAlso: normalizeStringArray(attrs.seeAlso),
      filePath: webPath,
      markdown: (parsed.body || '').trimStart(),
    };

    fs.mkdirSync(path.dirname(outFullPath), { recursive: true });
    fs.writeFileSync(outFullPath, JSON.stringify(entryJson, null, 2));
    fs.unlinkSync(fullPath);
    converted++;
  }

  console.log(`[Glossary MD->JSON] Converted: ${converted}`);
  if (skipped.length > 0) {
    console.warn(`[Glossary MD->JSON] Skipped (missing category): ${skipped.length}`);
    skipped.slice(0, 10).forEach((p) => console.warn(`  - ${p}`));
    if (skipped.length > 10) console.warn(`  ...and ${skipped.length - 10} more`);
  }
};

main();
