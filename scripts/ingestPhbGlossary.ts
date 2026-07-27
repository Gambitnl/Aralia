/**
 * This script turns supported 2024 PHB records from the vendored 5eTools data
 * into Aralia glossary entries.
 *
 * The item-metadata boundary is intentionally defensive because the vendor JSON
 * is external input: valid 5eTools fields become the existing glossary metadata
 * shape, while malformed or unknown values are ignored instead of leaking into
 * generated UI data. The rest of the file owns markdown conversion, entry-file
 * emission, and the final link-repair pass for those generated entries.
 *
 * Called by: the PHB glossary ingest command and its focused Vitest coverage.
 * Depends on: vendored 5eTools JSON, GlossaryEntry's shared UI contract, and
 * the glossary term-link repair helpers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import type { GlossaryEntry } from '../src/types/ui';
import {
  buildResolvableIdSet,
  makeEmitter,
  repairMarkdownLinks,
  repairSeeAlso,
} from './glossary/lib/termLinks';

// ============================================================================
// Typed 5eTools Item Metadata Boundary
// ============================================================================
// Only fields used by the glossary transform are modeled here. Every value is
// unknown until checked because JSON can contain malformed data, while extra
// 5eTools fields remain structurally compatible and pass through unused.
// ============================================================================

type ItemMetadata = NonNullable<GlossaryEntry['itemMetadata']>;

interface Raw5eToolsItem {
    type?: unknown;
    wondrous?: unknown;
    potion?: unknown;
    ring?: unknown;
    rod?: unknown;
    scroll?: unknown;
    staff?: unknown;
    wand?: unknown;
    rarity?: unknown;
    tier?: unknown;
    reqAttune?: unknown;
    value?: unknown;
    weight?: unknown;
    dmg1?: unknown;
    dmgType?: unknown;
    property?: unknown;
    ac?: unknown;
}

interface Raw5eToolsPropertyNote {
    uid?: unknown;
    note?: unknown;
}

// Vendor records must be plain objects. Arrays, null, and primitive values do
// not describe an item, so they cannot produce glossary metadata.
function isRaw5eToolsItem(value: unknown): value is Raw5eToolsItem {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Rarity and tier labels arrive lowercase in normal 5eTools data. Capitalizing
// only real, non-empty strings preserves that display while rejecting bad JSON.
function capitalizeLabel(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

// Numeric item facts must be finite and non-zero. Zero was historically omitted,
// and rejecting NaN or infinity prevents values that JSON cannot faithfully store.
function isUsefulNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

// A few 5eTools weapons mix normal property codes with a conditional property
// object such as `{ uid: '2H|XPHB', note: 'unless mounted' }`. The glossary UI
// accepts display strings, so the boundary keeps both facts in one readable label.
function buildItemProperties(value: unknown): string[] | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined;

    const properties: string[] = [];
    for (const entry of value) {
        if (typeof entry === 'string' && entry.length > 0) {
            properties.push(entry);
            continue;
        }

        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined;
        const propertyNote = entry as Raw5eToolsPropertyNote;
        if (typeof propertyNote.uid !== 'string' || propertyNote.uid.length === 0) return undefined;

        const note = typeof propertyNote.note === 'string' && propertyNote.note.length > 0
            ? ` (${propertyNote.note})`
            : '';
        properties.push(`${propertyNote.uid}${note}`);
    }

    return properties;
}

// This function is exported so focused tests can protect the ingest boundary
// without running the file-emission pipeline.
export function buildItemMetadata(
    item: unknown,
    typeMap: Readonly<Record<string, string>>,
): ItemMetadata | null {
    if (!isRaw5eToolsItem(item)) return null;

    const itemMetadata: ItemMetadata = {};

    // Prefer the normal 5eTools type abbreviation and resolve it through the
    // vendor type table. Unknown abbreviations retain their original code.
    if (typeof item.type === 'string' && item.type.length > 0) {
        const typeAbbr = item.type.split('|')[0];
        const typeName = typeMap[typeAbbr] || typeAbbr;
        itemMetadata.type = typeName;
    } else {
        // Magic items sometimes omit the general type field and instead carry
        // one of these boolean category flags. Their established priority order
        // is preserved so ambiguous raw records still resolve exactly as before.
        if (item.wondrous === true) {
            itemMetadata.type = 'Wondrous Item';
        } else if (item.potion === true) {
            itemMetadata.type = 'Potion';
        } else if (item.ring === true) {
            itemMetadata.type = 'Ring';
        } else if (item.rod === true) {
            itemMetadata.type = 'Rod';
        } else if (item.scroll === true) {
            itemMetadata.type = 'Scroll';
        } else if (item.staff === true) {
            itemMetadata.type = 'Staff';
        } else if (item.wand === true) {
            itemMetadata.type = 'Wand';
        }
    }

    // Preserve the title-style labels used by item stat blocks, but only when
    // the raw values are valid strings.
    const rarity = capitalizeLabel(item.rarity);
    const tier = capitalizeLabel(item.tier);
    if (rarity) itemMetadata.rarity = rarity;
    if (tier) itemMetadata.tier = tier;

    // Attunement is either a simple requirement or a vendor-supplied qualifier
    // such as "by a spellcaster". Other raw shapes are not meaningful here.
    if (item.reqAttune === true || (typeof item.reqAttune === 'string' && item.reqAttune.length > 0)) {
        if (item.reqAttune === true) itemMetadata.reqAttune = 'Required';
        else itemMetadata.reqAttune = `Required ${item.reqAttune}`;
    }

    // 5eTools stores value in copper pieces; glossary stat blocks display gold.
    // Other numeric facts retain their original units and established formatting.
    if (isUsefulNumber(item.value)) itemMetadata.cost = item.value / 100;
    if (isUsefulNumber(item.weight)) itemMetadata.weight = item.weight;
    if (typeof item.dmg1 === 'string' && item.dmg1.length > 0) {
        const damageType = typeof item.dmgType === 'string' ? item.dmgType : '';
        itemMetadata.damage = `${item.dmg1} ${damageType}`.trim();
    }
    const properties = buildItemProperties(item.property);
    if (properties) itemMetadata.properties = properties;
    if (isUsefulNumber(item.ac)) itemMetadata.ac = item.ac;

    // Records containing only unrelated or malformed fields should not gain an
    // empty metadata object; downstream consumers use absence as the signal to skip it.
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
        
        let itemMetadata: ItemMetadata | null = null;

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

// ============================================================================
// Direct-Run Entrypoint
// ============================================================================
// Running this file through `npx tsx scripts/ingestPhbGlossary.ts` still emits
// the complete glossary dataset. Importers such as Vitest need only the typed
// metadata builder, so they must not rewrite generated files as a side effect.
// ============================================================================

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  processSourceFiles();
}
