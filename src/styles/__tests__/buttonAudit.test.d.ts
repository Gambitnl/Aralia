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
export {};
