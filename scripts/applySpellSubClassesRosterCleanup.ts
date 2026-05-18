import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cleanup companion to `auditSpellSubClassesRoster.ts`.
 *
 * Reads the audit JSON report and rewrites or inserts each affected spell's
 * `- **Sub-Classes**:` line.
 *
 * Modes (flags can combine):
 *   --apply         actually write changes (default is dry-run)
 *   --markers       also apply recommended markers (Folded into Classes /
 *                   Unsupported Entries / No Subclass Entries) to spells
 *                   without roster-supported access
 *
 * Default targets (no --markers):
 *   - needs_strip  rewrite line to roster-clean expected set
 *   - needs_both   rewrite line (handles None placeholder + missing add)
 *
 * With --markers, additionally:
 *   - no_supported_access   rewrite Sub-Classes line to the recommended marker
 *   - empty_field            rewrite Sub-Classes line to the recommended marker
 *   - no_field               INSERT a Sub-Classes line after Classes with the marker
 *
 * Untouched in all modes:
 *   - roster_clean          no edit needed
 *   - no_canonical_block    pre-existing data issue
 *   - needs_add             no current rows have this kind; would be transfer
 *                           work not handled by this script
 *
 * Run:
 *   npm run audit:sub-classes-roster                                # refresh the report first
 *   npx tsx scripts/applySpellSubClassesRosterCleanup.ts            # dry-run, strip mode only
 *   npx tsx scripts/applySpellSubClassesRosterCleanup.ts --apply    # write, strip mode only
 *   npx tsx scripts/applySpellSubClassesRosterCleanup.ts --markers  # dry-run, strip + markers
 *   npm run cleanup:sub-classes-roster -- --apply --markers         # write, full
 *
 * After --apply, re-run the audit to verify zero needs_strip / needs_both
 * (and zero no_supported_access / no_field / empty_field if --markers was set).
 */

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR  = path.dirname(SCRIPT_FILE);
const REPO_ROOT   = path.resolve(SCRIPT_DIR, '..');

const REPORT_JSON_PATH = path.join(
  REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation',
  'spell-sub-classes-roster-report.json',
);

type Marker = 'Folded into Classes' | 'Unsupported Entries' | 'No Subclass Entries';

interface SpellRecord {
  spellId:            string;
  level:              number;
  mdPath:             string;
  classes:            string[];
  structuredEntries:  string[];
  canonicalEntries:   string[];
  expectedEntries:    string[];
  toStrip:            string[];
  toAdd:              string[];
  matchKind:          string;
  recommendedMarker?: Marker;
  note:               string;
}

interface RosterReport {
  generatedAt:  string;
  scannedFiles: number;
  records:      SpellRecord[];
}

function loadReport(): RosterReport {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(
      `Audit report not found at ${REPORT_JSON_PATH}. Run \`npm run audit:sub-classes-roster\` first.`,
    );
  }
  return JSON.parse(fs.readFileSync(REPORT_JSON_PATH, 'utf8'));
}

/**
 * Replace the value of an existing `- **Sub-Classes**:` line. Returns null
 * if no such line exists in the structured block.
 */
function rewriteSubClassesLine(markdown: string, newValue: string): string | null {
  const re = /^(-\s+\*\*Sub-Classes\*\*:\s*)(.*)$/m;
  if (!re.test(markdown)) return null;
  return markdown.replace(re, (_full, prefix: string) => `${prefix}${newValue}`);
}

/**
 * Insert a new `- **Sub-Classes**: <value>` line immediately after the
 * `- **Classes**: ...` line. Returns null if no Classes line is found.
 */
function insertSubClassesLine(markdown: string, value: string): string | null {
  const re = /^(-\s+\*\*Classes\*\*:[^\n]*)$/m;
  if (!re.test(markdown)) return null;
  return markdown.replace(re, (full) => `${full}\n- **Sub-Classes**: ${value}`);
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const markersMode = process.argv.includes('--markers');
  const report = loadReport();

  const stripTargets = report.records.filter(
    (r) => r.matchKind === 'needs_strip' || r.matchKind === 'needs_both',
  );

  const markerTargets = markersMode
    ? report.records.filter(
        (r) =>
          (r.matchKind === 'no_supported_access'
            || r.matchKind === 'no_field'
            || r.matchKind === 'empty_field')
          && !!r.recommendedMarker,
      )
    : [];

  const totalTargets = stripTargets.length + markerTargets.length;

  /* eslint-disable no-console */
  console.log(
    `Cleanup target: ${totalTargets} spells (${apply ? 'APPLY' : 'DRY-RUN'}, ${markersMode ? 'STRIP + MARKERS' : 'STRIP ONLY'})`,
  );
  console.log(`  Strip group: ${stripTargets.length}`);
  if (markersMode) console.log(`  Marker group: ${markerTargets.length}`);
  console.log('');

  let edited = 0;
  let skipped = 0;
  const failures: string[] = [];

  // --- Strip group ---------------------------------------------------------
  if (stripTargets.length > 0) {
    console.log('-- Strip / rewrite group --');
  }
  for (const r of stripTargets) {
    const fullPath = path.join(REPO_ROOT, r.mdPath);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${r.spellId}: file not found at ${r.mdPath}`);
      continue;
    }
    const md = fs.readFileSync(fullPath, 'utf8');
    const newValue = r.expectedEntries.join(', ');
    const next = rewriteSubClassesLine(md, newValue);
    if (next == null) {
      failures.push(`${r.spellId}: no Sub-Classes line found in ${r.mdPath}`);
      continue;
    }
    if (next === md) {
      skipped++;
      console.log(`  ${r.spellId.padEnd(28)} skipped (already matches expected)`);
      continue;
    }
    console.log(
      `  ${r.spellId.padEnd(28)} -> [${newValue || '(empty)'}]`,
    );
    if (apply) fs.writeFileSync(fullPath, next);
    edited++;
  }

  // --- Marker group --------------------------------------------------------
  if (markerTargets.length > 0) {
    console.log('');
    console.log('-- Marker group --');
  }
  const markerCounts: Record<Marker, number> = {
    'Folded into Classes': 0,
    'Unsupported Entries': 0,
    'No Subclass Entries': 0,
  };
  for (const r of markerTargets) {
    const marker = r.recommendedMarker!;
    const fullPath = path.join(REPO_ROOT, r.mdPath);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${r.spellId}: file not found at ${r.mdPath}`);
      continue;
    }
    const md = fs.readFileSync(fullPath, 'utf8');
    let next: string | null;
    if (r.matchKind === 'no_field') {
      next = insertSubClassesLine(md, marker);
      if (next == null) {
        failures.push(`${r.spellId}: no Classes line to anchor insertion in ${r.mdPath}`);
        continue;
      }
    } else {
      // no_supported_access or empty_field - line exists, rewrite value
      next = rewriteSubClassesLine(md, marker);
      if (next == null) {
        failures.push(`${r.spellId}: no Sub-Classes line found in ${r.mdPath}`);
        continue;
      }
    }
    if (next === md) {
      skipped++;
      console.log(`  ${r.spellId.padEnd(28)} skipped (already matches marker)`);
      continue;
    }
    console.log(`  ${r.spellId.padEnd(28)} -> [${marker}]   (${r.matchKind})`);
    markerCounts[marker]++;
    if (apply) fs.writeFileSync(fullPath, next);
    edited++;
  }

  console.log('');
  console.log(`Edited: ${edited}    Skipped: ${skipped}    Failed: ${failures.length}`);
  if (markersMode) {
    console.log('');
    console.log('Marker distribution (this run):');
    for (const [m, c] of Object.entries(markerCounts)) {
      console.log(`  ${m.padEnd(22)} ${c}`);
    }
  }
  if (failures.length) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log(`  ${f}`);
  }
  if (!apply) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to write the changes.');
  } else {
    console.log('');
    console.log('Re-run `npm run audit:sub-classes-roster` to verify.');
  }
  /* eslint-enable no-console */
}

main();
