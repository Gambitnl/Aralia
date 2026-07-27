/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 04:28:53
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { z } from 'zod';
/**
 * This file validates reusable status-condition vocabulary for spell effects.
 *
 * The full status condition object still lives in `spellValidator.ts` because
 * it depends on effect-duration, escape-check, and repeat-save schemas defined
 * there. This module owns the shared break-trigger enum so new condition-break
 * mechanics do not keep expanding the main validator directly.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only.
 */
export declare const ConditionBreakTrigger: z.ZodEnum<{
    target_takes_damage: "target_takes_damage";
    adjacent_creature_action_shakes_awake: "adjacent_creature_action_shakes_awake";
    caster_makes_attack_roll: "caster_makes_attack_roll";
    caster_deals_damage: "caster_deals_damage";
    caster_forces_save: "caster_forces_save";
    concentration_ends: "concentration_ends";
    duration_expires: "duration_expires";
}>;
