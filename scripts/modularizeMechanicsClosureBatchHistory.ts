import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * This script splits the spell mechanics closure batch history into small files.
 *
 * The handoff is the active restart surface, while the batch history is an
 * archive of completed slices. Once that archive grows beyond a comfortable
 * review size, this script moves the detailed sections into numbered part files
 * and leaves the main history file as an index. That keeps continuity without
 * making future agents scroll through an oversized tracking document.
 *
 * Called manually during the mechanics-closure modularization checkpoint.
 * Depends on: Node's filesystem APIs only.
 */

// ============================================================================
// Paths And Limits
// ============================================================================
// These constants keep all generated files under the mechanics-discovery folder.
// The line target is intentionally conservative so each part remains easy to
// review in the Codex terminal.
// ============================================================================

const HISTORY_PATH = 'docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_BATCH_HISTORY.md';
const PARTS_DIR = 'docs/tasks/spells/mechanics-discovery/batch-history';
const MAX_LINES_PER_PART = 650;

// ============================================================================
// Markdown Section Parsing
// ============================================================================
// A completed batch always starts with a level-two heading. The parser keeps
// text before the first batch heading as the archive preface and treats each
// following heading block as one movable section.
// ============================================================================

const original = readFileSync(HISTORY_PATH, 'utf8').replace(/\r\n/g, '\n');
const sectionMatches = Array.from(original.matchAll(/^## .+$/gm));

if (sectionMatches.length === 0) {
  throw new Error(`No batch sections found in ${HISTORY_PATH}`);
}

const preface = original.slice(0, sectionMatches[0].index).trimEnd();
const sections = sectionMatches.map((match, index) => {
  const start = match.index ?? 0;
  const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index ?? original.length : original.length;
  const content = original.slice(start, end).trimEnd();
  const title = match[0].replace(/^##\s+/, '').trim();
  return { title, content };
});

// ============================================================================
// Part File Generation
// ============================================================================
// Parts are rebuilt from scratch so repeated runs stay deterministic. Only files
// with the generated part naming pattern are removed.
// ============================================================================

mkdirSync(PARTS_DIR, { recursive: true });
for (const file of readdirSync(PARTS_DIR)) {
  if (/^MECHANICS_CLOSURE_BATCH_HISTORY_PART_\d+\.md$/.test(file)) {
    rmSync(join(PARTS_DIR, file));
  }
}

const parts: { file: string; titles: string[]; content: string }[] = [];
let currentSections: typeof sections = [];
let currentLineCount = 0;

const flushPart = () => {
  if (currentSections.length === 0) {
    return;
  }
  const partNumber = String(parts.length + 1).padStart(2, '0');
  const file = `MECHANICS_CLOSURE_BATCH_HISTORY_PART_${partNumber}.md`;
  const titles = currentSections.map((section) => section.title);
  const body = currentSections.map((section) => section.content).join('\n\n');
  const content = `# Mechanics Closure Batch History Part ${partNumber}\n\n${body}\n`;
  writeFileSync(join(PARTS_DIR, file), content, 'utf8');
  parts.push({ file, titles, content });
  currentSections = [];
  currentLineCount = 0;
};

for (const section of sections) {
  const sectionLines = section.content.split('\n').length + 2;
  if (currentSections.length > 0 && currentLineCount + sectionLines > MAX_LINES_PER_PART) {
    flushPart();
  }
  currentSections.push(section);
  currentLineCount += sectionLines;
}
flushPart();

// ============================================================================
// Index Rewrite
// ============================================================================
// The main history file becomes a concise table of contents. The detailed text
// remains nearby in numbered part files.
// ============================================================================

const indexLines = [
  preface || '# Spell Mechanics Closure Batch History',
  '',
  'This file is an index for completed mechanics-closure batch history. Detailed batch notes were split into numbered part files once the archive crossed the review-size threshold.',
  '',
  '## Batch History Parts',
  '',
  ...parts.flatMap((part) => [
    `- [${basename(part.file, '.md')}](batch-history/${part.file})`,
    `  - Covers: ${part.titles[0]} through ${part.titles[part.titles.length - 1]}`,
  ]),
  '',
];

writeFileSync(HISTORY_PATH, `${indexLines.join('\n')}`, 'utf8');

console.log(`Split ${sections.length} batch sections into ${parts.length} part files.`);
console.log(`Updated ${HISTORY_PATH} as an index.`);
