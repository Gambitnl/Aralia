// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 06:36:30
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines protection-related spell effect metadata.
 *
 * These types describe defensive and damage-interaction rules that are more
 * specific than a basic damage roll, healing roll, or condition. The main
 * spell type file imports these shapes so new warding, resistance, prevention,
 * and damage-sharing mechanics can grow here instead of making `spells.ts`
 * harder to review after every mechanics-discovery batch.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime data; this is a type-only metadata module.
 */

// ============================================================================
// Barrier And Spell-Effect Prevention
// ============================================================================
// These types stop effects before ordinary damage math happens. They are
// separate from resistance because the runtime needs to know why the harm is
// blocked: a barrier boundary, a spell-level threshold, or a death ward.
// ============================================================================

/** Damage blocked because it crosses a spell barrier rather than because of resistance. */
export interface BarrierDamagePrevention {
  /** Which direction of travel across the barrier is blocked. */
  blockDirections: ("outside_to_inside" | "inside_to_outside" | "both")[];
  /** Which source categories the barrier can stop. */
  sourceCategories?: ("attack" | "effect" | "spell" | "object" | "energy")[];
  /** Which subjects are protected by the barrier rule. */
  protectedSubjects?: ("inside_creature_or_object" | "outside_targets" | "barrier_itself")[];
}

/** Spell effects blocked before they can affect protected targets or areas. */
export interface SpellEffectPrevention {
  /** Whether the blocked spell comes from outside, inside, or either side. */
  sourceSide: "outside" | "inside" | "any";
  /** Highest spell level blocked by the protection. */
  maxSpellLevel: number;
  /** Which subjects the prevention rule protects. */
  affectedSubjects: ("creatures" | "objects" | "areas" | "anything_inside")[];
  /** True when area effects are explicitly excluded from the prevention. */
  excludesAreaOfEffect?: boolean;
  /** Slot-scaling rule for spell-level thresholds that rise with upcasting. */
  scaling?: {
    type: "slot_level_threshold_bonus";
    baseSlotLevel: number;
    bonusPerSlotLevel: number;
  };
}

/** Last-moment safeguards that prevent a creature from dying and may consume the spell. */
export interface DeathPrevention {
  /** Which death events the ward can intercept. */
  triggers: ("drop_to_0_hp" | "instant_death_no_damage")[];
  /** Replacement hit point total after a prevented 0 HP drop, or not applicable for instant-death-only effects. */
  dropToHitPoints: number | "not_applicable";
  /** True when the ward negates an effect that would kill without dealing damage. */
  negatesInstantDeathWithoutDamage: boolean;
  /** Whether using the safeguard consumes the spell or leaves it active. */
  consumption: "first_trigger_ends_spell" | "not_applicable";
  /** Who receives the death-prevention benefit. */
  scope: "target" | "not_applicable";
}

// ============================================================================
// Damage Sharing And Damage Interaction
// ============================================================================
// These types alter how damage relates to a protected or linked target after a
// damage event exists. They intentionally do not create new damage rolls by
// themselves.
// ============================================================================

/** Damage mirrored from one linked participant to another. */
export interface LinkedDamage {
  /** Damage event that causes the linked damage to happen. */
  trigger: "target_takes_damage";
  /** Who receives the linked damage. */
  recipient: "caster" | "target" | "linked_creature";
  /** How much linked damage is copied from the triggering event. */
  amount: "same_amount";
  /** Which damage total is copied, such as after the original target's mitigation. */
  amountBasis?: "post_target_mitigation";
  /** Whether the linked damage keeps the triggering damage type or becomes untyped. */
  damageTypeSource?: "triggering_damage_type" | "untyped";
  /** Whether the recipient applies their own mitigation again to the linked amount. */
  recipientMitigation?: "not_reapplied" | "apply_recipient_mitigation";
}

/** Temporary removal of a target's resistance to one or more damage types. */
export interface ResistanceSuppression {
  /** Damage types whose resistance is suppressed. */
  damageType: string[];
  /** Where the affected damage type list comes from. */
  damageTypeSource: "listed" | "chosen_damage_type" | "triggering_damage_type";
}

/** Area or mode-based changes to damage interaction, such as Hallow resistance/vulnerability choices. */
export interface DamageInteraction {
  /** Which damage interactions the spell creates. */
  modes: ("resistance" | "vulnerability")[];
  /** Damage types affected by the interaction. */
  damageType: string[];
  /** Where the affected damage type list comes from. */
  damageTypeSource: "listed" | "chosen_damage_type" | "triggering_damage_type";
  /** Which subjects receive the interaction. */
  subjectScope?: "chosen_creature_types" | "all_targets" | "not_applicable";
  /** How long or where the interaction remains active. */
  durationScope?: "while_in_area" | "while_active" | "permanent";
}
