/**
 * GENERATED FILE
 * Script to ingest 2024 PHB rules from 5eTools vendor repo into the Aralia glossary.
 */

import * as fs from 'fs';
import * as path from 'path';

const VENDOR_DATA_DIR = path.join(process.cwd(), 'vendor/5etools-src/data');
const OUT_DIR = path.join(process.cwd(), 'public/data/glossary/entries/rules');

// Simple markup stripper that converts specific rule tags into Glossary links
function stripMarkup(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{@actSave\s+(\w+)[^}]*\}/gi, (_, ability) => `${ability} saving throw`)
    .replace(/\{@dc\s+(\d+)\}/gi, 'DC $1')
    .replace(/\{@actSaveFail\}/g, 'On a failed save,')
    .replace(/\{@actSaveSuccess\}/g, 'On a success,')
    .replace(/\{@actSaveSuccessOrFail\}/g, 'Regardless of the save,')
    .replace(/\{@(action|variantrule|condition|disease|sense|skill)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]+))?\}/gi, (_, tag, target, source, display) => {
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

// Convert 5eTools entry blocks to Markdown
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

// Standardize filename
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function processSourceFiles() {
  const sources = [
    { file: 'variantrules.json', key: 'variantrule' },
    { file: 'actions.json', key: 'action' },
    { file: 'conditionsdiseases.json', key: 'condition' },
    { file: 'conditionsdiseases.json', key: 'disease' },
  ];

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Pre-index existing files to find duplicates
  const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');
  
  // Custom simple deep search for files
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

  let count = 0;

  for (const source of sources) {
    const fullPath = path.join(VENDOR_DATA_DIR, source.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Source file not found: ${fullPath}`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const items = rawData[source.key] || [];

    for (const item of items) {
      if (item.source === 'XPHB' || item.basicRules2024 === true) {
        const id = slugify(item.name);
        const mdBody = entriesToMarkdown(item.entries).trim();
        const excerpt = stripMarkup(item.entries?.[0] || '').substring(0, 150) + '...';

        const glossaryEntry = {
          id,
          title: item.name,
          category: "Rules Glossary",
          tags: [`source:xphb`, source.key],
          excerpt,
          aliases: [],
          seeAlso: [],
          filePath: `/data/glossary/entries/rules/${id}.json`,
          markdown: `# ${item.name}\n\n${mdBody}`
        };

        const outPath = path.join(OUT_DIR, `${id}.json`);
        
        // Remove existing duplicates with the same ID
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

  console.log(`Successfully ingested ${count} 2024 PHB rules into the glossary.`);
}

processSourceFiles();
