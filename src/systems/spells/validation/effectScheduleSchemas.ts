// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 02:35:30
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';

/**
 * This file validates turn- and phase-based spell effect schedules.
 *
 * Some spells do not merely repeat one effect every turn. Storm of Vengeance is
 * the pilot case: the later caster turns have different damage types, a distinct
 * six-target lightning stage, and an area-control stage that spans several
 * turns. The normal effect array still stores the actual damage or terrain
 * packets; this schedule records when those packets become active.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Scheduled Stage Targeting
// ============================================================================
// This section captures target rules that belong to a particular scheduled
// stage. It is intentionally narrower than the full spell targeting block: it
// only answers questions like "all creatures in the area" or "six different
// creatures or objects" for that one stage.
// ============================================================================

const EffectScheduleTargeting = z.object({
  count: z.union([z.number(), z.literal("all")]),
  validTargets: z.enum(["creatures", "objects", "creature_or_object"]),
  selection: z.enum(["caster_choice", "all_valid_targets"]),
  mustBeDifferent: z.boolean().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// Effect Schedule
// ============================================================================
// A schedule entry names a turn window and points back to the effect array
// entries that execute during that window. This keeps scheduling separate from
// damage/status payloads, so existing effect processing can grow into the
// schedule without having to reinterpret prose.
// ============================================================================

export const EffectSchedule = z.object({
  timing: z.enum(["caster_later_turn_start"]),
  entries: z.array(z.object({
    label: z.string(),
    timing: z.enum(["caster_turn_start"]),
    turnStart: z.number(),
    turnEnd: z.number().optional(),
    effectIndices: z.array(z.number()).optional(),
    effectTypes: z.array(z.string()),
    targeting: EffectScheduleTargeting.optional(),
    summary: z.string(),
    notes: z.string().optional(),
  })),
  notes: z.string().optional(),
});
