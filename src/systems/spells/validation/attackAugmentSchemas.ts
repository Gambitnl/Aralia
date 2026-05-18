// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 03:25:09
 * Dependents: systems/spells/validation/spellValidator.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file validates spell effects that change weapon attacks.
 *
 * It exists because attack-augment mechanics are growing beyond a tiny
 * additional-damage rider. Shillelagh and True Strike need to preserve weapon
 * prerequisites, spellcasting ability substitution, damage die changes, and
 * caster damage-type choices without making the central spell validator harder
 * to review.
 *
 * Called by: `spellValidator.ts` when validating utility effects.
 * Depends on: only Zod, so this validator slice can be changed independently.
 */

import { z } from 'zod';

// ============================================================================
// Local Shared Shapes
// ============================================================================
// These mirror the existing runtime damage/scaling shapes closely enough for
// attack augments without importing from the main validator and creating a cycle.
// ============================================================================

const DamageData = z.object({
  dice: z.string(),
  type: z.string(),
});

const ScalingFormula = z.object({
  type: z.enum(["slot_level", "character_level", "custom"]),
  bonusPerLevel: z.string().optional(),
  customFormula: z.string().optional(),
  scalingTiers: z.record(z.string(), z.string()).optional(),
});

// ============================================================================
// Attack Augment Schema
// ============================================================================
// This schema keeps weapon-attack changes explicit. It can describe both a
// persistent weapon enchantment, such as Shillelagh, and an immediate spell-made
// weapon attack, such as True Strike.
// ============================================================================

export const AttackAugment = z.object({
  attackType: z.enum(["weapon", "melee_weapon", "ranged_weapon"]),
  weaponRequirement: z.object({
    weaponTypes: z.array(z.enum(["club", "quarterstaff", "pebble", "sling", "any_weapon", "proficient_weapon"])),
    proficiencyRequired: z.boolean().optional(),
    minimumValueCp: z.number().optional(),
    heldByCaster: z.boolean().optional(),
    notes: z.string().optional(),
  }).optional(),
  grantedAttack: z.object({
    timing: z.enum(["during_cast", "while_active"]),
    count: z.literal(1),
    usesCastingWeapon: z.boolean(),
    notes: z.string().optional(),
  }).optional(),
  abilitySubstitution: z.object({
    attackRoll: z.enum(["spellcasting_ability"]).optional(),
    damageRoll: z.enum(["spellcasting_ability"]).optional(),
    replaces: z.array(z.enum(["Strength", "Dexterity"])).optional(),
  }).optional(),
  damageDieOverride: z.object({
    dice: z.string(),
    scaling: ScalingFormula.optional(),
    notes: z.string().optional(),
  }).optional(),
  damageTypeChoice: z.object({
    timing: z.enum(["on_damage"]),
    chooser: z.enum(["caster"]),
    appliesTo: z.enum(["attack_damage"]),
    options: z.array(z.object({
      type: z.union([z.string(), z.literal("weapon_normal")]),
      label: z.string(),
    })),
    notes: z.string().optional(),
  }).optional(),
  additionalDamage: DamageData.optional(),
  appliesOn: z.enum(["hit"]).optional(),
  notes: z.string().optional(),
});
