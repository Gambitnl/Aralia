/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 15/07/2026, 22:29:48
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '../../../types/spells';
/**
 * SpellIntegrityValidator
 *
 * This file is a quality-control auditor for spell JSON data. It runs a fixed
 * set of mechanical rules against any given spell and returns a list of problems
 * it found. If the list is empty, the spell passed every check.
 *
 * Why it exists: Aralia's spells are stored as structured JSON files, and many
 * were created during early prototyping before the engine's data standards were
 * fully established. Without automated checks, bad data — like a Concentration
 * spell missing its tag, or a complex multi-damage spell packed into a single
 * generic UTILITY effect block — would slip through silently and break combat
 * resolution at runtime.
 *
 * How it fits in: This validator is called by the regression test suite
 * (SpellIntegrityValidator.test.ts). The tests load every real spell JSON file
 * from public/data/spells/ and run them through this validator. Some rules emit
 * only warnings (the hit list is printed to the console); others are enforced
 * as hard failures that will block CI.
 *
 * Adding a new rule: add a numbered block inside validate() following the same
 * pattern. Give it a descriptive push() message — the test suite filters on
 * that exact string to decide which rule caused each failure.
 */
export declare class SpellIntegrityValidator {
    /**
     * Returns classified restricted-filter mismatches with the explanation needed
     * by future audit, validation, and UI/debug surfaces.
     *
     * Each detail names the exact spell/effect/filter row, groups it into a
     * semantic family, and explains why copying the spell-level target filter
     * would be misleading until a more specific model exists. Keeping this in the
     * validator makes the executable rule and the human-facing reason share one
     * source of truth.
     */
    static getClassifiedRestrictedFilterMismatchDetails(): Array<{
        key: string;
        category: string;
        reason: string;
    }>;
    /**
     * Returns the restricted-filter mismatches that are known semantic exceptions,
     * not direct data omissions.
     *
     * These rows stay visible here because their spell-level filter describes a
     * different thing than a normal direct effect target: plant or object
     * eligibility, a chosen aura source, a later repair target, an ongoing area
     * rule, or a form-choice rule. The validator and the corpus regression both
     * use this list so spell JSON validation and tests do not drift apart.
     */
    static getClassifiedRestrictedFilterMismatchKeys(): string[];
    /**
     * Validates a spell against systematic integrity rules.
     * Returns a list of error message strings. An empty array means the spell
     * passed all checks.
     */
    static validate(spell: Spell): string[];
}
