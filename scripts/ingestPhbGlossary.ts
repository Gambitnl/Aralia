/**
 * Script to ingest various 2024 PHB content from 5eTools vendor repo into the Aralia glossary.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildResolvableIdSet,
  makeEmitter,
  repairMarkdownLinks,
  repairSeeAlso,
} from './glossary/lib/termLinks';

// This function is exported for testing purposes.
export function buildItemMetadata(item: any, typeMap: Record<string, string>): any {
    const itemMetadata: any = {};

    if (item.type) {
        const typeAbbr = item.type.split('|')[0];
        const typeName = typeMap[typeAbbr] || typeAbbr;
        itemMetadata.type = typeName;
    } else {
        if (item.wondrous) {
            itemMetadata.type = 'Wondrous Item';
        } else if (item.potion) {
            itemMetadata.type = 'Potion';
        } else if (item.ring) {
            itemMetadata.type = 'Ring';
        } else if (item.rod) {
            itemMetadata.type = 'Rod';
        } else if (item.scroll) {
            itemMetadata.type = 'Scroll';
        } else if (item.staff) {
            itemMetadata.type = 'Staff';
        } else if (item.wand) {
            itemMetadata.type = 'Wand';
        }
    }
    if (item.rarity) itemMetadata.rarity = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
    if (item.tier) itemMetadata.tier = item.tier.charAt(0).toUpperCase() + item.tier.slice(1);
    if (item.reqAttune) {
        if (item.reqAttune === true) itemMetadata.reqAttune = 'Required';
        else itemMetadata.reqAttune = `Required ${item.reqAttune}`;
    }
    if (item.value) itemMetadata.cost = item.value / 100;
    if (item.weight) itemMetadata.weight = item.weight;
    if (item.dmg1) itemMetadata.damage = `${item.dmg1} ${item.dmgType || ''}`.trim();
    if (item.property && item.property.length > 0) itemMetadata.properties = item.property;
    if (item.ac) itemMetadata.ac = item.ac;

    if (Object.keys(itemMetadata).length === 0) {
        return null;
    }

    return itemMetadata;
}


const VENDOR_DATA_DIR = path.join(process.cwd(), 'vendor/5etools-src/data');
const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');

/**
 * Write a file, retrying briefly on transient Windows file-lock errors
 * (EBUSY / EPERM / UNKNOWN) that occur when a virus scanner or indexer briefly
 * holds the handle. Ingest writes 1000+ small files, so a stray lock would
 * otherwise abort the whole build gate.
 */
function writeFileSyncRetry(file: string, data: string): void {
  const transient = new Set(['EBUSY', 'EPERM', 'UNKNOWN', 'EACCES']);
  for (let attempt = 0; ; attempt++) {
    try {
      fs.writeFileSync(file, data, 'utf8');
      return;
    } catch (err: any) {
      if (attempt >= 5 || !transient.has(err?.code)) throw err;
      const until = Date.now() + 50 * (attempt + 1);
      while (Date.now() < until) {
        /* brief synchronous backoff */
      }
    }
  }
}

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
    .replace(/\{@dice\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
    .replace(/\{@damage\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
    .replace(/\{@hit\s+([^|}]+)(?:\|[^}]+)?\}/gi, '+$1')
    .replace(/\{@chance\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1%')
    .replace(/\{@recharge\s+([^|}]+)(?:\|[^}]+)?\}/gi, '(Recharge $1-6)')
    .replace(/\{@recharge\}/gi, '(Recharge 6)')
    .replace(/\{@(action|variantrule|condition|disease|sense|skill|feat|background|item|spell|language)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]+))?\}/gi, (_, tag, target, source, display) => {
      const linkText = display || target;
      const termId = slugify(target);
      return `[[${termId}|${linkText}]]`;
    })
    .replace(/\{@\w+\s+([^|}]+)(?:\|[^}]+)?\}/g, '$1') // other tags -> content
    .replace(/\{@\w+\}/g, '')                     // {@tag} -> empty
    // word|source -> word, but never inside [[id|display]] links: this regex
    // used to eat the link pipe too, corrupting [[hit_points|Hit Points]]
    // into [[hit_points Points]] across the whole glossary.
    .split(/(\[\[[^\]]*\]\])/g)
    .map((seg) => (seg.startsWith('[[') ? seg : seg.replace(/(\w+)\|\w+/g, '$1')))
    .join('')
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
        // Block-level content that can't live inside a bullet (e.g. a nested
        // markdown table) is deferred and emitted after the list, so it keeps
        // its own line structure instead of being flattened into one line.
        const deferredBlocks: string[] = [];
        for (const item of items) {
          if (typeof item === 'string') {
            markdown += `- ${stripMarkup(item)}\n`;
          } else if (item.type === 'item') {
            const label = stripMarkup(item.name || '').replace(/:+$/, '');
            const labelPrefix = label ? `**${label}:** ` : '';
            if (item.entry) {
              markdown += `- ${labelPrefix}${stripMarkup(item.entry)}\n`;
            } else {
              // item.entries may hold block content (tables, sub-lists). Split
              // inline lead text (rendered onto the bullet) from block content
              // (a markdown table), which is deferred to keep its newlines.
              const rendered = entriesToMarkdown(item.entries || []).trim();
              const hasBlock = /(^|\n)\s*\|/.test(rendered);
              if (hasBlock) {
                const lines = rendered.split('\n');
                const firstTable = lines.findIndex((l) => /^\s*\|/.test(l));
                const lead = lines.slice(0, firstTable).join(' ').trim();
                const block = lines.slice(firstTable).join('\n').trim();
                markdown += `- ${labelPrefix}${stripMarkup(lead)}\n`;
                if (block) deferredBlocks.push(block);
              } else {
                markdown += `- ${labelPrefix}${stripMarkup(rendered)}\n`;
              }
            }
          }
        }
        markdown += '\n';
        for (const block of deferredBlocks) markdown += `${block}\n\n`;
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
    { file: 'items-base.json', key: 'baseitem', category: 'Equipment', outSubDir: 'equipment' },
    { file: 'items-base.json', key: 'itemProperty', category: 'Rules Glossary', outSubDir: 'rules' },
    { file: 'items-base.json', key: 'itemMastery', category: 'Rules Glossary', outSubDir: 'rules' },
  ];

  let count = 0;
  // Records every entry file this ingest generates, so downstream codemods can
  // avoid editing generated files (their fixes belong in this script instead).
  const generatedPaths: string[] = [];

  // Build Item Type Map
  const typeMap: Record<string, string> = {};
  try {
      const baseItemsData = JSON.parse(fs.readFileSync(path.join(VENDOR_DATA_DIR, 'items-base.json'), 'utf8'));
      for (const t of baseItemsData.itemType || []) {
          typeMap[t.abbreviation] = t.name;
      }
  } catch { /* Optional item type metadata is allowed to be unavailable during glossary ingest. */ }

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
      if (item.source === 'XPHB' || item.source === 'XDMG' || item.basicRules2024 === true) {
        const name = item.name || item.abbreviation || item.id || item.type;
        if (!name) continue;
        const id = slugify(name);
        
        let mdBody = '';
        const itemTags = [`source:xphb`, source.key];
        
        let itemMetadata: any = null;

        // --- GAP RESOLUTION: Parse Item Metadata ---
        if (source.category === 'Equipment') {
            itemMetadata = buildItemMetadata(item, typeMap);
            if (itemMetadata?.type) {
                // Add itemType tag if the metadata build process found a type.
                itemTags.push(`itemType:${itemMetadata.type}`);
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

        // Parse seeAlso from markdown links [[termId|display]]
        const seeAlsoSet = new Set<string>();
        const linkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
        let match;
        while ((match = linkRegex.exec(mdBody)) !== null) {
            if (match[1] !== id) {
                seeAlsoSet.add(match[1]);
            }
        }
        
        const glossaryEntry: any = {
          id,
          title: name,
          category: source.category,
          tags: itemTags,
          excerpt,
          aliases: [],
          seeAlso: Array.from(seeAlsoSet),
          filePath: `/data/glossary/entries/${source.outSubDir}/${id}.json`,
          markdown: `# ${name}\n\n${mdBody}`
        };
        
        if (itemMetadata) {
            glossaryEntry.itemMetadata = itemMetadata;
        }

        const outPath = path.join(outDir, `${id}.json`);
        
        // Remove existing duplicates
        const existingFiles = findFilesWithBaseName(ENTRIES_BASE, `${id}.json`);
        for (const f of existingFiles) {
          if (f !== outPath) {
            fs.unlinkSync(f);
          }
        }

        writeFileSyncRetry(outPath, JSON.stringify(glossaryEntry, null, 2));
        generatedPaths.push(path.relative(process.cwd(), outPath).replace(/\\/g, '/'));
        count++;
      }
    }
  }

  const manifestPath = path.join(ENTRIES_BASE, '.generated-manifest.json');
  writeFileSyncRetry(manifestPath, JSON.stringify(generatedPaths.sort(), null, 2));

  // Second pass: now that every entry file (generated + checked-in) exists on
  // disk, rewrite the generated files' term links and seeAlso arrays so they
  // only reference targets that actually resolve. Underscore spell ids become
  // their real hyphenated form; echo-corrupted ids are repaired; dead links
  // are unlinked to plain text. This keeps generated content compile-clean
  // without hand-editing generated files (which this ingest would overwrite).
  const emitter = makeEmitter(buildResolvableIdSet(process.cwd()));
  let repaired = 0;
  for (const rel of generatedPaths) {
    const file = path.join(process.cwd(), rel);
    let json: any;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    let dirty = false;
    if (typeof json.markdown === 'string') {
      const fixed = repairMarkdownLinks(json.markdown, emitter);
      if (fixed !== json.markdown) {
        json.markdown = fixed;
        dirty = true;
      }
    }
    if (Array.isArray(json.seeAlso)) {
      const fixed = repairSeeAlso(json.seeAlso, emitter);
      if (JSON.stringify(fixed) !== JSON.stringify(json.seeAlso)) {
        json.seeAlso = fixed;
        dirty = true;
      }
    }
    if (dirty) {
      writeFileSyncRetry(file, JSON.stringify(json, null, 2));
      repaired++;
    }
  }
  console.log(`Repaired links/seeAlso in ${repaired} generated entries.`);

  console.log(`Successfully ingested ${count} PHB 2024 glossary elements.`);
}

processSourceFiles();
