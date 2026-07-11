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
 * The report case always passes. Its companion guard enforces a reviewed path
 * manifest: new debt fails immediately, while fixed paths leave the inventory.
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

// Internal review/authoring surfaces (non-gameplay UI) are intentionally exempt
// from production button audit constraints unless they start driving product flows.
const EXEMPT_DIR_PREFIXES = ['components/DesignPreview/'];

function getExemptReason(relPath: string): string | undefined {
  if (EXEMPT_FILES[relPath]) return EXEMPT_FILES[relPath];
  if (EXEMPT_DIR_PREFIXES.some(prefix => relPath.startsWith(prefix))) {
    return 'DesignPreview authoring surface: preview-only UI, not gameplay product flow';
  }
  return undefined;
}

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

/**
 * Presence checks deliberately omit the global flag. Reusing a global RegExp
 * with `.test()` carries `lastIndex` from one file into the next, which made
 * unchanged-tree audit totals depend on traversal order.
 */
const HAS_RAW_BUTTON_RE = /<button[\s\n\r>/]/m;
const HAS_MOTION_BUTTON_RE = /<motion\.button[\s\n\r>/]/m;

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
  const exemptReason = getExemptReason(rel);
  if (exemptReason) {
    return { file: rel, category: 'exempt', rawButtonCount: totalRaw, exemptReason };
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

/** The tracked JSON keeps known UI debt reviewable without hiding new files. */
interface ButtonDebtManifest {
  _comment: string;
  reviewedNeedsWorkPaths: string[];
}

/** Differences between today's scan and the reviewed debt path set. */
interface ButtonDebtComparison {
  newPaths: string[];
  resolvedPaths: string[];
}

/** Return whether a source file contains either supported raw-button form. */
function containsRawButton(src: string): boolean {
  return HAS_RAW_BUTTON_RE.test(src) || HAS_MOTION_BUTTON_RE.test(src);
}

/**
 * Read the human-reviewed debt inventory beside this test. Keeping it in JSON
 * makes migrations visible as one-path additions or removals in code review.
 */
function readButtonDebtManifest(): ButtonDebtManifest {
  const manifestPath = path.resolve(__dirname, 'buttonAuditDebt.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ButtonDebtManifest;
}

/**
 * Compare sets in sorted order so filesystem traversal and manifest ordering
 * cannot change which paths the policy reports.
 */
function compareReviewedDebt(
  currentPaths: string[],
  reviewedPaths: string[],
): ButtonDebtComparison {
  const current = new Set(currentPaths);
  const reviewed = new Set(reviewedPaths);

  return {
    newPaths: [...current].filter(file => !reviewed.has(file)).sort(),
    resolvedPaths: [...reviewed].filter(file => !current.has(file)).sort(),
  };
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
      return containsRawButton(src);
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
    // The companion guard below compares exact reviewed paths, so this report
    // can remain informational without weakening new-debt enforcement.
    expect(needsWorkCount).toBeGreaterThanOrEqual(0); // always true
  });

  // -----------------------------------------------------------------------
  // Reviewed debt guard
  // The manifest names every currently accepted path. A new path cannot hide
  // behind an unrelated migration elsewhere, and a resolved path must be
  // removed so the inventory shrinks alongside the real UI debt.
  // -----------------------------------------------------------------------
  const ENABLE_REVIEWED_DEBT_GUARD = true;

  it('reviewed debt guard: no new or silently resolved raw-button paths', () => {
    if (!ENABLE_REVIEWED_DEBT_GUARD) {
      console.log(
        '\n  ℹ️  Regression guard is disabled.\n' +
        '     Run the audit above and review buttonAuditDebt.json, then\n' +
        '     set ENABLE_REVIEWED_DEBT_GUARD = true to activate.\n'
      );
      return; // skip
    }

    const allFiles = collectTsxFiles(SRC_ROOT);
    const rawButtonFiles = allFiles.filter(f => {
      const src = fs.readFileSync(f, 'utf-8');
      return containsRawButton(src);
    });

    const needsWork = rawButtonFiles
      .map(auditFile)
      .filter(e => e.category === 'needs_work');
    const manifest = readButtonDebtManifest();
    const reviewedPaths = manifest.reviewedNeedsWorkPaths;
    const currentPaths = needsWork.map(entry => entry.file);
    const { newPaths, resolvedPaths } = compareReviewedDebt(currentPaths, reviewedPaths);

    // Sorted unique paths keep the manifest stable and easy to review.
    expect(reviewedPaths).toEqual(
      [...new Set(reviewedPaths)].sort((a, b) => a.localeCompare(b)),
    );
    expect(
      newPaths,
      `New raw-button debt must be fixed, explicitly exempted, or reviewed into buttonAuditDebt.json:\n${newPaths.map(file => `  ${file}`).join('\n')}`,
    ).toEqual([]);
    expect(
      resolvedPaths,
      `Resolved raw-button paths must be removed from buttonAuditDebt.json:\n${resolvedPaths.map(file => `  ${file}`).join('\n')}`,
    ).toEqual([]);
  });

  it('reviewed debt comparison catches both a new path and a resolved path', () => {
    // Reverse the current order deliberately: set comparison must remain stable
    // while still identifying both directions of manifest drift.
    const comparison = compareReviewedDebt(
      ['components/NewButton.tsx', 'components/StillKnown.tsx'],
      ['components/ResolvedButton.tsx', 'components/StillKnown.tsx'],
    );

    expect(comparison).toEqual({
      newPaths: ['components/NewButton.tsx'],
      resolvedPaths: ['components/ResolvedButton.tsx'],
    });
  });

});
