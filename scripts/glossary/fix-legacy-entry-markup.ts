/**
 * One-shot, idempotent codemod: rewrite legacy HTML-in-markdown glossary
 * entries into the pure-markdown dialect the build-time compiler accepts
 * (src/systems/glossary/compile/compileEntry.ts).
 *
 * It rewrites the `markdown` field of checked-in entry JSON files under
 * public/data/glossary/entries/**. It is safe to run repeatedly: entries that
 * are already clean markdown pass through unchanged.
 *
 * Transformations (never deletes visible content):
 *   - <span data-term-id="X" class="glossary-term-link-from-markdown">D</span>
 *       -> [[X|D]]          (term link shorthand the compiler understands)
 *   - <span class="glossary-term-link-from-markdown">D</span> (no id)
 *       -> D                (plain text; nothing to link to)
 *   - <details><summary>Title</summary><div>body</div></details>
 *       -> "### Title" heading + body as markdown (H3 becomes a collapsible
 *          section in the compiler, mirroring the old <details> card)
 *   - <div class="not-prose ..."><table>...</table></div> and bare <table>
 *       -> GFM pipe table
 *   - <p class="glossary-intro-quote">text</p> / <p>text</p>  -> paragraph
 *   - <div class="glossary-callout"> / <div class="glossary-example*">
 *       -> markdown blockquote (compiler renders blockquote as a callout)
 *   - <ul>/<ol>/<li> -> markdown list
 *   - <strong>/<b> -> **..**, <em>/<i> -> *..*, <br> -> newline
 *   - <caption> -> a bold line above the table
 *
 * Usage: npx tsx scripts/glossary/fix-legacy-entry-markup.ts [--dry] [--only=<id>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildResolvableIdSet,
  makeEmitter,
  repairMarkdownLinks,
  repairSeeAlso,
} from './lib/termLinks';

const ROOT = process.cwd();
const ENTRIES_BASE = path.join(ROOT, 'public/data/glossary/entries');

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

// ---------------------------------------------------------------------------
// Resolve-aware term-link emitter (shared with the ingest). Only [[..]] links
// whose target resolves are emitted; corrupted ids are repaired, underscore
// spell ids are rewritten to their real hyphenated form, and anything that
// still can't resolve is unlinked to plain text (content preserved).
// ---------------------------------------------------------------------------

const EMITTER = makeEmitter(buildResolvableIdSet(ROOT));
const emitTermLink = (token: string, display: string) => EMITTER.emit(token, display);

// ---------------------------------------------------------------------------
// A tolerant HTML tokenizer + tree builder for the small tag subset present.
// ---------------------------------------------------------------------------

type HNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: string; attrs: Record<string, string>; children: HNode[] };

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/** Parse an HTML fragment into a forest. Unrecognized/mismatched tags are tolerated. */
function parseHTML(htmlRaw: string): HNode[] {
  // Drop HTML comments outright — they carry no renderable content.
  const html = htmlRaw.replace(/<!--[\s\S]*?-->/g, '');
  const root: HNode = { type: 'element', tag: '#root', attrs: {}, children: [] };
  const stack: HNode[] = [root];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (text: string) => {
    if (!text) return;
    (stack[stack.length - 1] as any).children.push({ type: 'text', text });
  };
  while ((m = tagRe.exec(html)) !== null) {
    pushText(html.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClose = m[4] === '/' || VOID_TAGS.has(tag);
    if (closing) {
      // Pop until we find the matching open tag (tolerate stray closers).
      for (let i = stack.length - 1; i > 0; i--) {
        if ((stack[i] as any).tag === tag) {
          stack.length = i;
          break;
        }
      }
    } else {
      const el: HNode = { type: 'element', tag, attrs: parseAttrs(m[3]), children: [] };
      (stack[stack.length - 1] as any).children.push(el);
      if (!selfClose) stack.push(el);
    }
  }
  pushText(html.slice(last));
  return (root as any).children;
}

// ---------------------------------------------------------------------------
// HTML tree -> markdown.
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

const TERM_LINK_CLASS = /glossary-term-link-from-markdown/;

/**
 * Pass 1 (string level): replace every inline term-link span with the
 * [[id|display]] shorthand, in place, without disturbing the surrounding
 * markdown. Spans in this corpus are always inline term links, so this is
 * safe to run across the whole document before any block parsing. Handles
 * (rare) nested spans by iterating to a fixed point.
 */
function replaceTermSpans(md: string): string {
  const spanRe = /<span([^>]*)>([\s\S]*?)<\/span>/g;
  let prev: string;
  let out = md;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(spanRe, (whole, attrsRaw, inner) => {
      const attrs = parseAttrs(attrsRaw);
      if (/<span\b/i.test(inner)) return whole; // let inner resolve first
      const id = attrs['data-term-id'];
      const display = decodeEntities(inner).trim();
      if (id && TERM_LINK_CLASS.test(attrs.class || '')) {
        return emitTermLink(id, display);
      }
      // Span without a term id: keep just its text.
      return display;
    });
  } while (out !== prev && guard++ < 10);
  return out;
}

/**
 * Repair/resolve-check pre-existing term-link shorthand already in the
 * markdown: `[[id|display]]`, `[[id]]`, `{{id}}`, and `<g t="id">display</g>`.
 * Echo-corrupted ids (`[[hit_points Points]]`) are repaired; anything that
 * still doesn't resolve is unlinked to plain text. Idempotent.
 */
function repairExistingLinks(md: string): string {
  return repairMarkdownLinks(md, EMITTER);
}

/** Render inline-level nodes (text, strong/em, etc.) to a single line. Spans
 * are already gone by pass 1, but tolerate any stragglers as plain text. */
function renderInline(nodes: HNode[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      out += decodeEntities(n.text);
      continue;
    }
    const inner = renderInline(n.children);
    switch (n.tag) {
      case 'span': {
        const id = n.attrs['data-term-id'];
        if (id && TERM_LINK_CLASS.test(n.attrs.class || '')) {
          const display = inner.trim();
          out += display ? `[[${id}|${display}]]` : `[[${id}]]`;
        } else {
          out += inner;
        }
        break;
      }
      case 'strong':
      case 'b': {
        const t = inner.trim();
        out += t ? `**${t}**` : '';
        break;
      }
      case 'em':
      case 'i': {
        const t = inner.trim();
        out += t ? `*${t}*` : '';
        break;
      }
      case 'code': {
        const t = inner.trim();
        out += t ? '`' + t + '`' : '';
        break;
      }
      case 'br':
        out += ' ';
        break;
      case 'a': {
        const href = n.attrs.href;
        out += href ? `[${inner.trim()}](${href})` : inner;
        break;
      }
      default:
        out += inner;
    }
  }
  return out;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Escape literal `|` in a table cell, but leave the `|` inside [[id|display]]
 * shorthand alone — the compiler extracts that shorthand before it parses the
 * GFM table, so its pipe must stay unescaped.
 */
function escapeCellPipes(s: string): string {
  const parts: string[] = [];
  const linkRe = /\[\[[^\]]*\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(s)) !== null) {
    parts.push(s.slice(last, m.index).replace(/\|/g, '\\|'));
    parts.push(m[0]); // keep shorthand verbatim
    last = linkRe.lastIndex;
  }
  parts.push(s.slice(last).replace(/\|/g, '\\|'));
  return parts.join('');
}

/** True if a node is (or contains only) whitespace text. */
function isBlank(n: HNode): boolean {
  return n.type === 'text' && n.text.trim() === '';
}

/** Convert an HTML <table> element into GFM pipe-table lines. */
function tableToMarkdown(table: HNode): string {
  if (table.type !== 'element') return '';
  const rows: string[][] = [];
  let headerRow: string[] | null = null;
  let caption = '';
  const collectRows = (node: HNode, inHead: boolean) => {
    if (node.type !== 'element') return;
    for (const c of node.children) {
      if (c.type !== 'element') continue;
      if (c.tag === 'caption') caption = collapseWs(renderInline(c.children));
      else if (c.tag === 'thead') collectRows(c, true);
      else if (c.tag === 'tbody') collectRows(c, false);
      else if (c.tag === 'tr') {
        const cells: string[] = [];
        let isHeader = inHead;
        for (const cell of c.children) {
          if (cell.type !== 'element') continue;
          if (cell.tag === 'th') isHeader = true;
          if (cell.tag === 'th' || cell.tag === 'td') {
            cells.push(escapeCellPipes(collapseWs(renderInline(cell.children))));
          }
        }
        if (cells.length === 0) continue;
        if (isHeader && !headerRow) headerRow = cells;
        else rows.push(cells);
      }
    }
  };
  collectRows(table, false);
  const headerCells: string[] = headerRow ?? [];
  const width = Math.max(headerCells.length, ...rows.map((r) => r.length), 1);
  const pad = (r: string[]) => {
    const cells = r.slice();
    while (cells.length < width) cells.push('');
    return `| ${cells.join(' | ')} |`;
  };
  const header: string[] = headerCells.length ? headerCells : new Array(width).fill('');
  const lines: string[] = [];
  if (caption) lines.push(`**${caption}**`, '');
  lines.push(pad(header));
  lines.push(`| ${new Array(width).fill('---').join(' | ')} |`);
  for (const r of rows) lines.push(pad(r));
  return lines.join('\n');
}

/** Render block-level nodes to markdown text (with blank-line separation). */
function renderBlocks(nodes: HNode[], listDepth = 0): string {
  const parts: string[] = [];
  const flushInline: HNode[] = [];
  const emitInline = () => {
    if (flushInline.length === 0) return;
    const line = collapseWs(renderInline(flushInline));
    if (line) parts.push(line);
    flushInline.length = 0;
  };
  for (const n of nodes) {
    if (n.type === 'text') {
      if (n.text.trim() === '') continue;
      // A text node inside an HTML wrapper is raw markdown. If it carries block
      // structure (blank lines, pipe-table rows, headings, list bullets), it
      // must be preserved verbatim rather than collapsed into one line — else a
      // multi-line GFM table gets flattened and stops being a table.
      const norm = n.text.replace(/\r\n/g, '\n');
      const isBlockMarkdown = /\n\s*\n/.test(norm) || /(^|\n)\s*(\||#{1,6}\s|[-*]\s|\d+\.\s)/.test(norm);
      if (isBlockMarkdown) {
        emitInline();
        const preserved = norm.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim();
        if (preserved) parts.push(preserved);
      } else {
        flushInline.push(n);
      }
      continue;
    }
    switch (n.tag) {
      case 'p': {
        emitInline();
        const t = collapseWs(renderInline(n.children));
        if (t) parts.push(t);
        break;
      }
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        emitInline();
        const level = Math.min(Math.max(parseInt(n.tag[1], 10), 2), 4);
        const t = collapseWs(renderInline(n.children));
        if (t) parts.push(`${'#'.repeat(level)} ${t}`);
        break;
      }
      case 'hr':
        emitInline();
        parts.push('---');
        break;
      case 'br':
        break;
      case 'table':
        emitInline();
        parts.push(tableToMarkdown(n));
        break;
      case 'ul':
      case 'ol': {
        emitInline();
        const ordered = n.tag === 'ol';
        const items: string[] = [];
        let idx = 1;
        for (const li of n.children) {
          if (li.type !== 'element' || li.tag !== 'li') continue;
          // Separate nested lists from inline content.
          const inlineKids = li.children.filter(
            (c) => !(c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol')),
          );
          const nestedLists = li.children.filter(
            (c) => c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol'),
          );
          const marker = ordered ? `${idx}.` : '-';
          const text = collapseWs(renderInline(inlineKids));
          let block = `${marker} ${text}`;
          for (const nl of nestedLists) {
            const sub = renderBlocks([nl], listDepth + 1)
              .split('\n')
              .map((l) => (l ? '  ' + l : l))
              .join('\n');
            block += '\n' + sub;
          }
          items.push(block);
          idx++;
        }
        parts.push(items.join('\n'));
        break;
      }
      case 'details': {
        emitInline();
        // <summary> becomes an H3 heading; the rest becomes its body.
        let title = '';
        const bodyNodes: HNode[] = [];
        for (const c of n.children) {
          if (c.type === 'element' && c.tag === 'summary') {
            // Summary may wrap an <h3> or be plain text.
            title = collapseWs(renderInline(c.children));
          } else {
            bodyNodes.push(c);
          }
        }
        if (title) parts.push(`### ${title}`);
        const body = renderBlocks(bodyNodes, listDepth);
        if (body) parts.push(body);
        break;
      }
      case 'summary': {
        // Stray summary outside details: treat as heading.
        emitInline();
        const t = collapseWs(renderInline(n.children));
        if (t) parts.push(`### ${t}`);
        break;
      }
      case 'div': {
        emitInline();
        const cls = n.attrs.class || '';
        if (/glossary-callout|glossary-example/.test(cls)) {
          // Blockquote. example-list/item may contain a <strong> label + <span> body.
          const inner = renderBlocks(n.children, listDepth);
          const quoted = inner
            .split('\n')
            .map((l) => (l ? `> ${l}` : '>'))
            .join('\n');
          if (inner.trim()) parts.push(quoted);
        } else {
          // Structural wrapper (not-prose, pt-2, plain div): unwrap.
          const inner = renderBlocks(n.children, listDepth);
          if (inner) parts.push(inner);
        }
        break;
      }
      case 'span':
      case 'strong':
      case 'b':
      case 'em':
      case 'i':
      case 'a':
      case 'code':
        // Inline element at block level: accumulate.
        flushInline.push(n);
        break;
      default: {
        // Unknown wrapper: unwrap its children.
        const inner = renderBlocks(n.children, listDepth);
        if (inner) {
          emitInline();
          parts.push(inner);
        }
      }
    }
  }
  emitInline();
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Top-level: split markdown into HTML blocks vs plain-markdown blocks, so we
// only reflow the HTML and leave existing markdown (tables, headings) intact.
// ---------------------------------------------------------------------------

/** Does this text contain any HTML tags we need to convert? */
function hasHtml(md: string): boolean {
  return /<(span|div|p|details|summary|table|ul|ol|li|strong|em|b|i|caption|thead|tbody|tr|td|th|br)\b/i.test(
    md,
  );
}

function convertMarkdown(mdRaw: string): string {
  // HTML comments carry no renderable content and compile as raw-html; strip them.
  const md = mdRaw.replace(/<!--[\s\S]*?-->/g, '');
  if (!hasHtml(md)) {
    // No HTML, but may still carry corrupted/unresolvable [[..]] shorthand.
    const repaired = repairExistingLinks(md);
    return md === mdRaw ? repaired : repaired.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  }
  // Pass 1: inline term-link spans -> [[id|display]] shorthand, in place.
  const spanned = replaceTermSpans(md);
  if (!hasHtml(spanned)) {
    // Only spans were present; the rest is already markdown. Normalize newlines.
    return (
      repairExistingLinks(spanned).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() +
      '\n'
    );
  }
  // Pass 2: parse the whole doc; plain-markdown text nodes pass through
  // verbatim, block HTML (details/div/table/p/lists) is converted.
  const tree = parseHTML(spanned);
  return repairExistingLinks(renderMixed(tree));
}

/**
 * Walk the top-level forest. Text nodes are emitted verbatim (they are already
 * markdown); element nodes are converted via renderBlocks.
 */
function renderMixed(nodes: HNode[]): string {
  const out: string[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer.trim()) out.push(buffer.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    buffer = '';
  };
  for (const n of nodes) {
    if (n.type === 'text') {
      buffer += n.text;
    } else {
      flush();
      const block = renderBlocks([n]);
      if (block.trim()) out.push(block);
    }
  }
  flush();
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Driver.
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
}

/**
 * A handful of legacy entries (lockpicking, traps) store their body as a
 * structured `content[]` array instead of `markdown`, so the markdown-only
 * compiler sees them as empty. Flatten that array into equivalent markdown.
 */
function contentArrayToMarkdown(content: any[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    switch (block.type) {
      case 'paragraph':
        if (block.text) parts.push(String(block.text));
        break;
      case 'heading': {
        const level = Math.min(Math.max(Number(block.level) || 2, 2), 4);
        if (block.text) parts.push(`${'#'.repeat(level)} ${block.text}`);
        break;
      }
      case 'list':
        if (Array.isArray(block.items)) {
          parts.push(block.items.map((i: string) => `- ${i}`).join('\n'));
        }
        break;
      case 'table': {
        const headers: string[] = block.headers ?? [];
        const rows: string[][] = block.rows ?? [];
        const width = Math.max(headers.length, ...rows.map((r) => r.length), 1);
        const pad = (r: string[]) => {
          const c = r.slice();
          while (c.length < width) c.push('');
          return `| ${c.join(' | ')} |`;
        };
        const lines = [
          pad(headers.length ? headers : new Array(width).fill('')),
          `| ${new Array(width).fill('---').join(' | ')} |`,
          ...rows.map(pad),
        ];
        parts.push(lines.join('\n'));
        break;
      }
      default:
        if (block.text) parts.push(String(block.text));
    }
  }
  return parts.join('\n\n');
}

function loadGeneratedSet(): Set<string> {
  const set = new Set<string>();
  const manifest = path.join(ENTRIES_BASE, '.generated-manifest.json');
  try {
    for (const rel of JSON.parse(fs.readFileSync(manifest, 'utf8'))) {
      set.add(path.resolve(ROOT, rel));
    }
  } catch {
    console.warn('WARN: no .generated-manifest.json; run `tsx scripts/ingestPhbGlossary.ts` first');
  }
  return set;
}

function main(): void {
  const files: string[] = [];
  walk(ENTRIES_BASE, files);
  const generated = loadGeneratedSet();
  let changed = 0;
  let scanned = 0;
  let skippedGenerated = 0;
  for (const file of files) {
    if (generated.has(path.resolve(file))) {
      skippedGenerated++;
      continue; // generated files are fixed in the ingest, not here
    }
    let json: any;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // skip malformed fixtures (e.g. dev/test_entry.json)
    }
    if (ONLY && json.id !== ONLY) continue;
    let dirty = false;
    // Legacy structured `content[]` entries carry no markdown; synthesize it.
    if (
      (typeof json.markdown !== 'string' || json.markdown.trim() === '') &&
      Array.isArray(json.content) &&
      json.content.length > 0
    ) {
      const title = json.title ? `# ${json.title}\n\n` : '';
      json.markdown = title + contentArrayToMarkdown(json.content);
      dirty = true;
    }
    scanned++;
    // Convert markdown when present (rich schema entries have none).
    if (typeof json.markdown === 'string') {
      const after = convertMarkdown(json.markdown);
      if (after !== json.markdown) {
        json.markdown = after;
        dirty = true;
      }
    }
    // Repair the seeAlso array on EVERY entry (the compiler checks seeAlso even
    // for entries with no compilable body): drop dead links, hyphenate spells,
    // repair echo-corrupted tokens.
    if (Array.isArray(json.seeAlso)) {
      const repaired = repairSeeAlso(json.seeAlso, EMITTER);
      if (JSON.stringify(repaired) !== JSON.stringify(json.seeAlso)) {
        json.seeAlso = repaired;
        dirty = true;
      }
    }
    if (dirty) {
      changed++;
      if (!DRY) {
        fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      }
    }
  }
  console.log(
    `scanned ${scanned} entries; ${DRY ? 'would change' : 'changed'} ${changed}; skipped ${skippedGenerated} generated`,
  );
}

main();
