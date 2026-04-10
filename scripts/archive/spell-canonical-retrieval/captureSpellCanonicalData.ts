import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

/**
 * This script captures raw canonical spell content from D&D Beyond into each spell reference markdown file.
 *
 * The spell-truth project now treats canonical retrieval as its own lane. This file does not
 * normalize the source data into Aralia rules, and it does not rewrite spell JSON. Its only
 * job is to fetch the already-mapped D&D Beyond spell page slowly, extract the visible spell
 * content, and preserve that content directly in the spell's `.md` file.
 *
 * Called manually by: Codex during the canonical-retrieval lane
 * Depends on:
 * - `.agent/roadmap-local/spell-validation/spell-corpus-dndbeyond-report.json`
 * - `public/data/spells/**`
 * - public D&D Beyond spell detail pages
 * Writes:
 * - `docs/spells/reference/**`
 */

// ============================================================================
// Paths and timing
// ============================================================================
// This section keeps the shared paths and throttle settings in one place.
// The user explicitly asked for a cautious retrieval path, so the script is
// intentionally sequential, resumable, and slow between requests.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const CORPUS_REPORT_PATH = path.resolve(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-corpus-dndbeyond-report.json');
const AUTH_STATE_PATH = path.resolve(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'dndbeyond-auth.json');
const DEFAULT_DELAY_MIN_MS = 7000;
const DEFAULT_DELAY_MAX_MS = 12000;
const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_ONLY_MARKER = '<!-- CANONICAL-ONLY-REFERENCE -->';
const RETRIEVAL_EXCLUDED_IDS = new Set([
  'galders-tower',
  'galders-speedy-courier',
  'blade-of-disaster',
]);

interface LocalSpellRecord {
  id: string;
  name: string;
  level: number;
  legacy: boolean;
  jsonPath: string;
  markdownPath: string;
}

interface CorpusReportSpellResult {
  spellId: string;
  spellName: string;
  level: number;
  jsonPath: string;
  markdownPath: string;
  matchedListing: boolean;
  listingUrl: string;
}

interface CorpusReport {
  generatedAt: string;
  spellResults: CorpusReportSpellResult[];
}

interface CanonicalCaptureRecord {
  visibleFacts: {
    name: string;
    level: string;
    castingTime: string;
    rangeArea: string;
    components: string;
    duration: string;
    school: string;
    attackSave: string;
    damageEffect: string;
    rulesTextParagraphs: string[];
    materialComponentNote: string;
    spellTags: string[];
    availableFor: string[];
    referencedRules: Array<{
      label: string;
      href: string;
    }>;
  };
  pageLegacy: boolean | null;
  captureMethod: 'http' | 'browser';
}

interface CaptureOptions {
  limit: number | null;
  resume: boolean;
  delayMinMs: number;
  delayMaxMs: number;
  browserFallbackOnly: boolean;
}

interface DndBeyondAuthState {
  cookieHeader: string;
}

// ============================================================================
// Basic helpers
// ============================================================================
// This section handles command-line parsing, random delay generation, HTML cleanup,
// and small utility routines used by the actual capture flow below.
// ============================================================================

function parseOptions(argv: string[]): CaptureOptions {
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  const delayMinArg = argv.find((arg) => arg.startsWith('--delay-min-ms='));
  const delayMaxArg = argv.find((arg) => arg.startsWith('--delay-max-ms='));

  return {
    limit: limitArg ? Number(limitArg.split('=')[1]) : null,
    resume: argv.includes('--resume'),
    delayMinMs: delayMinArg ? Number(delayMinArg.split('=')[1]) : DEFAULT_DELAY_MIN_MS,
    delayMaxMs: delayMaxArg ? Number(delayMaxArg.split('=')[1]) : DEFAULT_DELAY_MAX_MS,
    browserFallbackOnly: argv.includes('--browser-fallback-only'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomIntBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function decodeHtmlEntities(value: string): string {
  const numericDecoded = value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return numericDecoded
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&bull;/g, '*')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableText(value: string): string {
  return value
    .replace(/\s+\(\s*/g, ' (')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownHasCanonicalSnapshot(markdownPath: string): boolean {
  if (!fs.existsSync(markdownPath)) return false;
  return fs.readFileSync(markdownPath, 'utf8').includes(CANONICAL_SNAPSHOT_HEADING);
}

function readDndBeyondAuthState(): DndBeyondAuthState | null {
  if (!fs.existsSync(AUTH_STATE_PATH)) return null;

  const parsed = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as Partial<DndBeyondAuthState>;
  if (!parsed.cookieHeader || typeof parsed.cookieHeader !== 'string') {
    return null;
  }

  return {
    cookieHeader: parsed.cookieHeader,
  };
}

function spellNeedsBrowserFallback(spell: LocalSpellRecord, reportEntry: CorpusReportSpellResult | undefined, options: CaptureOptions): boolean {
  // These spell pages were explicitly removed from the active canonical-retrieval backlog
  // by the project owner. We leave their existing repo files alone, but future resume runs
  // should stop trying to fetch them so the remaining backlog stays focused on Arcane Sword.
  if (RETRIEVAL_EXCLUDED_IDS.has(spell.id)) return false;

  // In browser-fallback mode we only want the residue from the first pass:
  // spells that have a mapped D&D Beyond page but still do not have a written
  // canonical snapshot in their markdown file.
  if (!options.browserFallbackOnly) return true;
  if (!reportEntry || !reportEntry.matchedListing || !reportEntry.listingUrl) return false;
  return !markdownHasCanonicalSnapshot(spell.markdownPath);
}

// ============================================================================
// Local corpus and report loading
// ============================================================================
// This section loads the local spell list and the previously generated D&D Beyond
// corpus report. Reusing that report means the canonical capture lane does not need
// to hit D&D Beyond search and listing pages again just to rediscover spell URLs.
// ============================================================================

function listLocalSpells(): LocalSpellRecord[] {
  const spells: LocalSpellRecord[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelFolder = `level-${level}`;
    const jsonDir = path.join(SPELL_JSON_ROOT, levelFolder);
    const markdownDir = path.join(REPO_ROOT, 'docs', 'spells', 'reference', levelFolder);
    if (!fs.existsSync(jsonDir)) continue;

    const files = fs.readdirSync(jsonDir)
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const jsonPath = path.join(jsonDir, file);
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;

      spells.push({
        id: typeof data.id === 'string' ? data.id : path.basename(file, '.json'),
        name: typeof data.name === 'string' ? data.name : path.basename(file, '.json'),
        level: typeof data.level === 'number' ? data.level : level,
        legacy: data.legacy === true,
        jsonPath,
        markdownPath: path.join(markdownDir, file.replace(/\.json$/i, '.md')),
      });
    }
  }

  return spells;
}

function readCorpusReport(): CorpusReport {
  return JSON.parse(fs.readFileSync(CORPUS_REPORT_PATH, 'utf8')) as CorpusReport;
}

// ============================================================================
// HTML capture parsing
// ============================================================================
// This section turns a D&D Beyond detail page into the raw visible spell content
// we want to preserve. The parser is intentionally literal: it captures what the
// page shows and avoids trying to reinterpret it into Aralia-specific rules.
//
// DEBT: The first retrieval pass used regex slicing for the `more-info-content`
// section. That was good enough for many pages, but it silently dropped rules
// text on pages whose body content had extra nesting or list structure. The
// archived version now uses JSDOM for the prose/tags/rules areas so a future
// rerun does not repeat that thin-capture failure.
// ============================================================================

function parseDetailDocument(detailHtml: string): Document {
  return new JSDOM(detailHtml).window.document;
}

function extractStatblockValue(detailHtml: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = detailHtml.match(new RegExp(`ddb-statblock-item-${escapedKey}[\\s\\S]*?<div class="ddb-statblock-item-value">([\\s\\S]*?)<\\/div>`, 'i'));
  return match ? normalizeComparableText(stripHtml(match[1])) : '';
}

function extractHeading(detailHtml: string): string {
  const match = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? normalizeComparableText(stripHtml(match[1])) : '';
}

function collectRulesBlocks(element: Element): string[] {
  const blocks: string[] = [];

  // Walk the actual DOM structure so nested paragraphs and list items survive.
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === child.TEXT_NODE) {
      const text = normalizeComparableText(child.textContent ?? '');
      if (text) blocks.push(text);
      continue;
    }

    if (child.nodeType !== child.ELEMENT_NODE) {
      continue;
    }

    const childElement = child as Element;
    if (childElement.matches('.components-blurb')) {
      continue;
    }

    if (childElement.matches('p, li, h1, h2, h3, h4, h5, h6, blockquote')) {
      const text = normalizeComparableText(childElement.textContent ?? '');
      if (text) blocks.push(text);
      continue;
    }

    if (childElement.matches('ul, ol')) {
      for (const item of Array.from(childElement.querySelectorAll(':scope > li'))) {
        const text = normalizeComparableText(item.textContent ?? '');
        if (text) blocks.push(text);
      }
      continue;
    }

    blocks.push(...collectRulesBlocks(childElement));
  }

  return blocks;
}

function extractRulesTextParagraphs(detailHtml: string): string[] {
  const document = parseDetailDocument(detailHtml);
  const moreInfo = document.querySelector('.more-info-content');
  if (!moreInfo) return [];

  const blocks = collectRulesBlocks(moreInfo).filter(Boolean);
  const deduped: string[] = [];

  // Some pages repeat the same line in nested wrappers. Keep only the first copy.
  for (const block of blocks) {
    if (deduped.at(-1) !== block) {
      deduped.push(block);
    }
  }

  return deduped;
}

function extractMaterialComponentNote(detailHtml: string): string {
  const document = parseDetailDocument(detailHtml);
  const blurb = document.querySelector('.components-blurb');
  return blurb ? normalizeComparableText(blurb.textContent ?? '') : '';
}

function extractReferencedRules(detailHtml: string): Array<{ label: string; href: string }> {
  const document = parseDetailDocument(detailHtml);
  const moreInfo = document.querySelector('.more-info-content');
  if (!moreInfo) return [];

  const seen = new Set<string>();
  const rules: Array<{ label: string; href: string }> = [];

  for (const anchor of Array.from(moreInfo.querySelectorAll('a.rule-tooltip[href]'))) {
    const href = normalizeComparableText(anchor.getAttribute('href') ?? '');
    const label = normalizeComparableText(anchor.textContent ?? '');
    const key = `${label}::${href}`;
    if (!label || !href || seen.has(key)) continue;
    seen.add(key);
    rules.push({ label, href });
  }

  return rules;
}

function extractSpellTags(detailHtml: string): string[] {
  const document = parseDetailDocument(detailHtml);
  return Array.from(document.querySelectorAll('p.tags.spell-tags span.tag.spell-tag'))
    .map((tag) => normalizeComparableText(tag.textContent ?? ''))
    .filter(Boolean);
}

function extractAvailableFor(detailHtml: string): string[] {
  const document = parseDetailDocument(detailHtml);
  return Array.from(document.querySelectorAll('p.tags.available-for span.tag.class-tag'))
    .map((tag) => normalizeComparableText(tag.textContent ?? ''))
    .filter(Boolean);
}

function detectLegacyBadge(detailHtml: string): boolean {
  return /legacy-badge|status[^>]*>\s*Legacy\s*</i.test(detailHtml);
}

function hasUsableVisibleFacts(record: CanonicalCaptureRecord['visibleFacts']): boolean {
  // The canonical snapshot is not trustworthy if it only captured the statblock shell.
  // Requiring rules text here forces the old process to fall through to browser-backed
  // capture instead of silently accepting a thin, description-less snapshot.
  if (record.rulesTextParagraphs.length === 0) {
    return false;
  }

  return [
    record.level,
    record.castingTime,
    record.rangeArea,
    record.components,
    record.duration,
    record.school,
    record.attackSave,
    record.damageEffect,
    record.materialComponentNote,
  ].some(Boolean)
    || record.spellTags.length > 0
    || record.availableFor.length > 0
    || record.referencedRules.length > 0;
}

// ============================================================================
// Markdown writing
// ============================================================================
// This section makes the retrieval lane finish each spell end-to-end. Once a
// spell's raw canonical content has been captured, the script immediately writes
// that content into the spell reference markdown file. Existing reference docs
// keep their structured Aralia field block, while missing docs get a canonical-
// only placeholder file that the parity validator can safely skip for now.
// ============================================================================

function renderCanonicalSnapshotSection(record: CanonicalCaptureRecord): string {
  const commentLines: string[] = [
    '<!--',
    `Name: ${record.visibleFacts.name}`,
  ];

  if (record.visibleFacts.level) commentLines.push(`Level: ${record.visibleFacts.level}`);
  if (record.visibleFacts.castingTime) commentLines.push(`Casting Time: ${record.visibleFacts.castingTime}`);
  if (record.visibleFacts.rangeArea) commentLines.push(`Range/Area: ${record.visibleFacts.rangeArea}`);
  if (record.visibleFacts.components) commentLines.push(`Components: ${record.visibleFacts.components}`);
  if (record.visibleFacts.duration) commentLines.push(`Duration: ${record.visibleFacts.duration}`);
  if (record.visibleFacts.school) commentLines.push(`School: ${record.visibleFacts.school}`);
  if (record.visibleFacts.attackSave) commentLines.push(`Attack/Save: ${record.visibleFacts.attackSave}`);
  if (record.visibleFacts.damageEffect) commentLines.push(`Damage/Effect: ${record.visibleFacts.damageEffect}`);

  if (record.visibleFacts.rulesTextParagraphs.length > 0) {
    commentLines.push('', 'Rules Text:');
    for (const paragraph of record.visibleFacts.rulesTextParagraphs) {
      commentLines.push(paragraph);
    }
  }

  if (record.visibleFacts.materialComponentNote) {
    commentLines.push('', 'Material Component:', record.visibleFacts.materialComponentNote);
  }

  if (record.visibleFacts.spellTags.length > 0) {
    commentLines.push('', 'Spell Tags:');
    for (const tag of record.visibleFacts.spellTags) {
      commentLines.push(tag);
    }
  }

  if (record.visibleFacts.availableFor.length > 0) {
    commentLines.push('', 'Available For:');
    for (const entry of record.visibleFacts.availableFor) {
      commentLines.push(entry);
    }
  }

  if ((record.visibleFacts.referencedRules ?? []).length > 0) {
    commentLines.push('', 'Referenced Rules:');
    for (const rule of record.visibleFacts.referencedRules) {
      commentLines.push(`${rule.label} -> ${rule.href}`);
    }
  }

  commentLines.push('', `Capture Method: ${record.captureMethod}`);
  if (record.pageLegacy !== null) {
    commentLines.push(`Legacy Page: ${record.pageLegacy ? 'true' : 'false'}`);
  }

  commentLines.push('-->');

  return [
    CANONICAL_SNAPSHOT_HEADING,
    '',
    'This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.',
    '',
    ...commentLines,
  ].join('\n');
}

function writeCanonicalSnapshotToMarkdown(spell: LocalSpellRecord, record: CanonicalCaptureRecord): void {
  const snapshotSection = renderCanonicalSnapshotSection(record);
  const hasExistingFile = fs.existsSync(spell.markdownPath);
  const existingContent = hasExistingFile ? fs.readFileSync(spell.markdownPath, 'utf8').trimEnd() : '';

  if (!hasExistingFile) {
    const placeholderContent = [
      `# ${spell.name}`,
      '',
      CANONICAL_ONLY_MARKER,
      '',
      'This reference file currently stores raw canonical retrieval content only.',
      'The structured Aralia spell field block has not been authored yet, so parity tooling should skip this file for now.',
      '',
      snapshotSection,
      '',
    ].join('\n');

    fs.mkdirSync(path.dirname(spell.markdownPath), { recursive: true });
    fs.writeFileSync(spell.markdownPath, placeholderContent, 'utf8');
    return;
  }

  const withoutExistingSnapshot = existingContent.includes(CANONICAL_SNAPSHOT_HEADING)
    ? existingContent.slice(0, existingContent.indexOf(CANONICAL_SNAPSHOT_HEADING)).trimEnd()
    : existingContent;

  const nextContent = [
    withoutExistingSnapshot,
    '',
    snapshotSection,
    '',
  ].join('\n').trimStart();

  fs.writeFileSync(spell.markdownPath, `${nextContent}\n`, 'utf8');
}

// ============================================================================
// Network retrieval
// ============================================================================
// This section performs the slow, sequential fetch work. It deliberately avoids
// parallel requests so the capture lane behaves more like a cautious audit than
// a high-speed crawler.
// ============================================================================

async function fetchText(url: string, authState: DndBeyondAuthState | null): Promise<string> {
  // When the user signs into D&D Beyond in the shared browser, we can reuse the
  // exported cookie header here. That keeps the corpus run mostly on the lighter
  // HTTP path and avoids forcing every remaining spell through a rendered browser.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; Aralia canonical spell capture)',
      'accept-language': 'en-US,en;q=0.9',
      ...(authState?.cookieHeader ? { cookie: authState.cookieHeader } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

async function captureFromDetailPage(
  spell: LocalSpellRecord,
  listingUrl: string,
  authState: DndBeyondAuthState | null,
): Promise<CanonicalCaptureRecord | 'needs-browser-capture'> {
  const html = await fetchText(listingUrl, authState);
  const visibleFacts: CanonicalCaptureRecord['visibleFacts'] = {
    name: extractHeading(html) || spell.name,
    level: extractStatblockValue(html, 'level'),
    castingTime: extractStatblockValue(html, 'casting-time'),
    rangeArea: extractStatblockValue(html, 'range-area'),
    components: extractStatblockValue(html, 'components'),
    duration: extractStatblockValue(html, 'duration'),
    school: extractStatblockValue(html, 'school'),
    attackSave: extractStatblockValue(html, 'attack-save'),
    damageEffect: extractStatblockValue(html, 'damage-effect'),
    rulesTextParagraphs: extractRulesTextParagraphs(html),
    materialComponentNote: extractMaterialComponentNote(html),
    spellTags: extractSpellTags(html),
    availableFor: extractAvailableFor(html),
    referencedRules: extractReferencedRules(html),
  };

  if (!hasUsableVisibleFacts(visibleFacts)) {
    return 'needs-browser-capture';
  }

  return {
    captureMethod: 'http',
    pageLegacy: detectLegacyBadge(html),
    visibleFacts,
  };
}

// ============================================================================
// Browser-backed capture
// ============================================================================
// Some D&D Beyond spell pages render usable spell facts only after client-side
// execution. This section reuses one Playwright browser session and then feeds
// the rendered HTML back through the same literal parser used by the HTTP path.
// That keeps the markdown output format identical between both capture modes.
// ============================================================================

async function captureFromRenderedPage(
  spell: LocalSpellRecord,
  listingUrl: string,
  page: import('playwright').Page,
): Promise<CanonicalCaptureRecord> {
  await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Give the client-side shell time to replace placeholder content with the real
  // spell page. We wait for the statblock shell loosely rather than pinning to a
  // brittle one-off selector from a single spell.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const html = await page.content();
  const visibleFacts: CanonicalCaptureRecord['visibleFacts'] = {
    name: extractHeading(html) || spell.name,
    level: extractStatblockValue(html, 'level'),
    castingTime: extractStatblockValue(html, 'casting-time'),
    rangeArea: extractStatblockValue(html, 'range-area'),
    components: extractStatblockValue(html, 'components'),
    duration: extractStatblockValue(html, 'duration'),
    school: extractStatblockValue(html, 'school'),
    attackSave: extractStatblockValue(html, 'attack-save'),
    damageEffect: extractStatblockValue(html, 'damage-effect'),
    rulesTextParagraphs: extractRulesTextParagraphs(html),
    materialComponentNote: extractMaterialComponentNote(html),
    spellTags: extractSpellTags(html),
    availableFor: extractAvailableFor(html),
    referencedRules: extractReferencedRules(html),
  };

  if (!hasUsableVisibleFacts(visibleFacts)) {
    throw new Error(`Rendered browser page still did not expose usable spell facts for ${spell.name}.`);
  }

  return {
    captureMethod: 'browser',
    pageLegacy: detectLegacyBadge(html),
    visibleFacts,
  };
}

// ============================================================================
// Main execution
// ============================================================================
// This section drives the slow sequential run. The markdown files themselves are
// now the resumable checkpoint surface, so `--resume` means "skip any spell that
// already has a canonical snapshot block written into its markdown file."
// ============================================================================

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const localSpells = listLocalSpells();
  const report = readCorpusReport();
  const authState = readDndBeyondAuthState();
  const reportBySpellId = new Map(report.spellResults.map((result) => [result.spellId, result]));
  let processedCount = 0;
  let capturedCount = 0;
  let needsAlternateSourceCount = 0;
  let needsBrowserCaptureCount = 0;
  let fetchFailedCount = 0;
  let browser: import('playwright').Browser | null = null;
  let page: import('playwright').Page | null = null;

  try {
    if (options.browserFallbackOnly) {
      browser = await chromium.launch({
        headless: true,
      });
      page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        locale: 'en-US',
      });
    }

    for (const spell of localSpells) {
      const reportEntry = reportBySpellId.get(spell.id);
      if (options.resume && markdownHasCanonicalSnapshot(spell.markdownPath)) {
        continue;
      }
      if (!spellNeedsBrowserFallback(spell, reportEntry, options)) {
        continue;
      }

      if (options.limit !== null && processedCount >= options.limit) break;

      if (!reportEntry || !reportEntry.matchedListing || !reportEntry.listingUrl) {
        console.log(`No mapped D&D Beyond page found for ${spell.name}; leaving it for alternate-source review.`);
        processedCount += 1;
        needsAlternateSourceCount += 1;
        continue;
      }

      if (processedCount > 0) {
        const delayMs = randomIntBetween(options.delayMinMs, options.delayMaxMs);
        console.log(`Waiting ${delayMs}ms before fetching ${spell.name}...`);
        await sleep(delayMs);
      }

      try {
        console.log(`Capturing canonical content for ${spell.name} from ${reportEntry.listingUrl}`);
        if (options.browserFallbackOnly) {
          if (!page) {
            throw new Error('Browser fallback page was not initialized.');
          }
          const captured = await captureFromRenderedPage(spell, reportEntry.listingUrl, page);
          writeCanonicalSnapshotToMarkdown(spell, captured);
          capturedCount += 1;
        } else {
          const captured = await captureFromDetailPage(spell, reportEntry.listingUrl, authState);
          if (captured === 'needs-browser-capture') {
            console.log(`Raw HTTP fetch did not expose usable spell facts for ${spell.name}; this spell now needs browser-backed capture fallback.`);
            needsBrowserCaptureCount += 1;
          } else {
            writeCanonicalSnapshotToMarkdown(spell, captured);
            capturedCount += 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`${options.browserFallbackOnly ? 'Browser-layer' : 'Request-layer'} failure for ${spell.name}: ${message}`);
        fetchFailedCount += 1;
      }

      processedCount += 1;
    }
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }

  console.log(`Canonical markdown files written in this run: ${capturedCount}`);
  console.log(`Needs alternate source in this run: ${needsAlternateSourceCount}`);
  console.log(`Needs browser-backed fallback in this run: ${needsBrowserCaptureCount}`);
  console.log(`Request-layer failures in this run: ${fetchFailedCount}`);
}

void main();
