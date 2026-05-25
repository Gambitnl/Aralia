/**
 * Script to ingest various 2024 PHB content from 5eTools vendor repo into the Aralia glossary.
 */

import * as fs from 'fs';
import * as path from 'path';

const VENDOR_DATA_DIR = path.join(process.cwd(), 'vendor/5etools-src/data');
const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');

function slugify(name: string): string {
  if (typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Simple markup stripper that converts specific rule tags into Glossary links
function stripMarkup(text: any): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\{@actSave\s+(\w+)[^}]*\}/gi, (_, ability) => `${ability} saving throw`)
    .replace(/\{@dc\s+(\d+)\}/gi, 'DC $1')
    .replace(/\{@actSaveFail\}/g, 'On a failed save,')
    .replace(/\{@actSaveSuccess\}/g, 'On a success,')
    .replace(/\{@actSaveSuccessOrFail\}/g, 'Regardless of the save,')
    .replace(/\{@(action|variantrule|condition|disease|sense|skill|feat|background|item|spell|language)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]+))?\}/gi, (_, tag, target, source, display) => {
      const linkText = display || target;
      const termId = slugify(target);
      return `[[${termId}|${linkText}]]`;
    })
    .replace(/\{@\w+\s+([^|}]+)(?:\|[^}]+)?\}/g, '$1') // other tags -> content
    .replace(/\{@\w+\}/g, '')                     // {@tag} -> empty
    .replace(/(\w+)\|\w+/g, '$1')                 // word|source -> word
    .replace(/\s+/g, ' ')
    .trim();
}

function entriesToMarkdown(entries: any[], depth = 1): string {
  if (!entries || !Array.isArray(entries)) return '';
  let markdown = '';

  for (const entry of entries) {
    if (typeof entry === 'string') {
      markdown += `${stripMarkup(entry)}\n\n`;
    } else if (typeof entry === 'object' && entry !== null) {
      if (entry.type === 'list') {
        const items = entry.items || [];
        for (const item of items) {
          if (typeof item === 'string') {
            markdown += `- ${stripMarkup(item)}\n`;
          } else if (item.type === 'item') {
            markdown += `- **${stripMarkup(item.name || '')}:** ${stripMarkup(item.entry || entriesToMarkdown(item.entries || []))}\n`;
          }
        }
        markdown += '\n';
      } else if (entry.type === 'entries') {
        const headingStr = '#'.repeat(Math.min(depth + 1, 6));
        if (entry.name) markdown += `${headingStr} ${stripMarkup(entry.name)}\n\n`;
        markdown += entriesToMarkdown(entry.entries, depth + 1);
      } else if (entry.type === 'table') {
        if (entry.caption) markdown += `**${stripMarkup(entry.caption)}**\n\n`;
        if (entry.colLabels) {
          markdown += `| ${entry.colLabels.map((l: string) => stripMarkup(l)).join(' | ')} |\n`;
          markdown += `| ${entry.colLabels.map(() => '---').join(' | ')} |\n`;
        }
        if (entry.rows) {
          for (const row of entry.rows) {
            markdown += `| ${row.map((cell: any) => typeof cell === 'object' ? stripMarkup(cell.roll?.exact?.toString() || '') : stripMarkup(String(cell))).join(' | ')} |\n`;
          }
        }
        markdown += '\n';
      } else if (entry.type === 'quote') {
        if (entry.entries) {
          markdown += `> ${entriesToMarkdown(entry.entries).trim().replace(/\n/g, '\n> ')}\n`;
        }
        if (entry.by) markdown += `> — ${stripMarkup(entry.by)}\n`;
        markdown += '\n';
      } else if (entry.entries) {
        markdown += entriesToMarkdown(entry.entries, depth);
      }
    }
  }

  return markdown;
}

function findFilesWithBaseName(dir: string, baseName: string, results: string[] = []) {
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      findFilesWithBaseName(path.join(dir, item.name), baseName, results);
    } else if (item.name === baseName) {
      results.push(path.join(dir, item.name));
    }
  }
  return results;
}

function processSourceFiles() {
  const sources = [
    { file: 'skills.json', key: 'skill', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'senses.json', key: 'sense', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'languages.json', key: 'language', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'trapshazards.json', key: 'hazard', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'optionalfeatures.json', key: 'optionalfeature', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'feats.json', key: 'feat', category: 'Feats', outSubDir: 'feats' },
    { file: 'backgrounds.json', key: 'background', category: 'Character Backgrounds', outSubDir: 'backgrounds' },
    { file: 'items.json', key: 'item', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items.json', key: 'itemGroup', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items-base.json', key: 'baseitem', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items-base.json', key: 'itemProperty', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items-base.json', key: 'itemType', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items-base.json', key: 'itemMastery', category: 'Equipment', outSubDir: 'equipment' },
  ];

  let count = 0;

  for (const source of sources) {
    const fullPath = path.join(VENDOR_DATA_DIR, source.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Source file not found: ${fullPath}`);
      continue;
    }

    const outDir = path.join(ENTRIES_BASE, source.outSubDir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const rawData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const items = rawData[source.key] || [];

    for (const item of items) {
      if (item.source === 'XPHB' || item.basicRules2024 === true) {
        const name = item.name || item.abbreviation || item.id || item.type;
        if (!name) continue;
        const id = slugify(name);
        
        let mdBody = '';
        
        // --- GAP RESOLUTION: Parse Item Metadata ---
        if (source.category === 'Equipment') {
            const meta = [];
            if (item.type) meta.push(`- **Type**: ${item.type}`);
            if (item.value) meta.push(`- **Cost**: ${item.value / 100} gp`); // value is typically in cp
            if (item.weight) meta.push(`- **Weight**: ${item.weight} lb.`);
            if (item.dmg1) meta.push(`- **Damage**: ${item.dmg1} ${item.dmgType || ''}`);
            if (item.property && item.property.length > 0) meta.push(`- **Properties**: ${item.property.join(', ')}`);
            if (item.ac) meta.push(`- **Armor Class**: ${item.ac}`);
            
            if (meta.length > 0) {
                mdBody += meta.join('\n') + '\n\n';
            }
        }
        
        mdBody += entriesToMarkdown(item.entries || []).trim();
        // If there is no entries array (like for simple items), synthesize some basic markdown
        if (!mdBody && item.type) {
            mdBody = `*${stripMarkup(String(item.type))}*\n`;
        }
        
        // Safely extract a text excerpt from the generated markdown body, stripped of markdown chars
        const plainText = mdBody.replace(/[#*[\]`>]/g, '').replace(/\n+/g, ' ').trim();
        const excerpt = plainText ? plainText.substring(0, 150) + '...' : 'No description available.';

        const glossaryEntry = {
          id,
          title: name,
          category: source.category,
          tags: [`source:xphb`, source.key],
          excerpt,
          aliases: [],
          seeAlso: [],
          filePath: `/data/glossary/entries/${source.outSubDir}/${id}.json`,
          markdown: `# ${name}\n\n${mdBody}`
        };

        const outPath = path.join(outDir, `${id}.json`);
        
        // Remove existing duplicates
        const existingFiles = findFilesWithBaseName(ENTRIES_BASE, `${id}.json`);
        for (const f of existingFiles) {
          if (f !== outPath) {
            fs.unlinkSync(f);
          }
        }

        fs.writeFileSync(outPath, JSON.stringify(glossaryEntry, null, 2), 'utf8');
        count++;
      }
    }
  }

  console.log(`Successfully ingested ${count} PHB 2024 glossary elements.`);
}

processSourceFiles();
