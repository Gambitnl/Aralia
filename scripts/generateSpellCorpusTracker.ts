import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script generates the corpus-wide spell review tracker.
 *
 * The owner asked for a single execution surface that lists every spell in the
 * corpus, groups them by level, and gives each spell a checkbox so the whole
 * spell-truth project can be worked from start to finish without losing coverage.
 *
 * The tracker this script writes is intentionally broad:
 * - every spell JSON file in the corpus is listed
 * - all spells start as unchecked unless a future explicit promotion rule marks
 *   them complete
 * - the file also includes a staged plan so the checklist has a clear workflow
 *
 * Called manually by: Codex during the spell-truth corpus expansion lane
 * Writes: `docs/tasks/spells/SPELL_CORPUS_EXECUTION_TRACKER.md`
 */

// ============================================================================
// Paths
// ============================================================================
// This section keeps the tracker generator independent from the caller's current
// directory. The script resolves the spell-data root and the tracker output path
// from the script location itself.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const TRACKER_OUT = path.resolve(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_CORPUS_EXECUTION_TRACKER.md');

interface SpellEntry {
  levelFolder: string;
  levelNumber: number;
  id: string;
  name: string;
}

// ============================================================================
// Corpus Discovery
// ============================================================================
// This section walks the spell level folders and extracts the spell identity
// from each JSON file. The tracker should reflect the current live corpus, so
// the JSON files are the source for the list rather than a hand-maintained array.
// ============================================================================

function listSpellEntries(): SpellEntry[] {
  const entries: SpellEntry[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelFolder = `level-${level}`;
    const levelDir = path.join(SPELL_JSON_ROOT, levelFolder);
    if (!fs.existsSync(levelDir)) continue;

    const files = fs.readdirSync(levelDir)
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const filePath = path.join(levelDir, file);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;

      entries.push({
        levelFolder,
        levelNumber: level,
        id: typeof parsed.id === 'string' ? parsed.id : path.basename(file, '.json'),
        name: typeof parsed.name === 'string' ? parsed.name : path.basename(file, '.json'),
      });
    }
  }

  return entries;
}

// ============================================================================
// Tracker Rendering
// ============================================================================
// This section turns the live spell corpus into a human-usable checklist file.
// The file begins with a staged plan because the owner asked for the whole corpus
// effort to be approached through a structured plan rather than an unbounded pile
// of unchecked boxes.
//
// Important rule:
// all spells are emitted as unchecked here. A spell should only be checked off
// when its intended "done" definition has been satisfied explicitly during the
// spell-truth workflow. This script does not guess completion from partial work.
// ============================================================================

function renderTracker(entries: SpellEntry[]): string {
  const lines: string[] = [
    '# Spell Corpus Execution Tracker',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total Spells In Corpus: ${entries.length}`,
    '',
    'This tracker is the corpus-wide execution surface for the spell-truth lane.',
    '',
    'A spell should only be checked off when its current intended review scope is complete. For now, that means the checkbox is a strict gate rather than a loose progress marker.',
    '',
    '## Execution Plan',
    '',
    '1. Run corpus-wide structural validation and keep it green.',
    '2. Review spells level by level so the corpus can be completed end-to-end without losing track of coverage.',
    '3. For each spell, verify canon-facing top-level facts first, then preserve JSON/markdown alignment.',
    '4. Surface grouped mismatches for arbitration instead of silently inventing fixes.',
    '5. Check a spell off only when the current review scope for that spell is complete.',
    '',
    '## Completion Rule',
    '',
    '- `[ ]` means the spell still needs corpus-lane review or still has unresolved spell-truth work.',
    '- `[x]` means the spell has completed the current intended spell-truth review scope and should not re-enter the queue unless a new mismatch is discovered later.',
    '',
    '## Spell Checklist',
    '',
  ];

  for (let level = 0; level <= 9; level += 1) {
    const levelEntries = entries.filter((entry) => entry.levelNumber === level);
    if (levelEntries.length === 0) continue;

    lines.push(`### Level ${level} (${levelEntries.length})`, '');

    for (const entry of levelEntries) {
      lines.push(`- [ ] ${entry.name} \`${entry.levelFolder}/${entry.id}\``);
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

// ============================================================================
// Execution
// ============================================================================
// This section generates the tracker content and writes it to the docs task lane.
// Keeping the tracker generated avoids hand-maintained drift in the corpus list.
// ============================================================================

function main(): void {
  const entries = listSpellEntries();
  const content = renderTracker(entries);
  fs.writeFileSync(TRACKER_OUT, content, 'utf8');
  console.log(`Wrote spell corpus tracker to ${TRACKER_OUT}`);
  console.log(`Tracked ${entries.length} spells.`);
}

main();
