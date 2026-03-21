/**
 * @file buttonAudit.test.ts
 * Design-system conformance audit for button elements.
 *
 * PURPOSE
 * -------
 * Scans every .tsx source file and reports whether raw <button> /
 * <motion.button> elements reference the project's centralised button-style
 * system — either the BTN_* constants in buttonStyles.ts or the shared
 * <Button> component.
 *
 * This test NEVER modifies any code. It is purely an audit report.
 *
 * CATEGORIES (printed in the report)
 * ------------------------------------
 *  ✅  CONFORMING  — no raw buttons; only uses <Button> component
 *  🔶  MIXED       — uses <Button> component AND has some raw <button> elements
 *  📌  CONSTANTS   — raw <button> elements that explicitly use BTN_* constants
 *                    (acceptable; the author opted for lower-level control)
 *  🚫  EXEMPT      — intentionally custom UI; see EXEMPT_FILES below
 *  ❌  NEEDS WORK  — raw <button> with no reference to the button standard
 *
 * WHAT TO DO WITH A "NEEDS WORK" FILE
 * -------------------------------------
 * Option A — Use the <Button> component (preferred):
 *   import { Button } from '../../ui/Button';
 *   <Button variant="primary" size="md" onClick={...}>Label</Button>
 *
 * Option B — Use BTN_* constants on a raw <button> (when you need direct
 *   control, e.g. inside a motion.div that already handles animation):
 *   import { BTN_BASE, BTN_PRIMARY, BTN_SIZE_MD } from '../../styles/buttonStyles';
 *   <button className={`${BTN_BASE} ${BTN_SIZE_MD} ${BTN_PRIMARY}`}>...</button>
 *
 * Option C — Add the file to EXEMPT_FILES with a clear reason (only for
 *   genuinely custom interactive controls that are NOT action buttons).
 *
 * RUNNING THE AUDIT
 * -----------------
 *   npx vitest run src/styles/__tests__/buttonAudit.test.ts
 *
 * The test always passes. The report is printed to the console.
 */

import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Exempt files — intentionally custom interactive controls
// Paths are relative to src/. Add entries here when a raw <button> is
// correct by design and should not be flagged as a violation.
// ---------------------------------------------------------------------------
const EXEMPT_FILES: Record<string, string> = {
  // The component itself — defines <motion.button>, cannot use <Button>
  'components/ui/Button.tsx':
    'IS the Button component definition',

  // Custom list-row toggle — different visual role than an action button
  'components/ui/SelectionList.tsx':
    'Intentional custom toggleable list-row UI element',

  // Window chrome & resize handles — structural, not action buttons
  'components/ui/WindowFrame.tsx':
    'Window chrome resize/drag controls',
  'components/ui/ResizeHandles.tsx':
    'Resize handle knobs — not action buttons',
  'components/Glossary/GlossaryResizeHandles.tsx':
    'Glossary panel resize handles — not action buttons',

  // Specialised battle-map controls with complex state feedback
  'components/BattleMap/AbilityButton.tsx':
    'Ability button with bespoke active/cooldown visual states',
  'components/BattleMap/ActionEconomyBar.tsx':
    'Action economy pip buttons — tiny custom toggle',

  // Party member portrait button in the HUD
  'components/Party/PartyPane/PartyCharacterButton.tsx':
    'Portrait button with portrait image and status overlay',

  // Conversation "choice chip" buttons
  'components/Dialogue/DialogueInterface.tsx':
    'Dialogue choice chips — distinct pill style, not action buttons',

  // Dice roll interactive overlay
  'components/dice/DiceOverlay.tsx':
    'Clickable dice faces — distinct non-action visual',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all production .tsx files under a directory.
 *  Excludes test files (*.test.tsx, __tests__ dirs) and vendor dirs. */
function collectTsxFiles(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skip = ['node_modules', 'dist', '.git', 'coverage', '__tests__'];
      if (skip.includes(entry.name)) continue;
      collectTsxFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      results.push(full);
    }
  }
  return results;
}

/** Return the path relative to src/ using forward slashes (e.g. "components/ui/Button.tsx"). */
function relToSrc(absPath: string): string {
  return path.relative(SRC_ROOT, absPath).replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

/** Matches raw `<button` but NOT `<Button` (case-sensitive). */
const RAW_BUTTON_RE = /<button[\s\n\r>/]/gm;

/** Matches `<motion.button`. */
const MOTION_BUTTON_RE = /<motion\.button[\s\n\r>/]/gm;

/** File imports BTN_* constants from buttonStyles. */
const IMPORTS_BTN_CONSTANTS_RE = /from\s+['"][^'"]*buttonStyles['"]/;

/** File imports the Button component (from ui/Button). */
const IMPORTS_BUTTON_COMPONENT_RE = /from\s+['"][^'"]*(?:\/|\\)ui(?:\/|\\)Button['"]/;

/** File actually uses <Button (the component) in JSX. */
const USES_BUTTON_COMPONENT_RE = /<Button[\s\n\r>/]/m;

/** File references a BTN_* constant by name. */
const USES_BTN_CONSTANT_RE = /\bBTN_[A-Z_]+\b/;

// ---------------------------------------------------------------------------
// Audit types
// ---------------------------------------------------------------------------

type Category =
  | 'conforming'   // ✅  only <Button> component, no raw buttons
  | 'mixed'        // 🔶  <Button> component used AND raw <button> also present
  | 'constants'    // 📌  raw <button> but explicitly uses BTN_* constants
  | 'exempt'       // 🚫  intentional exception (see EXEMPT_FILES)
  | 'needs_work';  // ❌  raw <button>, no standard reference

interface AuditEntry {
  file: string;           // relative to src/
  category: Category;
  rawButtonCount: number; // total raw <button> + <motion.button>
  exemptReason?: string;
}

const CATEGORY_LABEL: Record<Category, string> = {
  conforming: '✅  CONFORMING ',
  mixed:      '🔶  MIXED      ',
  constants:  '📌  CONSTANTS  ',
  exempt:     '🚫  EXEMPT     ',
  needs_work: '❌  NEEDS WORK ',
};

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

// Points at src/ — we only audit production source, not devtools or .claude/
const SRC_ROOT = path.resolve(__dirname, '../..');

function auditFile(absPath: string): AuditEntry {
  const rel   = relToSrc(absPath);
  const src   = fs.readFileSync(absPath, 'utf-8');

  const rawButtonMatches   = src.match(RAW_BUTTON_RE)?.length ?? 0;
  const motionButtonMatches = src.match(MOTION_BUTTON_RE)?.length ?? 0;
  const totalRaw = rawButtonMatches + motionButtonMatches;

  const usesButtonComponent = USES_BUTTON_COMPONENT_RE.test(src);
  const importsBtnConstants = IMPORTS_BTN_CONSTANTS_RE.test(src) || USES_BTN_CONSTANT_RE.test(src);
  const importsButtonComponent = IMPORTS_BUTTON_COMPONENT_RE.test(src);

  // Exempt?
  if (EXEMPT_FILES[rel]) {
    return { file: rel, category: 'exempt', rawButtonCount: totalRaw, exemptReason: EXEMPT_FILES[rel] };
  }

  // No raw buttons — check if it uses the <Button> component properly
  if (totalRaw === 0) {
    // This file has no raw buttons at all — only relevant if it also uses <Button>
    // (Otherwise it's just not a button-heavy file; we still mark it conforming.)
    return { file: rel, category: 'conforming', rawButtonCount: 0 };
  }

  // Has raw buttons — categorise based on standard usage
  if (importsBtnConstants || USES_BTN_CONSTANT_RE.test(src)) {
    // Uses BTN_* constants — technically correct, just lower-level
    return { file: rel, category: 'constants', rawButtonCount: totalRaw };
  }

  if (usesButtonComponent && importsButtonComponent) {
    // Has raw buttons but also uses <Button> — mixed conformance
    return { file: rel, category: 'mixed', rawButtonCount: totalRaw };
  }

  // Raw buttons with no standard reference
  return { file: rel, category: 'needs_work', rawButtonCount: totalRaw };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Button Design System Audit', () => {

  it('reports all raw <button> usage across the codebase (always passes — see console)', () => {
    const allFiles = collectTsxFiles(SRC_ROOT);

    // Run audit on every file that contains a raw button
    const rawButtonFiles = allFiles.filter(f => {
      const src = fs.readFileSync(f, 'utf-8');
      return RAW_BUTTON_RE.test(src) || MOTION_BUTTON_RE.test(src);
    });

    const entries: AuditEntry[] = rawButtonFiles.map(auditFile);

    // Group by category
    const groups: Record<Category, AuditEntry[]> = {
      conforming: [],
      mixed:      [],
      constants:  [],
      exempt:     [],
      needs_work: [],
    };
    for (const e of entries) groups[e.category].push(e);

    // Sort each group by file path
    for (const g of Object.values(groups)) {
      g.sort((a, b) => a.file.localeCompare(b.file));
    }

    // ------------------------------------------------------------------
    // Print report
    // ------------------------------------------------------------------
    const hr = '─'.repeat(80);
    const lines: string[] = [
      '',
      hr,
      ' BUTTON DESIGN SYSTEM AUDIT',
      hr,
    ];

    const printGroup = (cat: Category, items: AuditEntry[]) => {
      if (items.length === 0) return;
      lines.push(`\n  ${CATEGORY_LABEL[cat]}  (${items.length} file${items.length !== 1 ? 's' : ''})`);
      for (const e of items) {
        const extra = e.rawButtonCount > 0 ? `  [${e.rawButtonCount} raw]` : '';
        const reason = e.exemptReason ? `  → ${e.exemptReason}` : '';
        lines.push(`    ${e.file}${extra}${reason}`);
      }
    };

    printGroup('needs_work', groups.needs_work);
    printGroup('mixed',      groups.mixed);
    printGroup('constants',  groups.constants);
    printGroup('exempt',     groups.exempt);
    printGroup('conforming', groups.conforming);

    const needsWorkCount = groups.needs_work.length;
    const totalRawButtons = groups.needs_work.reduce((s, e) => s + e.rawButtonCount, 0)
      + groups.mixed.reduce((s, e) => s + e.rawButtonCount, 0)
      + groups.constants.reduce((s, e) => s + e.rawButtonCount, 0);

    lines.push('');
    lines.push(hr);
    lines.push(` SUMMARY`);
    lines.push(hr);
    lines.push(`  ❌  Needs work        : ${groups.needs_work.length} files  (${totalRawButtons} total raw buttons across all categories)`);
    lines.push(`  🔶  Mixed conformance : ${groups.mixed.length} files`);
    lines.push(`  📌  Using constants   : ${groups.constants.length} files`);
    lines.push(`  🚫  Exempt            : ${groups.exempt.length} files`);
    lines.push(`  ✅  No raw buttons    : ${groups.conforming.length} files`);
    lines.push('');
    lines.push(`  To fix a "Needs work" file:`);
    lines.push(`    • Replace <button> with <Button variant="..." size="..."> from ui/Button`);
    lines.push(`    • Or apply BTN_BASE + BTN_* constants to the className`);
    lines.push(`    • Or add to EXEMPT_FILES in this test file if it is intentionally custom`);
    lines.push(hr);
    lines.push('');

    console.log(lines.join('\n'));

    // This test always passes — it is a report, not an assertion.
    // To add a regression guard that fails when new violations appear,
    // enable the companion test below ("regression guard") and commit
    // the baseline count shown in the summary above.
    expect(needsWorkCount).toBeGreaterThanOrEqual(0); // always true
  });

  // -----------------------------------------------------------------------
  // Optional regression guard
  // Set ENABLE_REGRESSION_GUARD = true and update BASELINE_VIOLATION_COUNT
  // to the "Needs work" number printed above after your first audit run.
  // Once enabled, the test will fail if anyone adds a new unacknowledged
  // raw button — it can only stay the same or improve.
  // -----------------------------------------------------------------------
  const ENABLE_REGRESSION_GUARD = true;
  const BASELINE_VIOLATION_COUNT = 108; // established 2026-03-11 — only reduce this, never increase

  it('regression guard: no new raw-button violations introduced (disabled until baseline is set)', () => {
    if (!ENABLE_REGRESSION_GUARD) {
      console.log(
        '\n  ℹ️  Regression guard is disabled.\n' +
        '     Run the audit above, note the "Needs work" count,\n' +
        '     set BASELINE_VIOLATION_COUNT to that number, and\n' +
        '     set ENABLE_REGRESSION_GUARD = true to activate.\n'
      );
      return; // skip
    }

    const allFiles = collectTsxFiles(SRC_ROOT);
    const rawButtonFiles = allFiles.filter(f => {
      const src = fs.readFileSync(f, 'utf-8');
      return RAW_BUTTON_RE.test(src) || MOTION_BUTTON_RE.test(src);
    });

    const needsWork = rawButtonFiles
      .map(auditFile)
      .filter(e => e.category === 'needs_work');

    expect(
      needsWork.length,
      `New raw-button violations detected (${needsWork.length} > baseline ${BASELINE_VIOLATION_COUNT}).\n` +
      `New files:\n${needsWork.map(e => `  ${e.file}`).join('\n')}\n` +
      `Fix them or add to EXEMPT_FILES.`
    ).toBeLessThanOrEqual(BASELINE_VIOLATION_COUNT);
  });

});
