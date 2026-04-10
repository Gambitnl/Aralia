import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

/**
 * This script repairs canonical snapshot blocks whose rules text was missed or truncated.
 *
 * The canonical snapshots are meant to preserve the source spell text inside the markdown
 * reference files. A later audit found that some snapshots kept only the statblock shell,
 * or only the first introductory sentence, because the original retrieval code parsed the
 * description area too loosely. This repair script revisits only the flagged subset, pulls
 * the rules text from the page DOM with JSDOM, and patches the markdown comment blocks in
 * place without disturbing the structured Aralia field block above them.
 *
 * Called manually by: Codex during canonical rules-text repair
 * Depends on:
 * - `.agent/roadmap-local/spell-validation/spell-canonical-rules-audit.json`
 * - `.agent/roadmap-local/spell-validation/spell-corpus-dndbeyond-report.json`
 * - `docs/spells/reference/**`
 * Writes:
 * - the affected spell reference markdown files
 */

// ============================================================================
// Paths and timing
// ============================================================================
// This section keeps the repair lane deliberately narrow. It only touches the
// audited broken subset and it spaces requests out so this stays closer to a
// cautious correction pass than to a high-speed crawler.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const AUDIT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-canonical-rules-audit.json');
const CORPUS_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-corpus-dndbeyond-report.json');
const MIN_DELAY_MS = 2200;
const MAX_DELAY_MS = 4200;
const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const MCP_CHROME_CDP_URL = 'http://127.0.0.1:49555';

interface AuditFinding {
  spellId: string;
  markdownPath: string;
  reason: string;
}

interface AuditArtifact {
  generatedAt: string;
  totalFindings: number;
  findings: AuditFinding[];
}

interface CorpusReportSpellResult {
  spellId: string;
  listingUrl: string;
  matchedListing: boolean;
}

interface CorpusReport {
  spellResults: CorpusReportSpellResult[];
}

// ============================================================================
// Small helpers
// ============================================================================
// This section keeps the string cleanup and throttling logic readable. The page
// DOM is noisy, so normalizing whitespace in one place makes the repair output
// consistent across all affected spells.
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomIntBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeComparableText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLineText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

// ============================================================================
// DOM extraction
// ============================================================================
// This section is the real process fix. Instead of slicing the HTML with a
// regex that assumes a flat `more-info-content -> footer` shape, we parse the
// page into a DOM and walk the actual content blocks. That preserves nested
// paragraphs and list items that the old retrieval pass sometimes dropped.
// ============================================================================

function collectRulesBlocks(element: Element): string[] {
  const blocks: string[] = [];

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === child.TEXT_NODE) {
      const text = normalizeLineText(child.textContent ?? '');
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
      const text = normalizeLineText(childElement.textContent ?? '');
      if (text) blocks.push(text);
      continue;
    }

    if (childElement.matches('ul, ol')) {
      for (const item of Array.from(childElement.querySelectorAll(':scope > li'))) {
        const text = normalizeLineText(item.textContent ?? '');
        if (text) blocks.push(text);
      }
      continue;
    }

    blocks.push(...collectRulesBlocks(childElement));
  }

  return blocks;
}

function extractRulesTextParagraphs(html: string): string[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const moreInfo = document.querySelector('.more-info-content');
  if (!moreInfo) return [];

  const blocks = collectRulesBlocks(moreInfo)
    .map((line) => normalizeLineText(line))
    .filter(Boolean);

  const deduped: string[] = [];
  for (const block of blocks) {
    if (deduped.at(-1) !== block) {
      deduped.push(block);
    }
  }

  return deduped;
}

// ============================================================================
// Markdown patching
// ============================================================================
// This section updates only the `Rules Text` subsection inside the existing
// canonical HTML comment. Everything else in the snapshot is left alone so the
// repair stays tightly scoped to the failure the audit found.
// ============================================================================

function extractCanonicalComment(markdown: string): { start: number; end: number; body: string } | null {
  const headingIndex = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  if (headingIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', headingIndex);
  const commentEnd = markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return {
    start: commentStart,
    end: commentEnd + 3,
    body: markdown.slice(commentStart + 4, commentEnd).trim(),
  };
}

function injectRulesText(commentBody: string, rulesParagraphs: string[]): string {
  const rulesSection = `Rules Text:\n${rulesParagraphs.join('\n')}`;
  const sectionBoundary = '\n\n(?:Material Component:|Spell Tags:|Available For:|Referenced Rules:|Capture Method:|Legacy Page:)';
  const existingRulesPattern = new RegExp(`Rules Text:\\n([\\s\\S]*?)(?=${sectionBoundary}|$)`, 'i');

  if (existingRulesPattern.test(commentBody)) {
    return commentBody.replace(existingRulesPattern, rulesSection);
  }

  const insertionTargets = [
    '\n\nMaterial Component:',
    '\n\nSpell Tags:',
    '\n\nAvailable For:',
    '\n\nReferenced Rules:',
    '\n\nCapture Method:',
    '\n\nLegacy Page:',
  ];

  for (const target of insertionTargets) {
    const index = commentBody.indexOf(target);
    if (index !== -1) {
      return `${commentBody.slice(0, index)}\n\n${rulesSection}${commentBody.slice(index)}`;
    }
  }

  return `${commentBody}\n\n${rulesSection}`;
}

function updateMarkdownRulesText(markdownPath: string, rulesParagraphs: string[]): boolean {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const comment = extractCanonicalComment(markdown);
  if (!comment) return false;

  const nextBody = injectRulesText(comment.body, rulesParagraphs);
  const nextComment = `<!--\n${nextBody}\n-->`;
  const nextMarkdown = `${markdown.slice(0, comment.start)}${nextComment}${markdown.slice(comment.end)}`;

  if (nextMarkdown === markdown) {
    return false;
  }

  fs.writeFileSync(markdownPath, nextMarkdown, 'utf8');
  return true;
}

// ============================================================================
// Corpus repair loop
// ============================================================================
// This section reads the audit output, revisits only the affected spells, and
// patches them one at a time. The logs stay explicit so we can see which files
// were repaired and which still need a deeper manual source check.
// ============================================================================

function readAuditArtifact(): AuditArtifact {
  return JSON.parse(fs.readFileSync(AUDIT_JSON_PATH, 'utf8')) as AuditArtifact;
}

function readCorpusReport(): CorpusReport {
  return JSON.parse(fs.readFileSync(CORPUS_REPORT_PATH, 'utf8')) as CorpusReport;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; Aralia canonical rules repair)',
      'accept-language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

async function extractRulesTextParagraphsFromLivePage(
  url: string,
  page: import('playwright').Page,
): Promise<string[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const serialized = await page.evaluate(`
    (() => {
      const moreInfo = document.querySelector('.more-info-content');
      if (!moreInfo) return '[]';

      const normalize = (value) => value.replace(/\\s+/g, ' ').replace(/\\s+([,.;:!?])/g, '$1').trim();
      const blocks = [];

      const collect = (element) => {
        for (const child of Array.from(element.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = normalize(child.textContent || '');
            if (text) blocks.push(text);
            continue;
          }

          if (child.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          const childElement = child;
          if (childElement.matches('.components-blurb')) {
            continue;
          }

          if (childElement.matches('p, li, h1, h2, h3, h4, h5, h6, blockquote')) {
            const text = normalize(childElement.textContent || '');
            if (text) blocks.push(text);
            continue;
          }

          if (childElement.matches('ul, ol')) {
            for (const item of Array.from(childElement.querySelectorAll(':scope > li'))) {
              const text = normalize(item.textContent || '');
              if (text) blocks.push(text);
            }
            continue;
          }

          collect(childElement);
        }
      };

      collect(moreInfo);

      const deduped = [];
      for (const block of blocks) {
        if (deduped[deduped.length - 1] !== block) {
          deduped.push(block);
        }
      }

      return JSON.stringify(deduped);
    })()
  `);

  return JSON.parse(serialized as string) as string[];
}

async function main(): Promise<void> {
  const audit = readAuditArtifact();
  const report = readCorpusReport();
  const listingUrlBySpellId = new Map(
    report.spellResults
      .filter((entry) => entry.matchedListing && entry.listingUrl)
      .map((entry) => [entry.spellId, entry.listingUrl] as const),
  );

  let repaired = 0;
  let unchanged = 0;
  let failed = 0;
  let browserFallbackRepairs = 0;

  for (let index = 0; index < audit.findings.length; index += 1) {
    const finding = audit.findings[index];
    const listingUrl = listingUrlBySpellId.get(finding.spellId);

    if (!listingUrl) {
      console.log(`Skipping ${finding.spellId}: no D&D Beyond page mapping was found for repair.`);
      failed += 1;
      continue;
    }

    if (index > 0) {
      const delayMs = randomIntBetween(MIN_DELAY_MS, MAX_DELAY_MS);
      console.log(`Waiting ${delayMs}ms before repairing ${finding.spellId}...`);
      await sleep(delayMs);
    }

    try {
      console.log(`Repairing canonical rules text for ${finding.spellId} from ${listingUrl}`);
      const html = await fetchHtml(listingUrl);
      let rulesParagraphs = extractRulesTextParagraphs(html);

      // If the public HTML still hides the prose, fall back to a rendered browser page.
      // Reconnecting for each spell is slower, but it prevents one dropped browser session
      // from poisoning every remaining repair in the batch.
      if (rulesParagraphs.length === 0) {
        let browser: import('playwright').Browser | null = null;
        let page: import('playwright').Page | null = null;
        let createdPage: import('playwright').Page | null = null;
        let browserConnectionMode: 'cdp' | 'launched' | null = null;

        try {
          try {
            browser = await chromium.connectOverCDP(MCP_CHROME_CDP_URL);
            const context = browser.contexts()[0];
            page = context.pages()[0] ?? await context.newPage();
            if (!context.pages()[0]) {
              createdPage = page;
            }
            browserConnectionMode = 'cdp';
          } catch {
            browser = await chromium.launch({ headless: true });
            page = await browser.newPage({
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
              locale: 'en-US',
            });
            createdPage = page;
            browserConnectionMode = 'launched';
          }

          rulesParagraphs = await extractRulesTextParagraphsFromLivePage(listingUrl, page);
          if (rulesParagraphs.length > 0) {
            browserFallbackRepairs += 1;
          }
        } finally {
          if (browserConnectionMode === 'launched') {
            await page?.close().catch(() => undefined);
            await browser?.close().catch(() => undefined);
          } else {
            await createdPage?.close().catch(() => undefined);
            await browser?.close().catch(() => undefined);
          }
        }
      }

      if (rulesParagraphs.length === 0) {
        throw new Error('Neither the public HTML nor the rendered browser page exposed rules-text paragraphs.');
      }

      const changed = updateMarkdownRulesText(finding.markdownPath, rulesParagraphs);
      if (changed) {
        repaired += 1;
      } else {
        unchanged += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Failed to repair ${finding.spellId}: ${message}`);
      failed += 1;
    }
  }

  console.log(`Canonical rules blocks repaired: ${repaired}`);
  console.log(`Already matched repaired output: ${unchanged}`);
  console.log(`Repairs that needed browser fallback: ${browserFallbackRepairs}`);
  console.log(`Repair failures: ${failed}`);
}

void main();
