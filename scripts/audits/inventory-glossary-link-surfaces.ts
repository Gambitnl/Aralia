#!/usr/bin/env tsx
/**
 * Inventory script for glossary redirect surfaces.
 *
 * Scans component sources and glossary entry data to classify each place a
 * glossary term is turned into a clickable redirect. Writes a per-surface and
 * per-entry report to docs/tasks/glossary/GLOSSARY_LINK_SURFACES_INVENTORY.md
 * and a JSON sidecar for later tooling.
 *
 * Classifications follow the plan in docs/tasks/glossary/GLOSSARY_LINK_SURFACES_PLAN.md:
 *   - GlossaryPill usage                      => pill redirect
 *   - glossaryTermId present                  => clickable pill
 *   - GlossaryTooltip wrapping a pill         => hover-backed redirect
 *   - [[term]]/{{term}}/<g t="term">          => inline redirect text
 *   - seeAlso arrays in entry data            => footer redirect buttons
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const COMPONENT_ROOT = path.join(REPO_ROOT, 'src', 'components', 'Glossary');
const ENTRY_ROOT = path.join(REPO_ROOT, 'public', 'data', 'glossary', 'entries');
const INDEX_ROOT = path.join(REPO_ROOT, 'public', 'data', 'glossary', 'index');
const OUTPUT_MD = path.join(REPO_ROOT, 'docs', 'tasks', 'glossary', 'GLOSSARY_LINK_SURFACES_INVENTORY.md');
const OUTPUT_JSON = path.join(REPO_ROOT, 'docs', 'tasks', 'glossary', 'GLOSSARY_LINK_SURFACES_INVENTORY.json');

type SurfaceId =
  | 'pill'
  | 'clickable_pill'
  | 'hover_pill'
  | 'inline_text'
  | 'footer_see_also';

interface ComponentHit {
  file: string;
  surfaces: SurfaceId[];
  signals: string[];
}

interface EntryHit {
  id: string;
  file: string;
  surfaces: SurfaceId[];
  counts: Partial<Record<SurfaceId, number>>;
}

function walk(dir: string, filter: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, filter));
    else if (ent.isFile() && filter(ent.name)) out.push(full);
  }
  return out;
}

function rel(p: string): string {
  return path.relative(REPO_ROOT, p).replace(/\\/g, '/');
}

function scanComponents(): ComponentHit[] {
  const files = walk(COMPONENT_ROOT, (n) => n.endsWith('.tsx') || n.endsWith('.ts'));
  const hits: ComponentHit[] = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf-8');
    const surfaces = new Set<SurfaceId>();
    const signals: string[] = [];

    if (/\bGlossaryPill\b/.test(src)) {
      surfaces.add('pill');
      signals.push('GlossaryPill');
    }
    if (/\bglossaryTermId\b/.test(src)) {
      surfaces.add('clickable_pill');
      signals.push('glossaryTermId');
    }
    if (/\bGlossaryTooltip\b/.test(src)) {
      surfaces.add('hover_pill');
      signals.push('GlossaryTooltip');
    }
    if (/\bGlossaryContentRenderer\b/.test(src)) {
      surfaces.add('inline_text');
      signals.push('GlossaryContentRenderer');
    }
    if (/data-term-id/.test(src)) {
      surfaces.add('inline_text');
      signals.push('data-term-id');
    }
    if (/seeAlso/.test(src) && /onNavigate/.test(src)) {
      surfaces.add('footer_see_also');
      signals.push('seeAlso+onNavigate');
    }

    if (surfaces.size > 0) {
      hits.push({ file: rel(f), surfaces: [...surfaces], signals });
    }
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file));
}

const INLINE_PATTERNS: Array<[SurfaceId, RegExp]> = [
  ['inline_text', /\[\[[^\]|]+(?:\|[^\]]+)?\]\]/g],
  ['inline_text', /\{\{[^}|]+(?:\|[^}]+)?\}\}/g],
  ['inline_text', /<g\s+t="[^"]+"(?:\s+c="[^"]+")?>[^<]*<\/g>/g],
  ['inline_text', /data-term-id="[^"]+"/g],
];

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) {
    n += 1;
    if (re.lastIndex === 0) break; // safety for non-global
  }
  return n;
}

function scanEntryFile(file: string): EntryHit | null {
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    return null;
  }

  const id: string = parsed.id;
  const surfaces = new Set<SurfaceId>();
  const counts: Partial<Record<SurfaceId, number>> = {};

  // Stringify everything so we don't miss nested content inside traits, characteristics, etc.
  const serialized = JSON.stringify(parsed);
  for (const [surface, pattern] of INLINE_PATTERNS) {
    const n = countMatches(serialized, new RegExp(pattern.source, pattern.flags));
    if (n > 0) {
      surfaces.add(surface);
      counts[surface] = (counts[surface] ?? 0) + n;
    }
  }

  if (Array.isArray(parsed.seeAlso) && parsed.seeAlso.length > 0) {
    surfaces.add('footer_see_also');
    counts.footer_see_also = parsed.seeAlso.length;
  }

  if (surfaces.size === 0) return null;
  return { id, file: rel(file), surfaces: [...surfaces], counts };
}

function scanEntries(): EntryHit[] {
  const files = walk(ENTRY_ROOT, (n) => n.endsWith('.json'));
  const hits: EntryHit[] = [];
  for (const f of files) {
    const hit = scanEntryFile(f);
    if (hit) hits.push(hit);
  }
  return hits.sort((a, b) => a.id.localeCompare(b.id));
}

function scanIndex(): { file: string; entryCount: number; seeAlsoEntryCount: number }[] {
  const files = walk(INDEX_ROOT, (n) => n.endsWith('.json'));
  const out: { file: string; entryCount: number; seeAlsoEntryCount: number }[] = [];
  for (const f of files) {
    let parsed: any;
    try {
      parsed = JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch {
      continue;
    }
    const entries: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
    const seeAlso = entries.filter((e) => Array.isArray(e?.seeAlso) && e.seeAlso.length > 0).length;
    out.push({ file: rel(f), entryCount: entries.length, seeAlsoEntryCount: seeAlso });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

const SURFACE_NAMES: Record<SurfaceId, string> = {
  pill: 'Pill redirect',
  clickable_pill: 'Clickable pill (glossaryTermId set)',
  hover_pill: 'Hover-backed pill (GlossaryTooltip wrapper)',
  inline_text: 'Inline redirect text',
  footer_see_also: 'Footer See Also redirect',
};

function aggregateEntrySurfaceCounts(hits: EntryHit[]): Record<SurfaceId, number> {
  const totals: Record<SurfaceId, number> = {
    pill: 0,
    clickable_pill: 0,
    hover_pill: 0,
    inline_text: 0,
    footer_see_also: 0,
  };
  for (const h of hits) {
    for (const s of h.surfaces) {
      totals[s] += h.counts[s] ?? 1;
    }
  }
  return totals;
}

function renderMarkdown(
  components: ComponentHit[],
  entries: EntryHit[],
  indexFiles: { file: string; entryCount: number; seeAlsoEntryCount: number }[],
): string {
  const now = new Date().toISOString();
  const totals = aggregateEntrySurfaceCounts(entries);
  const indexTotalEntries = indexFiles.reduce((s, f) => s + f.entryCount, 0);
  const indexTotalSeeAlso = indexFiles.reduce((s, f) => s + f.seeAlsoEntryCount, 0);

  const lines: string[] = [];
  lines.push('# Glossary Link Surfaces Inventory');
  lines.push('');
  lines.push(`_Generated ${now} by \`scripts/audits/inventory-glossary-link-surfaces.ts\`._`);
  lines.push('');
  lines.push('This report is generated. To regenerate:');
  lines.push('');
  lines.push('```');
  lines.push('npx tsx scripts/audits/inventory-glossary-link-surfaces.ts');
  lines.push('```');
  lines.push('');
  lines.push('See [GLOSSARY_LINK_SURFACES_PLAN.md](./GLOSSARY_LINK_SURFACES_PLAN.md) for the surface taxonomy this report classifies against.');
  lines.push('');

  lines.push('## Totals');
  lines.push('');
  lines.push('| Surface | Occurrences in entry data |');
  lines.push('| --- | ---: |');
  for (const s of Object.keys(SURFACE_NAMES) as SurfaceId[]) {
    lines.push(`| ${SURFACE_NAMES[s]} | ${totals[s]} |`);
  }
  lines.push('');
  lines.push(`- Entry files scanned: ${entries.length} (only entries with at least one redirect surface are listed below)`);
  lines.push(`- Index files scanned: ${indexFiles.length} (covering ${indexTotalEntries} index rows; ${indexTotalSeeAlso} rows carry a seeAlso array)`);
  lines.push(`- Component files with redirect signals: ${components.length}`);
  lines.push('');

  lines.push('## Components');
  lines.push('');
  lines.push('| File | Surfaces | Signals |');
  lines.push('| --- | --- | --- |');
  for (const c of components) {
    lines.push(`| \`${c.file}\` | ${c.surfaces.map((s) => SURFACE_NAMES[s]).join(', ')} | ${c.signals.join(', ')} |`);
  }
  lines.push('');

  lines.push('## Index Files');
  lines.push('');
  lines.push('| Index | Entries | `seeAlso` entries |');
  lines.push('| --- | ---: | ---: |');
  for (const f of indexFiles) {
    lines.push(`| \`${f.file}\` | ${f.entryCount} | ${f.seeAlsoEntryCount} |`);
  }
  lines.push('');

  lines.push('## Entries (redirect surfaces by entry)');
  lines.push('');
  lines.push('Only entries with at least one redirect surface are listed. Counts are occurrences within the entry JSON.');
  lines.push('');
  lines.push('| Entry id | File | Pill | Clickable Pill | Hover Pill | Inline Text | See Also |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const e of entries) {
    const c = e.counts;
    lines.push(
      `| \`${e.id}\` | \`${e.file}\` | ${c.pill ?? ''} | ${c.clickable_pill ?? ''} | ${c.hover_pill ?? ''} | ${c.inline_text ?? ''} | ${c.footer_see_also ?? ''} |`,
    );
  }
  lines.push('');

  return lines.join('\n');
}

function main() {
  const components = scanComponents();
  const entries = scanEntries();
  const indexFiles = scanIndex();

  const md = renderMarkdown(components, entries, indexFiles);
  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, md, 'utf-8');

  const json = {
    generatedAt: new Date().toISOString(),
    totals: aggregateEntrySurfaceCounts(entries),
    components,
    indexFiles,
    entries,
  };
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(json, null, 2), 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${rel(OUTPUT_MD)}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${rel(OUTPUT_JSON)}`);
  // eslint-disable-next-line no-console
  console.log(
    `Components: ${components.length} | Entries with surfaces: ${entries.length} | Index files: ${indexFiles.length}`,
  );
}

main();
