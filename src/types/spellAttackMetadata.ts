// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 13:31:48
 * Dependents: types/spells.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file describes spell effects that change weapon attacks.
 *
 * It exists because several cantrips do not directly deal spell damage. Instead,
 * they grant or modify a weapon attack, change which ability score is used, alter
 * the weapon's damage die, or let the caster choose between damage types. Keeping
 * those attack-specific rules here prevents the main spell type file from
 * becoming the only home for every mechanics-discovery addition.
 *
 * Called by: `spells.ts` for the public spell contract.
 * Depends on: `DamageData` from `spells.ts` so existing extra-damage riders keep
 * the same shape they already had.
 */

import type { DamageData, ScalingFormula } from './spells';

//==============================================================================
// Weapon Requirements
//==============================================================================
// These types describe what weapon the spell can use or modify. They are not
// target rules; they are casting/attack prerequisites attached to the attack
// payload itself.
//==============================================================================

/** Describes the weapon that must be used or held for a spell attack augment. */
export interface AttackWeaponRequirement {
  /** Normalized weapon family required by the canonical spell text. */
  weaponTypes: ("club" | "quarterstaff" | "pebble" | "sling" | "any_weapon" | "proficient_weapon")[];
  /** True when the caster must be proficient with the weapon. */
  proficiencyRequired?: boolean;
  /** Minimum weapon value in copper pieces when canonical prose gives a price. */
  minimumValueCp?: number;
  /** True when the weapon must already be in the caster's hand. */
  heldByCaster?: boolean;
  /** Short review note for wording that does not deserve another field yet. */
  notes?: string;
}

//==============================================================================
// Attack Resolution Changes
//==============================================================================
// These types describe how the spell changes attack rolls, damage rolls, damage
// dice, and damage type choice after the weapon requirement is met.
//==============================================================================

/** Describes ability-score replacement for a spell-modified weapon attack. */
export interface AttackAbilitySubstitution {
  /** Ability used for the attack roll, such as the caster's spellcasting ability. */
  attackRoll?: "spellcasting_ability";
  /** Ability used for the damage roll, such as the caster's spellcasting ability. */
  damageRoll?: "spellcasting_ability";
  /** Ability scores that the spell says are replaced by the substitution. */
  replaces?: ("Strength" | "Dexterity")[];
}

/** Describes a spell-granted attack made as part of the spell resolution. */
export interface GrantedAttack {
  /** When the attack is made relative to spell casting or spell duration. */
  timing: "during_cast" | "while_active";
  /** Current supported count for cantrip attack grants. */
  count: 1;
  /** True when the attack must use the weapon named in the spell components. */
  usesCastingWeapon: boolean;
  /** Short note for target or action details that remain elsewhere. */
  notes?: string;
}

/** Describes a weapon damage die replacement caused by the spell. */
export interface AttackDamageDieOverride {
  /** Replacement dice, such as `d8`, before any scaling is applied. */
  dice: string;
  /** Optional scaling table for cantrip die changes. */
  scaling?: ScalingFormula;
  /** Short review note for unusual replacement dice. */
  notes?: string;
}

/** One selectable damage type option for a spell-modified attack. */
export interface AttackDamageTypeChoiceOption {
  /** Runtime damage type or `weapon_normal` for the weapon's ordinary type. */
  type: string | "weapon_normal";
  /** Human-facing option label copied or normalized from canonical prose. */
  label: string;
}

/** Describes a caster damage-type choice for a spell-modified weapon attack. */
export interface AttackDamageTypeChoice {
  /** When the caster chooses the damage type. */
  timing: "on_damage";
  /** Who chooses the damage type. */
  chooser: "caster";
  /** Which damage packet the choice affects. */
  appliesTo: "attack_damage";
  /** Allowed damage type options. */
  options: AttackDamageTypeChoiceOption[];
  /** Short review note for choice wording that is not otherwise fielded. */
  notes?: string;
}

/** Adds structured rider effects to weapon attacks. */
export interface AttackAugment {
  /** Which weapon attack family is affected. */
  attackType: "weapon" | "melee_weapon" | "ranged_weapon";
  /** Attack bonus source for spell-created stat blocks such as Animated Object Slam. */
  attackBonusSource?: string;
  /** Size-keyed damage rows for spell-created attack stat blocks. */
  damageBySize?: {
    medium_or_smaller?: string;
    large?: string;
    huge?: string;
  };
  /** Size-keyed slot scaling rows for spell-created attack stat blocks. */
  slotScaling?: {
    medium_or_smaller?: string;
    large?: string;
    huge?: string;
  };
  /** Giant Insect and similar utility-side stat blocks use slot level for multiattack count. */
  multiattack?: string;
  /** Giant Spider-only ranged attack text preserved until monster attacks are fully normalized. */
  webBoltSpiderOnly?: string;
  /** Giant Centipede-only save effect text preserved until monster attacks are fully normalized. */
  venomousSpewCentipedeOnly?: string;
  /** Giant Spider movement trait text preserved with the stat-block action packet. */
  spiderClimb?: string;
  /** Giant Insect shared Poison Jab damage text. */
  poisonJab?: string;
  /** Danse Macabre-style bonus applied to attacks made by spell-created creatures. */
  attackRollBonus?: string;
  /** Danse Macabre-style bonus applied to damage made by spell-created creatures. */
  damageRollBonus?: string;
  /** Spell-created actor family that receives the attack augment. */
  appliesTo?: string;
  /** Canonical weapon prerequisite for the attack or enchantment. */
  weaponRequirement?: AttackWeaponRequirement;
  /** Spell-granted attack made during casting or while the spell is active. */
  grantedAttack?: GrantedAttack;
  /** Ability-score replacement for attack and damage rolls. */
  abilitySubstitution?: AttackAbilitySubstitution;
  /** Damage die replacement such as Shillelagh's d8 scaling club/quarterstaff die. */
  damageDieOverride?: AttackDamageDieOverride;
  /** Caster damage-type choice such as Force-or-normal or Radiant-or-normal. */
  damageTypeChoice?: AttackDamageTypeChoice;
  /** Existing extra damage rider shape, preserved for spells already using it. */
  additionalDamage?: DamageData;
  /** Trigger condition for the attack augment. */
  appliesOn?: "hit";
  /** Short review note for mixed attack mechanics. */
  notes?: string;
}
