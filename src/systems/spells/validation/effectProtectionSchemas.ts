// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 06:33:35
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
 * This file validates effect-local protection and damage-interaction rules.
 *
 * These shapes are shared by several effect families, but they are not the core
 * spell identity, targeting, or damage packet themselves. Keeping them here
 * prevents `spellValidator.ts` from becoming a single oversized file while
 * preserving the same runtime JSON contract.
 *
 * Called by: `spellValidator.ts`.
 * Depends on: Zod only; it does not load spell data or runtime systems.
 */

// ============================================================================
// Barrier And Spell-Effect Prevention
// ============================================================================
// This section covers mechanics that stop damage or spell effects before normal
// damage resolution. They are separate from resistance because they depend on
// a barrier boundary or spell-level threshold instead of modifying damage taken.
// ============================================================================

export const BarrierDamagePrevention = z.object({
  // Barrier prevention blocks harm because of where the source and protected
  // target sit relative to a barrier. Otiluke's Resilient Sphere is the pilot:
  // outside attacks/effects cannot damage inside targets, and inside creatures
  // cannot damage outside targets.
  blockDirections: z.array(z.enum(["outside_to_inside", "inside_to_outside", "both"])),
  sourceCategories: z.array(z.enum(["attack", "effect", "spell", "object", "energy"])).optional(),
  protectedSubjects: z.array(z.enum(["inside_creature_or_object", "outside_targets", "barrier_itself"])).optional(),
});

export const SpellEffectPrevention = z.object({
  // Spell-effect prevention blocks spells before their normal damage, status,
  // or area rules apply. Globe of Invulnerability is the pilot case: outside
  // spells at or below a threshold cannot affect anything inside the globe.
  sourceSide: z.enum(["outside", "inside", "any"]),
  maxSpellLevel: z.number(),
  affectedSubjects: z.array(z.enum(["creatures", "objects", "areas", "anything_inside"])),
  excludesAreaOfEffect: z.boolean().optional(),
  scaling: z.object({
    type: z.enum(["slot_level_threshold_bonus"]),
    baseSlotLevel: z.number(),
    bonusPerSlotLevel: z.number(),
  }).optional(),
});

export const DeathPrevention = z.object({
  // Death prevention is a last-moment safeguard rather than resistance,
  // healing, or immunity. Death Ward is the pilot: the ward can either stop the
  // target from reaching 0 HP or negate an instant-death effect, then the spell
  // is consumed.
  triggers: z.array(z.enum(["drop_to_0_hp", "instant_death_no_damage"])),
  dropToHitPoints: z.union([z.number(), z.literal("not_applicable")]),
  negatesInstantDeathWithoutDamage: z.boolean(),
  consumption: z.enum(["first_trigger_ends_spell", "not_applicable"]),
  scope: z.enum(["target", "not_applicable"]),
});

// ============================================================================
// Damage Sharing And Damage Interaction
// ============================================================================
// This section captures effects that change how damage relates to a target
// after the spell has found its target: shared damage, suppressed resistance,
// and area/mode-based resistance or vulnerability choices.
// ============================================================================

export const LinkedDamage = z.object({
  // Linked damage mirrors damage from one participant to another. Warding Bond
  // is the pilot: each time the warded target takes damage, the caster takes
  // the same amount of damage.
  trigger: z.enum(["target_takes_damage"]),
  recipient: z.enum(["caster", "target", "linked_creature"]),
  amount: z.enum(["same_amount"]),
  // The basis and mitigation policy prevent double-applying resistance or
  // vulnerability when the linked recipient also has defenses or weaknesses.
  amountBasis: z.enum(["post_target_mitigation"]).optional(),
  damageTypeSource: z.enum(["triggering_damage_type", "untyped"]).optional(),
  recipientMitigation: z.enum(["not_reapplied", "apply_recipient_mitigation"]).optional(),
});

export const ResistanceSuppression = z.object({
  // Resistance suppression removes an existing resistance from the affected
  // target without granting damage to the caster or changing immunity rules.
  // Elemental Bane is the pilot: the failed-save target loses resistance to the
  // caster's chosen damage type until the spell ends.
  damageType: z.array(z.string()),
  damageTypeSource: z.enum(["listed", "chosen_damage_type", "triggering_damage_type"]),
});

export const DamageInteraction = z.object({
  // Damage interaction covers area or mode choices that change how targets
  // receive damage, including vulnerability. It is separate from DefensiveEffect
  // because not every interaction is protective.
  modes: z.array(z.enum(["resistance", "vulnerability"])),
  damageType: z.array(z.string()),
  damageTypeSource: z.enum(["listed", "chosen_damage_type", "triggering_damage_type"]),
  subjectScope: z.enum(["chosen_creature_types", "all_targets", "not_applicable"]).optional(),
  durationScope: z.enum(["while_in_area", "while_active", "permanent"]).optional(),
});
