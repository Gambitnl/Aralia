/**
 * @file combat/effects.ts
 * Persistent conditions, spell artifacts and lifecycle-owned state.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { AbilityScoreName, CharacterStats } from '../core.js';
import type { DamageType, ConditionName, EffectDuration, SpellEffect, RepeatSave, SpellcastingRestriction, EscapeCheck, ConditionBreakTrigger, AbilityCheckModifier, CreatedObject, IllusionMetadata, SensoryManifestation, TerrainManipulation, BindingControl, DominationControl, TauntEffect } from '../spells.js';
import type { Position } from './primitives.js';
import type { AreaOfEffect } from './actions.js';
import type { SelectedSpellObjectDamageState } from './map.js';

// --- EFFECTS REFAC (IN PLACE) ---

/**
 * Filter criteria for selecting targets for an effect.
 * Strictly typed to avoid 'any'.
 */
export interface TargetConditionFilter {
  conditions?: ConditionName[];
  creatureTypes?: string[];
  hpStatus?: "full" | "bloodied" | "unconscious";
  stats?: Partial<CharacterStats>;
  alignment?: string[]; // e.g., ['Evil', 'Chaotic']
}


/**
 * Represents a status effect applied to a character.
 */
export interface RepeatSaveProgressState {
  successes: number;
  failures: number;
}


/** A temporary spell rule that disables resistance to specific damage types. */
export interface DamageResistanceSuppressionState {
  damageTypes: DamageType[];
  source: "listed" | "chosen_damage_type" | "triggering_damage_type";
}


/** A delayed damage rider that wakes when its affected creature takes damage. */
export interface OnDamageSpellEffectState {
  frequency: "first_per_turn" | "every_time";
  damageDice: string;
  damageType: DamageType | "triggering_damage_type";
  /** The combat turn index prevents a first-per-turn rider from firing twice. */
  lastTriggeredTurn?: number;
}


/**
 * Observer-relative truth created by a successful Hide action.
 *
 * Hidden remains one owned status record, while this receipt remembers the
 * Stealth total, observers that have found the creature, and stable events
 * already applied to that exact source. This avoids turning detection into one
 * global boolean and lets attacks remove only Hide-derived concealment.
 */
export interface HiddenStealthState {
  /** Stable owner/source key for exact replacement and removal. */
  ownerId: string;
  /** The successful Dexterity (Stealth) total observers must meet or beat. */
  stealthDc: number;
  /** Character ids that have detected this hidden source. */
  detectedBy: string[];
  /** Hide-derived state ends immediately after its owner makes an attack roll. */
  breaksOnAttack: boolean;
}


export interface StatusEffect {
  id: string;
  name: ConditionName | string;
  type: "buff" | "debuff" | "neutral" | "dot" | "hot";
  description?: string;
  duration: number; // in rounds when the effect has a timed expiry
  /**
   * Some physical conditions, including Prone, last until a creature takes the
   * rule action that removes them. Their numeric duration is display-compatible
   * legacy data only and must not be decremented by the turn clock.
   */
  persistsUntilRemoved?: boolean;
  source?: string; // Ability or spell name
  /** Spell id that created this status, used for concentration-owned cleanup. */
  sourceSpellId?: string;
  /** Character id that applied this status, needed for caster-relative rules such as Fear's line-of-sight repeat-save gate. */
  sourceCasterId?: string;
  /** Structured Hide ownership and observer knowledge for the Hidden condition. */
  stealth?: HiddenStealthState;
  /** Structured compelled-target rule read by attacks, movement and break events. */
  taunt?: TauntEffect;
  icon?: string;
  /**
   * Spell-condition metadata that must survive the bridge into the legacy
   * statusEffects array. The combat engine reads repeat saves from this runtime
   * object today, while escape checks and break triggers are preserved here so
   * future condition-resolution work does not have to rediscover the original
   * spell payload.
   */
  repeatSave?: RepeatSave;
  /** Source-backed save required before this creature can cast a spell. */
  spellcastingRestriction?: SpellcastingRestriction;
  /** Elemental Bane-style removal of an affected target's resistance. */
  resistanceSuppression?: DamageResistanceSuppressionState;
  /** Structured damage-event rider consumed by the shared damage pipelines. */
  onDamageSpellEffect?: OnDamageSpellEffectState;
  /** Runtime counters for repeat-save progressions such as Flesh to Stone's three successes / three failures. */
  repeatSaveProgress?: RepeatSaveProgressState;
  escapeCheck?: EscapeCheck;
  breakTriggers?: ConditionBreakTrigger[];
  /** Existing-target command or service relationship created by spells such as Geas and Planar Binding. */
  bindingControl?: BindingControl;
  /** Existing-target domination relationship created by Dominate Beast/Person/Monster. */
  dominationControl?: DominationControl;
  // Simple effect structure (for spellAbilityFactory compatibility)
  effect?: {
    type:
      | "stat_modifier"
      | "damage_per_turn"
      | "heal_per_turn"
      | "skip_turn"
      | "condition";
    value?: number;
    stat?: string;
  };
  // Mechanical effects
  modifiers?: {
    stat?: AbilityScoreName;
    value?: number;
    skill?: string;
    attackBonus?: number;
    /** Bless/Bane-style dice resolved by the existing attack and save rollers. */
    attackRollBonusDice?: string;
    savingThrowBonusDice?: string;
    /** Flat Armor Class bonus, as granted by Shield of Faith or the Shield spell. */
    acBonus?: number;
    /**
     * Armor Class replacement used by Mage Armor-style defenses, before the
     * relevant ability modifier is added. This mirrors the field names already
     * used by `ActiveEffect.mechanics` so AC calculation reads one vocabulary.
     */
    baseAC?: number;
    /** Human-readable formula kept beside `baseAC` so UI can explain the value. */
    baseACFormula?: string;
    /** Armor Class floor used by Barkskin-style defenses. */
    acMinimum?: number;
    movementSpeed?: number;
    advantage?: ("attack" | "save" | "check")[];
    disadvantage?: ("attack" | "save" | "check")[];
    resistance?: DamageType[];
    vulnerability?: DamageType[];
    immunity?: DamageType[];
  };
  /**
   * Spell-linked check riders such as Guidance keep their structured bonus here
   * so the ability-check utility can read the same spell choice that the cast
   * command stored on the target.
   */
  abilityCheckModifier?: AbilityCheckModifier;
  // Visual effects
  visualEffect?: string;
  light?: {
    brightRadius: number;
    dimRadius?: number;
    attachedTo?: "caster" | "target" | "point";
    color?: string;
    opaqueCoverBlocks?: boolean;
  };
  savePenalty?: {
    dice: string;
    flat?: number;
    applies: "next_save" | "all_saves";
  };
  /**
   * Attack-roll rider carried by spells such as Bless, Bane, Blur and Blade
   * Ward.
   *
   * These are not conditions and they are not symmetric: Blur makes attacks
   * *against* its holder worse, while Bane makes attacks *by* its holder worse.
   * A single advantage/disadvantage flag cannot express that, so direction,
   * attack family and consumption are preserved here. The field names match
   * `ActiveEffect.mechanics` so both effect shapes speak one vocabulary.
   */
  attackRollRider?: {
    modifier: "advantage" | "disadvantage" | "bonus" | "penalty";
    direction: "incoming" | "outgoing";
    attackKind: "any" | "weapon" | "melee_weapon" | "ranged_weapon" | "spell";
    consumption: "next_attack" | "first_attack" | "while_active";
    dice?: string;
    value?: number;
    notes?: string;
  };
  /**
   * Saving-throw rider that rides alongside `attackRollRider` on the same spell
   * effect. Bless and Bane each change attack rolls AND saving throws, so the
   * two riders are emitted together rather than collapsed into one.
   */
  savingThrowRider?: {
    modifier: "advantage" | "disadvantage" | "bonus" | "penalty";
    consumption: "next_save" | "while_active";
    dice?: string;
    value?: number;
    ability?: string;
  };
  /**
   * Terrain a spell creates or reshapes, such as Fog Cloud's obscuring sphere,
   * Spike Growth's damaging ground, or Mold Earth's excavated cube.
   *
   * Terrain is not a property of one creature, so this block records the zone
   * the spell owns. `manipulation` carries the active terrain-control option
   * that cantrips such as Mold Earth expose, which has no condition equivalent.
   */
  terrain?: {
    terrainType: "difficult" | "obscuring" | "damaging" | "blocking" | "wall";
    /** Zone footprint in grid tiles, converted from the spell's feet. */
    areaOfEffect?: AreaOfEffect;
    dispersedByStrongWind?: boolean;
    wallProperties?: { hp: number; ac: number };
    /** Damage dealt by damaging terrain, kept as dice for execution-time rolls. */
    damage?: { dice: string; type: string };
    manipulation?: {
      type: string;
      volume?: { shape?: string; size?: number; depth?: number };
      depositDistance?: number;
    };
  };
  /**
   * Hit-point state riders such as Chill Touch's "No Healing" rule.
   *
   * These are not ordinary conditions in the rules text: they change how HP
   * restoration behaves. Keeping them on the status mirror lets the shared
   * healing helper block healing without hard-coding one spell name.
   */
  hitPointState?: HitPointStateRider;
  /** Spell-specific social lifecycle metadata, currently used by Friends. */
  socialLifecycle?: SocialSpellLifecycle;
}


export interface HitPointStateRider {
  mode: "healing_lockout" | string;
  duration?: string;
  target?: string;
  preventsHitPointRegain?: boolean;
}


export interface SocialSpellLifecycle {
  kind: "friends_charm" | string;
  targetKnowsOnEnd?: boolean;
  recastMemoryDurationRounds?: number;
  durationDays?: number;
  endsIfDamagedByCasterOrAllies?: boolean;
  targetChoosesAttitudeOnEnd?: boolean;
  service?: {
    targetPerformsRequestedServices?: boolean;
    performanceManner?: string;
    requestCannotCauseCertainDeath?: boolean;
    requestChannel?: string;
  };
}


/**
 * Represents an active, ongoing effect on a character (e.g., from a spell like Shield of Faith or Mage Armor).
 * These are distinct from Conditions (Prone, Stunned) as they often carry specific mechanics or durations.
 */
export interface ActiveEffect {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  type: "buff" | "debuff" | "utility";
  duration: EffectDuration;
  startTime: number; // Round number
  /**
   * Mechanical impacts of this effect.
   * Can be used to modify AC, saving throws, etc.
   */
  mechanics?: {
    /** Flat AC bonus preserved from structured defensive spell data such as Shield of Faith. */
    acBonus?: number;
    /** Base AC value used by Mage Armor-style effects before adding the relevant ability modifier. */
    baseAC?: number;
    /** Human-readable formula kept so later recalculation/UI can explain how the base AC was derived. */
    baseACFormula?: string;
    /** Minimum AC floor used by Barkskin-style effects. */
    acMinimum?: number;
    savingThrowBonus?: number;
    damageResistance?: DamageType[];
    damageImmunity?: DamageType[];
    damageVulnerability?: DamageType[];
    /**
     * Flat damage-reduction riders such as Resistance keep their dice, chosen
     * damage type, and once-per-turn consumption marker here so the damage
     * engine can spend the rider without flattening it into generic resistances.
     */
    damageReduction?: {
      dice: string;
      appliesTo: "damage_taken";
      frequency: "once_per_turn" | "every_time";
      damageType?: DamageType;
      lastAppliedTurn?: number;
    };
    /**
     * Negative Energy Flood creates a delayed hostile Zombie when its damage
     * kills a non-Undead creature. The pending record stays on the caster so
     * turn-start logic can later raise the Zombie without re-reading the
     * original damage log.
     */
    negativeEnergyFloodZombieRise?: {
      targetId: string;
      targetName: string;
      targetCreatureTypes?: string[];
      position: Position;
      entityType: string;
      timing: string;
      behavior?: string;
      statBlock?: string;
    };
    attackBonus?: number;
    /**
     * Held-weapon spell augments, such as Shillelagh, are stored on the
     * caster as active-effect mechanics because the current combat item model
     * does not yet persist temporary enchantments directly on Item instances.
     * The weapon attack command re-checks the live weapon before consuming this
     * block so releasing or swapping away from the registered weapon naturally
     * stops applying the buff without needing a separate inventory event hook.
     */
    heldWeaponAugment?: {
      sourceWeaponId?: string;
      sourceWeaponName?: string;
      sourceSpellId?: string;
      sourceCasterId?: string;
      sourceSpellcastingAbilityModifier?: number;
      sourceCasterLevel?: number;
      isMagical?: boolean;
      eligibleWeaponTypes?: string[];
      attackType?: string;
      useSpellcastingAbilityForAttack?: boolean;
      useSpellcastingAbilityForDamage?: boolean;
      consumesOnAttackHitOrMiss?: boolean;
      damageDiceByLevel?: {
        base: string;
        level5?: string;
        level11?: string;
        level17?: string;
      };
      damageTypeChoice?: {
        chooser?: string;
        options: string[];
        defaultType?: string;
      };
      endsOnRecast?: boolean;
      endsIfReleased?: boolean;
    };
    damageBonus?: {
      amount: number;
      type: DamageType;
    };
    // Defensive reaction triggers (e.g. Shield spell)
    triggerCondition?: "on_hit" | "on_damaged" | "on_save";
    /**
     * Filter to determine if the effect applies against a specific attacker.
     * Replaces 'any' with strict typing.
     */
    attackerFilter?: TargetConditionFilter;

    // Planar Mechanics
    planarPhase?: string; // The ID of the plane the character is shifted to (e.g., 'ethereal')
    planarVision?: string[]; // IDs of planes the character can see into while in this state

    // Combat Modifiers (e.g., from Slasher feat)
    /** When true, this effect imposes disadvantage on attack rolls */
    disadvantageOnAttacks?: boolean;
    /** When true, this effect grants advantage on attack rolls */
    advantageOnAttacks?: boolean;

    /**
     * Attack-roll riders are not conditions. They live here so combat can
     * decide later whether the rider modifies attacks made by this creature
     * or attacks aimed at this creature.
     */
    attackRollDirection?: "incoming" | "outgoing";
    attackRollModifier?: "advantage" | "disadvantage" | "bonus" | "penalty";
    attackRollKind?:
      "any" | "weapon" | "melee_weapon" | "ranged_weapon" | "spell";
    attackRollConsumption?: "next_attack" | "first_attack" | "while_active";
    attackRollValue?: number;
    attackRollDice?: string;
    /**
     * Optional target gate for outgoing attack-roll riders.
     *
     * Chill Touch's Undead rider only penalizes attacks against the caster who
     * hit the Undead. Storing that caster id here lets the ordinary attack
     * factory read the rider without making the affected Undead worse against
     * every creature on the battlefield.
     */
    attackRollTargetId?: string;
    /**
     * Some attack-roll riders also shut off a condition's combat benefit.
     * Shining Smite is the current shared use: the target still may carry the
     * Invisible condition record, but attacks against it should not suffer the
     * Invisible-target disadvantage while this rider is active.
     */
    suppressedConditionBenefit?: string;

    /**
     * Saving throw riders.
     */
    savingThrowModifier?: "advantage" | "disadvantage" | "bonus" | "penalty";
    savingThrowConsumption?: "next_save" | "while_active";
    savingThrowValue?: number;
    savingThrowDice?: string;
    savingThrowAbility?:
      | "Strength"
      | "Dexterity"
      | "Constitution"
      | "Intelligence"
      | "Wisdom"
      | "Charisma";
    /**
     * Find Familiar-style observer handoff. The active effect marks that the
     * caster is currently using a familiar's senses, while the actual 2D/3D
     * visibility and camera consumers can decide how to present that observer
     * change without re-parsing summon metadata.
     */
    familiarSharedSenses?: boolean;
    observerCharacterId?: string;
    telepathyRange?: number;
    sharedSensesCost?: "action" | "bonus_action" | "free" | "none";
  };
}


/** Tracks 5e conditions (prone, restrained, custom, etc.) currently affecting a character. */
export interface ActiveCondition {
  name: ConditionName | string;
  duration: EffectDuration | { type: "permanent"; value?: number };
  appliedTurn: number;
  /**
   * Counts affected-creature turn ends for turn-relative durations. This is
   * separate from round duration so effects applied during a creature's turn
   * can distinguish the current turn end from the next turn end.
   */
  turnEndEventsRemaining?: number;
  source?: string; // Spell or effect that applied the condition
  /** Character id that applied this condition, preserved for caster-relative repeat-save and break rules. */
  sourceCasterId?: string;
  /**
   * Keep spell-condition metadata on the structured condition mirror as well as
   * statusEffects. statusEffects is still the engine-readable bridge, but this
   * field prevents the newer conditions array from becoming a lossy copy.
   */
  repeatSave?: RepeatSave;
  /** Source-backed save required before this condition's target can cast a spell. */
  spellcastingRestriction?: SpellcastingRestriction;
  escapeCheck?: EscapeCheck;
  breakTriggers?: ConditionBreakTrigger[];
  /** Existing-target command or service relationship mirrored from statusEffects for non-lossy condition state. */
  bindingControl?: BindingControl;
  /** Existing-target domination relationship mirrored from statusEffects for non-lossy condition state. */
  dominationControl?: DominationControl;
  /** Runtime-facing hit-point rider copied from the spell status payload. */
  hitPointState?: HitPointStateRider;
  /** Social aftermath metadata mirrored from statusEffects for non-lossy cleanup. */
  socialLifecycle?: SocialSpellLifecycle;
}


/**
 * Represents the state of a character concentrating on a spell.
 * Tracks which spell is active, when it started, and related effects.
 */
export interface ConcentrationState {
  spellId: string;
  spellName: string;
  spellLevel: number; // The slot level used to cast the spell (important for dispelling/countering)
  startedTurn: number; // The combat turn index when concentration began
  effectIds: string[]; // IDs of any active temporary effects (buffs/debuffs) tied to this concentration
  canDropAsFreeAction: boolean; // Whether the player can voluntarily end this (standard D&D rule: yes)
  sustainCost?: {
    actionType: "action" | "bonus_action" | "reaction";
    optional: boolean;
  };
  sustainedThisTurn?: boolean;
}


export interface ReactiveTrigger {
  id: string;
  sourceEffect: SpellEffect;
  sourceSpellId?: string;
  sourceSpellName?: string;
  casterId: string;
  targetId?: string;
  createdTurn: number;
  expiresAtRound?: number;
}


export interface ActiveRider {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  targetId?: string;
  effect: SpellEffect; // Changed to SpellEffect to be more generic, though usually DamageEffect
  consumption:
    "unlimited" | "first_hit" | "per_turn" | "per_instance_hit_or_miss";
  attackFilter: {
    // Widened to mirror EffectTrigger.attackFilter so rider registration can
    // pass the spell trigger's filter through without an `as any` cast; the
    // AttackRiderSystem runtime already normalizes these wider values.
    weaponType?: "melee" | "ranged" | "melee_weapon" | "ranged_weapon" | "unarmed" | "any";
    attackType?: "weapon" | "spell" | "unarmed" | "any";
  };
  usedThisTurn: boolean;
  duration: {
    type: EffectDuration["type"];
    value?: number;
  };
  /**
   * Filter on target properties (e.g. creatureTypes, conditions).
   * Used for bane oils and conditional riders (GG-219).
   */
  targetFilter?: TargetConditionFilter;
}


/**
 * Save penalty rider applied to a target from effects like Mind Sliver.
 * Stored on the target character (not caster) since it modifies their saves.
 */
export interface SavePenaltyRider {
  id: string;
  spellId: string;
  casterId: string;
  sourceName: string;
  dice?: string; // e.g. "1d4" - rolled and subtracted from save
  flat?: number; // e.g. -2 - flat penalty
  applies: "next_save" | "all_saves";
  duration: {
    type: "rounds" | "minutes" | "special";
    value?: number;
  };
  appliedTurn: number;
}


/**
 * Represents an active light source on the map, created by spells or items.
 * Light sources can be attached to characters or fixed at a point.
 */
export interface LightSource {
  id: string;
  sourceSpellId: string; // ID of the spell that created this light
  casterId: string; // Character ID of the caster
  brightRadius: number; // Radius of bright light in feet
  dimRadius: number; // Additional radius of dim light in feet
  attachedTo: "caster" | "target" | "point";
  attachedToCharacterId?: string; // If attached to caster or target
  position?: Position; // Fixed position if attachedTo is "point"
  color?: string; // Optional color tint
  opaqueCoverBlocks?: boolean; // Tracks object-mounted sources that should stop emitting when covered.
  createdTurn: number; // Turn when this was created
  expiresAtRound?: number; // Optional expiration (for concentration tracking)
  /**
   * Optional clustered-light metadata for spells whose "light source" is a
   * movable created artifact rather than a single torch-like glow.
   */
  clusterId?: string;
  clusterIndex?: number;
  clusterSize?: number;
  presentation?: "single" | "cluster_member" | "combined_humanoid";
  hover?: boolean;
  maxMoveDistanceFeet?: number;
  leashDistanceFeet?: number;
  vanishesBeyondRangeFeet?: number;
  originPosition?: Position;
  movementCost?: "action" | "bonus_action" | "reaction" | "free" | string;
}


/**
 * Structured record for spell effects that hit map objects rather than
 * creatures.
 *
 * Object targeting already preserves selected map-object refs, but combat
 * state does not yet maintain object HP like creature HP. This impact trail
 * keeps object damage, source spell, caster, position, and timing together so
 * UI and future durability systems can consume real execution evidence instead
 * of scraping combat-log prose.
 */
export interface SpellObjectImpact {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  damage?: {
    dice: string;
    type: string;
  };
  createdTurn: number;
  expiresAtRound?: number;
}


/**
 * Structured record for spells that repair object damage.
 *
 * This is the repair-side counterpart to SpellObjectImpact. It keeps the
 * object's selected metadata, the repair contract, and the validation outcome
 * together so future object-state systems can inspect the same event without
 * scraping combat text.
 */
export interface SpellObjectRepair {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  createdTurn: number;
  outcome: "repaired" | "no_damage" | "too_large" | "missing_target";
  repairState: {
    targetKind: "object" | string;
    repairLimit: "single_break_or_tear" | string;
    maxDamageDimensionFeet: number;
    leavesNoTrace: boolean;
    canPhysicallyRepairMagicItem: boolean;
    restoresMagicToMagicItem: boolean;
  };
  damageState?: SelectedSpellObjectDamageState;
  objectWasMagical?: boolean;
}


/**
 * Structured record for spells that change whether a map object can be opened,
 * locked, unbarred, unstuck, or temporarily bypassed.
 *
 * Access changes are intentionally separate from object damage/repair records:
 * Knock and Arcane Lock alter door/container state and player readability even
 * when the object has no HP or break/tear damage for the durability model.
 */
export interface SpellObjectAccessChange {
  id: string;
  objectId: string;
  objectName?: string;
  position: Position;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  createdTurn: number;
  outcome:
    | "unlocked"
    | "unstuck"
    | "unbarred"
    | "suppressed_magical_lock"
    | "magically_locked"
    | "access_changed";
  mundaneStateChanges?: string[];
  suppressesMagicalClosure?: string;
  suppressionDuration?: EffectDuration;
  targetOperableDuringSuppression?: boolean;
  soundEmission?: {
    audibleRadius: number;
    radiusUnit: string;
    source: string;
    trigger: string;
    description: string;
  };
  nonmagicalUnlockBlocked?: boolean;
  allowedOpeners?: string;
  optionalPassword?: boolean;
  passwordRangeFeet?: number;
  passwordUnlockDuration?: string;
  expiresWithSpell?: boolean;
  notes?: string;
}


/**
 * Private spell communication event produced by Message.
 *
 * Combat logs are visible narration, while Message's rules depend on exactly
 * who heard the whisper and who can hear the reply. This record keeps the
 * delivery facts structured until a richer messaging UI owns them.
 */
export interface SpellCommunicationExchange {
  id: string;
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  targetId?: string;
  deliveredText?: string;
  replyText?: string;
  privateRecipientIds: string[];
  replyRecipientIds: string[];
  createdTurn: number;
  outcome: "delivered" | "blocked" | "missing_target";
  blockerReason?: string;
  throughBarrier?: boolean;
  familiarWithTarget?: boolean;
  knowsTargetBeyondBarrier?: boolean;
  authoredBlockers?: string[];
}


/**
 * Active illusion artifact created by Minor Illusion.
 *
 * Illusions are not ordinary harmless utility objects: each creature can
 * discern them independently, and image mode can be revealed by physical
 * interaction. This record keeps those reveal facts explicit while a broader
 * illusion UI and cleanup system are still future work.
 */
export interface ActiveIllusionEffect {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  mode: "sound" | "image" | string;
  position: Position;
  description: string;
  createdTurn: number;
  expiresAtRound?: number;
  revealRules?: IllusionMetadata["revealRules"];
  sensoryManifestation?: SensoryManifestation;
  physicalInteractionReveals: boolean;
  investigationReveal?: {
    actionCost?: string;
    ability?: string;
    skill?: string;
    dc?: string;
  };
  discernedState?: IllusionMetadata["discernedState"];
  discernedByCreatureIds: string[];
  faintToCreatureIds: string[];
  recastGroup: string;
  endsOnRecast: boolean;
}


/**
 * First-class fire artifacts created or started by spells.
 *
 * Create Bonfire and Fire Bolt both have fire behavior that is more specific
 * than ordinary damage: one creates a spell-duration hazard and the other can
 * ignite a qualifying object. This record keeps that evidence structured while
 * object HP, fuel consumption, and full environment spread remain future work.
 */
export interface ActiveFireEffect {
  id: string;
  spellId: string;
  sourceName?: string;
  casterId: string;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  kind: "hazard" | "ignited_object";
  objectId?: string;
  objectName?: string;
  objectType?: string;
  damage?: {
    dice: string;
    type: string;
  };
  area?: {
    shape?: string;
    sizeFeet?: number;
  };
  ignitesTouchedObjects: boolean;
  excludesWornOrCarriedObjects: boolean;
  suppressedReason?: "worn_or_carried" | "not_flammable";
}


export interface SpellWeaponEnchantment {
  id: string;
  spellId: string;
  sourceName: string;
  casterId: string;
  itemId?: string;
  itemName?: string;
  createdTurn: number;
  expiresAtRound?: number;
  heldWeaponAugment: NonNullable<
    NonNullable<ActiveEffect["mechanics"]>["heldWeaponAugment"]
  >;
}


export type ShapeWaterMode =
  "move_or_flow" | "shape_and_animate" | "color_or_opacity" | "freeze";


export interface ActiveShapeWaterEffect {
  id: string;
  spellId: string;
  casterId: string;
  mode: ShapeWaterMode;
  position: Position;
  targetObjectId?: string;
  targetObjectName?: string;
  volumeCubicFeet: number;
  cubeSizeFeet: number;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  noDamage: boolean;
  dismissed?: boolean;
}


export type ThaumaturgyMode =
  | "altered_eyes"
  | "booming_voice"
  | "fire_play"
  | "invisible_hand"
  | "phantom_sound"
  | "tremors";


export interface ActiveThaumaturgyEffect {
  id: string;
  spellId: string;
  casterId: string;
  mode: ThaumaturgyMode;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  harmless: boolean;
  sourceObjectType?: string;
  targetObjectId?: string;
  targetObjectName?: string;
  appearanceChange?: string;
  soundEmission?: string;
  fireStateChange?: string[];
  objectMotion?: string[];
  groundMotion?: string;
  abilityCheckModifier?: AbilityCheckModifier;
}


/**
 * Generic harmless utility artifact created by cantrip modes.
 *
 * Druidcraft and Elementalism have many small environmental outcomes that are
 * too concrete for a generic combat-log sentence but too harmless for damage,
 * terrain, or inventory systems. This record preserves the selected mode,
 * map position, object target, lifecycle, and data-authored created object so
 * UI and exploration systems can render them without spell-specific prose
 * parsing.
 */
export interface ActiveMinorUtilityEffect {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  mode: string;
  position?: Position;
  targetObjectId?: string;
  targetObjectName?: string;
  createdTurn: number;
  expiresAtRound?: number;
  instantaneous: boolean;
  harmless: boolean;
  createdObject: CreatedObject;
  sensorState?: Record<string, unknown>;
  aftermathState?: Record<string, unknown>;
}


// ============================================================================
// Controlled Utility Helper Records
// ============================================================================
// Mage Hand-style helpers are not creatures and should not enter turn order, but
// they still have map position, caster ownership, movement, object-use limits,
// recast replacement, and distance-based cleanup. This runtime record keeps
// those executable facts out of prose-only utility logs.
// ============================================================================

export interface ActiveSpellHelper {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "mage_hand" | string;
  entityType: string;
  position: Position;
  size: string;
  creature: boolean;
  occupiesSpace: boolean;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  control?: {
    actionType: string;
    initialUseOnCast?: boolean;
    laterControlTiming?: string;
    movementDistanceFeet?: number;
  };
  restrictions?: {
    canAttack?: boolean;
    canActivateMagicItems?: boolean;
    carryCapacityPounds?: number | "not_applicable";
    allowedInteractions?: string[];
  };
  separationEnding?: {
    trigger: "beyond_max_distance" | string;
    scope: "spell" | string;
    maxDistanceFeet: number;
  };
  recastEnding?: {
    trigger: "end_on_recast" | string;
    scope: "spell" | string;
  };
  /** Remote-sensor facts used by Scrying-style helpers and map presentation. */
  remoteSensor?: {
    mode: "creature_following" | "location_stationary" | string;
    targetId?: string;
    followDistanceFeet?: number;
    senses?: string[];
    visibility?: string;
    visibleAs?: string;
  };
}


/** Durable target-specific lockouts for spells whose successful save blocks retargeting. */
export interface ActiveSpellTargetLockout {
  id: string;
  spellId: string;
  targetId: string;
  targetName?: string;
  createdAtTimestamp: number;
  expiresAtTimestamp: number;
  reason: string;
}


export interface ActiveSpellForce {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "spiritual_weapon" | string;
  entityType: string;
  position: Position;
  size?: string;
  reachFeet: number;
  moveDistanceFeet: number;
  moveAction: string;
  repeatAttack: string;
  damage: string;
  occupiesSpace: boolean;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  placement?: {
    requiresUnoccupiedSpace?: boolean;
    lineOfSightRequired?: boolean;
    rangeAnchor?: string;
  };
  durability?: {
    armorClass?: number;
    maxHitPoints?: number;
    currentHitPoints?: number;
    endsSpellAtZeroHitPoints?: boolean;
  };
  abilityScores?: {
    strength?: number;
    dexterity?: number;
  };
  commandModes?: string[];
  forcedMovement?: Record<string, unknown>;
  grantedAction?: {
    action: string;
    type: string;
    frequency?: string;
    rangeLimit?: number;
    attackType?: string;
    damageDice?: string;
    damageType?: string;
    damageAbilityModifier?: string;
  };
  /** Effect rows replayed by a source-backed follow-up action such as Grasping Vine. */
  followUpEffects?: SpellEffect[];
}


/**
 * Canonical mutable facts for a targetable combat object.
 *
 * Stable event IDs live with the object because replay protection must survive
 * React snapshots and map replacement. Ownership is optional: an unowned prop
 * is public, while an owned prop accepts interactions only from its owner.
 */
export interface MapObjectInteractionState {
  kind: "container" | "device" | "breakable";
  isOpen: boolean;
  useCount: number;
  hitPoints: number;
  maxHitPoints: number;
  destroyed: boolean;
  ownerId?: string;
  resolvedEventIds: string[];
  /** Material the object is made of (GG-206; determines Armor Class via physicsUtils.getObjectAC). */
  material?: string;
  /** Size classification of the object (GG-206; tiny, small, medium, large, etc.). */
  size?: string;
  /** Armor Class of the object (derived from material or explicitly authored; GG-206). */
  armorClass?: number;
  /** Whether the object is fragile (used with getObjectHP). */
  isFragile?: boolean;
}


export interface ActiveSpellGuardian {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "guardian_of_faith" | string;
  position: Position;
  size: string;
  occupiesSpace: boolean;
  invulnerable: boolean;
  threatRadiusFeet: number;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  triggerPolicy: {
    targets: "enemy_creatures" | string;
    onEnterFrequency?: string;
    onEnterTrigger?: boolean;
    turnStartTrigger?: boolean;
    saveAbility?: string;
    saveOutcome?: string;
    damageAmount: number;
    damageDice?: string;
    damageType: string;
  };
  damageCap: {
    maxTotalDamage: number;
    dealtDamage: number;
    vanishWhenReached: boolean;
  };
  watchdog?: {
    visibleTo?: string;
    intangible?: boolean;
    truesightFeet?: number;
    barkingAlarmRadiusFeet?: number;
    barkTrigger?: string;
    password?: string;
    passwordPreventsBark?: boolean;
  };
  movement?: {
    action?: string;
    maxDistanceFeet?: number;
  };
  separationEnding?: {
    trigger?: string;
    scope?: string;
    maxDistanceFeet?: number;
  };
  elementalSpirit?: {
    origin?: string;
    element?: string;
    damageType?: string;
    initialDamageDice?: string;
    repeatDamageDice?: string;
    intangible?: boolean;
    restrainedTargetId?: string;
  };
}


// ============================================================================
// Spell Emanation Runtime Records
// ============================================================================
// Conjure Minor Elementals and Conjure Woodland Beings stay centered on the
// caster and persist as shaped emanations rather than independent creatures.
// This record keeps the following aura, damage rider, terrain, and bonus-action
// facts available to combat cleanup and future map automation.
// ============================================================================

export interface ActiveSpellEmanation {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "elemental_spirit_emanation" | "nature_spirit_emanation" | string;
  entityType: string;
  radiusFeet: number;
  combatEntity: false;
  followsCaster: true;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  damageRider?: {
    trigger: "on_attack_hit" | string;
    dice: string;
    damageTypeChoices: string[];
    chosenDamageType?: string;
    slotScaling?: string;
  };
  terrain?: {
    terrainType: "difficult" | string;
    appliesTo: string;
    followsCaster?: boolean;
    createsDifficultTerrain?: boolean;
  };
  damageAura?: {
    trigger: "emanation_entry_or_turn_end" | string;
    dice: string;
    damageType: string;
    saveAbility: string;
    saveOutcome: "half" | "none" | string;
    oncePerTurn: boolean;
    slotScaling?: string;
  };
  grantedActions?: Array<{
    type: string;
    action: string;
    frequency?: string;
  }>;
}


// ============================================================================
// Communication Control Runtime Records
// ============================================================================
// Speak-style spells create temporary question, command, and terrain interfaces
// instead of combat actors. This record keeps those counters and limits visible
// to runtime cleanup without pretending the corpse or plants are summons.
// ============================================================================

export interface ActiveCommunicationControl {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "speak_with_dead" | "speak_with_plants" | string;
  entityType: string;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  targetId?: string;
  targetName?: string;
  originPosition?: Position;
  corpseInterrogation?: {
    requiresMouth?: boolean;
    failsIfCreatureWasUndeadWhenItDied?: boolean;
    cooldownDays?: number;
    questionLimit: number;
    questionsRemaining: number;
    answerWindowMinutes?: number;
    corpseKnowsOnlyLifeKnowledge?: boolean;
    includesKnownLanguages?: boolean;
    cannotLearnNewInformation?: boolean;
    cannotComprehendPostDeathEvents?: boolean;
    cannotSpeculateAboutFuture?: boolean;
    answersMayBeBriefCrypticOrRepetitive?: boolean;
    noTruthCompulsionIfAntagonisticOrRecognizesEnemy?: boolean;
  };
  plantCommunication?: {
    radiusFeet?: number;
    areaShape?: string;
    plantsGainLimitedSentience?: boolean;
    plantsCanCommunicateWithCaster?: boolean;
    plantsCanFollowSimpleCommands?: boolean;
    canQuestionAboutPastDayEvents?: boolean;
    plantCreaturesShareLanguageWithCaster?: boolean;
    cannotUprootOrMove?: boolean;
    allowedMotion?: string;
    releasesEntangleRestrainedCreatures?: boolean;
    terrainConversion?: {
      canTurnPlantDifficultTerrainToOrdinary?: boolean;
      canTurnOrdinaryPlantTerrainToDifficult?: boolean;
      requiresPlantsPresent?: boolean;
      conversions?: string[];
    };
  };
}


// ============================================================================
// Environmental Control Runtime Records
// ============================================================================
// Wrath of Nature-style spells animate terrain features rather than creatures.
// This record keeps the area, tree, root/vine, loose-rock, and cleanup facts
// together so later automation can act on the controlled environment directly.
// ============================================================================

export interface ActiveEnvironmentalControl {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "wrath_of_nature" | string;
  entityType: string;
  originPosition: Position;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  area?: {
    shape?: string;
    sizeFeet?: number;
    lineOfSightRequired?: boolean;
  };
  terrain?: {
    difficultTerrainFor?: string;
  };
  treeAttacks?: {
    triggerTiming?: string;
    targetFilter?: string;
    radiusFeet?: number;
    saveAbility?: string;
    saveOutcome?: string;
    damageDice?: string;
    damageType?: string;
  };
  rootsAndVines?: {
    triggerTiming?: string;
    targetFilter?: string;
    saveAbility?: string;
    saveOutcome?: string;
    condition?: string;
    escapeSkill?: string;
  };
  looseRocks?: {
    actionCost?: string;
    actionName?: string;
    target?: string;
    attackType?: string;
    damageDice?: string;
    damageType?: string;
    followupSaveAbility?: string;
    failedSaveCondition?: string;
  };
}


// ============================================================================
// Extradimensional Space Runtime Records
// ============================================================================
// Mansion-style spells create playable spaces behind a boundary instead of
// normal map tiles. This record keeps the entrance, allowed entrants, floor
// limit, and end-of-spell expulsion rule visible to runtime cleanup.
// ============================================================================

export interface ActiveExtradimensionalSpace {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "magnificent_mansion" | string;
  entrancePosition: Position;
  entranceDimensions: {
    widthFeet: number;
    heightFeet: number;
  };
  doorState: "open" | "closed" | string;
  imperceptibleWhenClosed: boolean;
  designatedCreatureIds: string[];
  floorPlan: {
    maxCubes: number;
    cubeSizeFeet: number;
    contiguous: boolean;
  };
  expulsion: {
    trigger?: string;
    destinationPreference?: string;
    requiresUnoccupiedSpace?: boolean;
    appliesTo?: string[];
  };
  occupants?: {
    creatureIds: string[];
    objectIds: string[];
  };
  createdTurn: number;
  expiresAtRound?: number;
}


// ============================================================================
// Spell Structure Runtime Records
// ============================================================================
// Fortress-style spells create large, damageable structures that are not
// creatures. This record keeps their footprint, section durability, safe
// crumble behavior, and permanence cadence available to future map systems.
// ============================================================================

export interface ActiveSpellStructure {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "mighty_fortress" | string;
  originPosition: Position;
  footprint: {
    shape: "square" | string;
    sizeFeet: number;
    placementRequirement?: string;
  };
  harmlessRiseCreatureIds: string[];
  sectionDurability: {
    armorClass: number;
    hitPointsPerInch: number;
    sectionSizeFeet: {
      width: number;
      height: number;
    };
    damageImmunities: string[];
    collapseOnZeroHp: boolean;
  };
  lifecycle: {
    durationDays: number;
    crumblesSafely: boolean;
    permanenceRequiredSameLocationCasts: number;
    permanenceCadenceDays: number;
    sameLocationRequired: boolean;
    sameLocationCastCount: number;
  };
  sections?: Array<{
    id: string;
    currentHitPoints: number;
    maxHitPoints: number;
    destroyed: boolean;
    damageType?: string;
    collapseRisk?: string;
  }>;
  permanent?: boolean;
  createdTurn: number;
  expiresAtRound?: number;
}


// ============================================================================
// Spell Ward Runtime Records
// ============================================================================
// Long-lived area wards can contain several spell-specific sub-effects. These
// records keep the active ward, its bounds, and its cleanup rules visible to
// combat and exploration systems without pretending every ward is a creature.
// ============================================================================

export interface ActiveSpellWard {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  kind: "druid_grove" | string;
  originPosition: Position;
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
  area: {
    shape: string;
    minSizeFeet?: number;
    maxSizeFeet?: number;
    excludesBuildingsAndStructures?: boolean;
    radiatesMagic?: boolean;
  };
  guardianTrees?: {
    maxCount: number;
    guardianIds: string[];
    statBlock?: string;
    cannotSpeak?: boolean;
    barkMarked?: boolean;
    cannotLeaveWardedArea?: boolean;
    obeysSpokenCommandsInArea?: boolean;
    intruderResponse?: string;
    rerootsWhenSpellEndsIfPossible?: boolean;
  };
  ending?: {
    trigger: "spell_ends" | string;
    dispelRemovesOneEffectOnly?: boolean;
    endsWhenAllEffectsRemoved?: boolean;
  };
  aftermathState?: {
    kind?: string;
    recovery?: string;
    [key: string]: unknown;
  };
}


// ============================================================================
// Animated Object Runtime Records
// ============================================================================
// Tiny Servant and Animate Objects turn map objects into temporary creatures,
// then restore the original object when the spell ends or the creature hits 0
// HP. This record keeps both sides of that identity together for later map,
// damage, and cleanup systems.
// ============================================================================

export interface ActiveAnimatedObject {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  sourceObjectId: string;
  sourceObjectName?: string;
  sourceObjectPosition?: Position;
  size: string;
  sizeCost: number;
  creatureType: string;
  allegiance: "ally" | "enemy" | "neutral" | string;
  spellcastingAbility?: AbilityScoreName;
  initiativePolicy: "immediate" | "rolled" | "shared" | string;
  armorClass: number;
  maxHitPoints: number;
  currentHitPoints: number;
  speedFeet: number;
  command?: {
    action?: string;
    rangeFeet?: number;
    scope?: string;
    noCommandBehavior?: string;
  };
  immunities?: {
    damage?: string[];
    conditions?: string[];
  };
  slam?: {
    attackBonusSource?: string;
    damage?: string;
    slotScaling?: string;
  };
  lifecycle: {
    hitPointEnding?: string;
    reversion: string;
    damageCarryover?: string;
    revertedAtTurn?: number;
    reversionReason?: string;
    excessDamageCarriedOver?: number;
  };
  active: boolean;
  createdTurn: number;
  expiresAtRound?: number;
}


// ============================================================================
// Awakened Creature Runtime Records
// ============================================================================
// Awaken permanently changes a Beast, Plant creature, or natural plant, then
// leaves a 30-day social lifecycle behind. Keep those facts as combat state so
// later relationship, map, and stat-profile systems do not need to infer them
// from the utility log.
// ============================================================================

export interface ActiveAwakenedCreature {
  id: string;
  spellId: string;
  spellName?: string;
  casterId: string;
  targetId: string;
  targetName?: string;
  creatureType: string;
  intelligenceScore: number;
  language?: string;
  statProfile?: string;
  naturalPlantBecameCreature: boolean;
  movementParts?: string[];
  humanlikeSenses?: boolean;
  createdTurn: number;
  charmedRelationship: {
    condition: "Charmed" | string;
    durationDays: number;
    endsIfDamagedByCasterOrAllies: boolean;
    attitudeChosenAfterCharmEnds: boolean;
    attitude?: string;
    endReason?: string;
  };
}


export interface ActiveTruePolymorphTransformation {
  id: string;
  mode?: "object_to_creature" | "creature_to_creature" | "creature_to_object";
  spellId: string;
  spellName?: string;
  casterId: string;
  sourceObjectId?: string;
  sourceObjectName?: string;
  sourceObjectPosition?: Position;
  sourceCreatureId?: string;
  sourceCreatureName?: string;
  sourceCreaturePosition?: Position;
  transformedCreatureId?: string;
  transformedFormName?: string;
  transformedObjectName?: string;
  temporaryHitPoints?: number;
  retainedStatistics?: string;
  actionAndSpeechLimits?: string;
  gearMeld?: string;
  noMemoryObjectForm?: string;
  controlledUntilFullDuration?: boolean;
  controlAfterOneHour?: string;
  permanence?: string;
  deathOrDestruction?: string;
  statReplacement?: string;
  transformationDuration?: string;
  createdTurn: number;
}


/**
 * Visible dirt-or-stone marking created by Mold Earth.
 *
 * This is intentionally Mold Earth-specific rather than a generic decoration
 * system: it preserves the rules-authored cosmetic manipulation as a durable
 * spell artifact while leaving broader map rendering and authored decals for a
 * later UI consumer.
 */
export interface ActiveMoldEarthSurfaceMark {
  id: string;
  spellId: "mold-earth" | string;
  spellName?: string;
  casterId: string;
  position: Position;
  createdTurn: number;
  expiresAtRound?: number;
  manipulation: TerrainManipulation;
}
