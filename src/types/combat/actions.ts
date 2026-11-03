/**
 * @file combat/actions.ts
 * Ability definitions, costs, reactions and chosen combat actions.
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

import type { AbilityScoreName } from '../core.js';
import type { Item } from '../items.js';
import type { Spell, SpellEffect } from '../spells.js';
import type { Position } from './primitives.js';
import type { StatusEffect } from './effects.js';
import type { SelectedSpellTarget } from './map.js';

export type AbilityType = "attack" | "spell" | "skill" | "movement" | "utility";

/** Actual attack facts supplied before damage, with only statically known AC changes quoted. */
export interface ReactionHitPreview {
  attackTotal: number;
  currentAC: number;
  defendedAC?: number;
  isCritical: boolean;
  stopsAttack?: boolean;
}

/** Per-offer facts stay on the transient choice, never on the canonical spell packet. */
export type ReactionSpellOption = (Spell | Ability) & { hitPreview?: ReactionHitPreview };

export type TargetingType =
  | "single_enemy"
  | "single_ally"
  | "single_any"
  | "area"
  | "self"
  | "all_enemies"
  | "all_allies"
  | "multiple_enemies"
  | "multiple_any";

export type ActionCostType =
  | "action"
  | "bonus"
  | "reaction"
  | "legendary"
  | "lair"
  | "free"
  | "movement-only";


export interface AbilityCost {
  type: ActionCostType;
  movementCost?: number;
  spellSlotLevel?: number;
  quantity?: number;
  castSource?: {
    type: "racial";
    spellId: string;
    allowSlotFallback?: boolean;
  } | {
    /** Feat-owned free casts reuse the existing limitedUses entry. */
    type: "feat";
    featId: string;
    spellId: string;
    allowSlotFallback?: boolean;
  };
  limitations?: {
    oncePerTurn?: boolean;
    oncePerRound?: boolean;
    requiresOtherAction?: ActionCostType;
  };
}


export interface AreaOfEffect {
  shape: "circle" | "cone" | "line" | "square";
  size: number; // radius for circle, length for line/cone, side for square
  angle?: number; // for cone abilities
  followsCaster?: boolean;
}


export interface AbilityEffect {
  type:
    | "damage"
    | "heal"
    | "status"
    | "movement"
    | "teleport"
    | "familiar_pocket"
    | "familiar_shared_senses"
    | "commanded_summon"
    | "granted_action"
    | "summon_creature"
    | "summon_dismiss"
    | "summon_return_home";
  value?: number;
  dice?: string; // Dice formula (e.g. "1d8+2") to be rolled at execution time
  damageType?:
    | "physical"
    | "bludgeoning"
    | "piercing"
    | "slashing"
    | "magical"
    | "fire"
    | "cold"
    | "ice"
    | "lightning"
    | "acid"
    | "poison"
    | "necrotic"
    | "radiant"
    | "force"
    | "psychic"
    | "thunder";
  statusEffect?: StatusEffect;
  duration?: number;
  familiarPocketAction?: "dismiss" | "recall";
  familiarId?: string;
  sharedSensesAction?: "activate";
  commandedSummonAction?: "issue_command";
  summonCommandDescription?: string;
  summonId?: string;
  /**
   * Creation riders for a `summon_creature` effect. The other summon effect
   * types above act on a summon that already exists; this one records that the
   * cast brings an entity onto the field, which is what a SUMMONING spell row
   * carries. The authoritative spawn still happens in SummoningCommand via the
   * spell path; these fields describe the summon so the battle-map ability and
   * the combat AI can see that the cast does something.
   */
  summonEntityType?:
    | "familiar"
    | "servant"
    | "construct"
    | "creature"
    | "undead"
    | "mount"
    | "object";
  summonCount?: number;
  summonDescription?: string;
  summonPersistent?: boolean;
  summonDismissAction?: "dismiss";
  summonReturnHomeAction?: "no_agreement" | "service_complete";
  grantedActionLabel?: string;
  grantedActionCost?: "action" | "bonus_action" | "reaction";
  grantedActionFrequency?: "once" | "each_turn" | "while_active";
  grantedActionTargeting?: "single_any" | "single_enemy" | "single_ally";
  grantedActionSocialServiceRequest?: "fast_friends" | string;
  grantedActionRangeLimit?: number;
  grantedActionPrerequisites?: (
    | "target_object_within_spell_range"
    | "target_within_spell_range"
    | "not_applicable"
  )[];
  grantedActionAttackType?:
    "ranged_spell_attack" | "melee_spell_attack" | "not_applicable";
  grantedActionAreaShape?:
    "Cone" | "Line" | "Sphere" | "Cube" | "Cylinder" | "not_applicable";
  grantedActionAreaSize?: number | "not_applicable";
  grantedActionAreaSizeUnit?: "feet" | "miles" | "not_applicable";
  grantedActionDamageDice?: string;
  // Same tokens as `damageType` above. "cold" arrives from spell JSON ("Cold"
  // lowercased by the battle-map bridge); "ice" stays for older rows.
  grantedActionDamageType?:
    | "physical"
    | "bludgeoning"
    | "piercing"
    | "slashing"
    | "magical"
    | "fire"
    | "cold"
    | "ice"
    | "lightning"
    | "acid"
    | "poison"
    | "necrotic"
    | "radiant"
    | "force"
    | "psychic"
    | "thunder";
  grantedActionSaveType?:
    | "Strength"
    | "Dexterity"
    | "Constitution"
    | "Intelligence"
    | "Wisdom"
    | "Charisma";
  grantedActionSaveEffect?: "none" | "half" | "negates_condition";
  grantedActionDamageAbilityModifier?:
    "spellcasting_ability" | "not_applicable";
  grantedActionWallLengthReduction?: number;
  grantedActionEndsWhenLengthZero?: boolean;
  grantedActionNotes?: string;
}


export interface AbilityGrantedAction {
  type: "action" | "bonus_action" | "reaction";
  action: string;
  frequency: "once" | "each_turn" | "while_active";
  actor?: "caster" | "target" | "summoned_entity" | "affected_creature";
  /** Targeting mode for follow-up actions that may select an ally or neutral creature. */
  targeting?: "single_any" | "single_enemy" | "single_ally";
  /** Names the canonical social-request adapter that should resolve this action. */
  socialServiceRequest?: "fast_friends" | string;
  actionKind?:
    | "magic_action"
    | "standard_action"
    | "bonus_action"
    | "reaction"
    | "not_applicable";
  areaShape?:
    "Cone" | "Line" | "Sphere" | "Cube" | "Cylinder" | "not_applicable";
  areaSize?: number | "not_applicable";
  areaSizeUnit?: "feet" | "miles" | "not_applicable";
  effectIndices?: number[];
  prerequisites?: (
    | "target_object_within_spell_range"
    | "target_within_spell_range"
    | "not_applicable"
  )[];
  rangeLimit?: number;
  attackType?: "ranged_spell_attack" | "melee_spell_attack" | "not_applicable";
  saveType?:
    | "Strength"
    | "Dexterity"
    | "Constitution"
    | "Intelligence"
    | "Wisdom"
    | "Charisma";
  saveEffect?: "none" | "half" | "negates_condition";
  damageDice?: string;
  damageType?:
    | "physical"
    | "bludgeoning"
    | "piercing"
    | "slashing"
    | "magical"
    | "fire"
    | "ice"
    | "lightning"
    | "acid"
    | "poison"
    | "necrotic"
    | "radiant"
    | "force"
    | "psychic"
    | "thunder";
  damage?: {
    dice: string;
    type: string;
  };
  damageAbilityModifier?: "spellcasting_ability" | "not_applicable";
  wallLengthReduction?: number;
  endsWhenLengthZero?: boolean;
  notes?: string;
}


export interface RacialReaction {
  id: string;
  name: string;
  description: string;
  trigger?: {
    type: string;
  };
  effect?: SpellEffect;
}


export interface Ability {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  cost: AbilityCost;
  alternativeCosts?: AbilityCost[];
  prerequisites?: {
    position?: "adjacent" | "range";
    otherAbilityUsed?: string;
    minimumMovement?: number;
  };
  movementType?: "before" | "after" | "integrated";
  interruptsMovement?: boolean;
  tags?: string[];
  /** Original spell id that created this runtime ability, when different from the button id. */
  sourceSpellId?: string;
  targeting: TargetingType;
  range: number;
  /**
   * Long range in tiles for a ranged or thrown weapon attack (GG-495). A target
   * past `range` but within `longRange` can be attacked with Disadvantage.
   * Absent for every other ability, which keeps `range` as its hard limit.
   */
  longRange?: number;
  /**
   * AoE metadata flattened onto the ability for quick inspection by AI/preview UIs.
   * areaShape/areaSize mirror AreaOfEffect but remain optional so single-target
   * abilities do not need to specify them. When present they should always align
   * with D&D 5e templates (5 ft grid squares). size is expressed in tiles.
   */
  areaShape?: "circle" | "cone" | "line" | "square";
  areaSize?: number;
  areaOfEffect?: AreaOfEffect;
  effects: AbilityEffect[];
  /**
   * Actions a spell grants after the initial cast, such as using an illusion,
   * repeating a spell beam, or commanding an ongoing effect. The raw spell JSON
   * already carries this data on effects; keeping a copy on the combat ability
   * gives UI/action surfaces a direct place to read it without reparsing the
   * original spell every time the player opens their buttons.
   */
  grantedActions?: AbilityGrantedAction[];
  cooldown?: number;
  currentCooldown?: number;
  saveDC?: number;
  saveAbility?: AbilityScoreName;
  /**
   * Explicit attack bonus extracted from 5eTools `{@hit N}` markup (e.g. +14 for an Adult Red Dragon Rend).
   * When present, `AbilityCommandFactory` uses this instead of recomputing from STR/DEX + proficiency.
   * Ensures that monsters with atypical attack bonuses (finesse, multi-stat, racial bonuses) roll correctly.
   */
  attackBonus?: number;
  /**
   * Explicitly marks an attack-roll button as a weapon, spell, or unarmed
   * attack for shared rider matching. Most old attack buttons omit this and
   * keep the historical weapon default, but spell-attack buttons need this so
   * next-weapon-attack riders such as Lightning Arrow do not wake up from a
   * ranged spell attack.
   */
  attackType?: "weapon" | "spell" | "unarmed";
  recharge?: {
    /** Recharge threshold (e.g. 5 = must roll 5+ to recharge) */
    threshold: number;
    /** Description shown in UI (e.g. "Recharge 5-6") */
    description: string;
  };
  /** When true, the ability is in d6-recharge mode instead of standard countdown */
  isRecharging?: boolean;
  /** Maximum number of uses (e.g. 3 for 3/Day) */
  maxUses?: number;
  /** Current remaining uses */
  usesRemaining?: number;
  /**
   * Round when a spell-created object button expires in combat time.
   * Long-duration objects such as Goodberries can also carry readable duration
   * metadata below until the broader party-inventory/world-clock layer owns
   * hour and day cleanup.
   */
  createdObjectExpiresAtRound?: number;
  createdObjectDuration?: {
    type: "rounds" | "minutes" | "hours" | "days" | "special";
    value?: number;
  };
  icon?: string;
  spell?: any; // Reference to the original spell data for AI arbitration
  weapon?: Item; // Reference to the source weapon for proficiency checks
  isProficient?: boolean; // Whether caster is proficient with this ability/weapon
  mastery?: string; // Active weapon mastery property (e.g., 'Topple', 'Sap') if unlocked and proficient
  /** True when the ability is magical (spell attack, innate magic, etc.).
   *  Used by ResistanceCalculator to bypass "resistance to nonmagical attacks". */
  isMagical?: boolean;
  /**
   * Number of sub-attacks this Multiattack resolves into (e.g. 3 for "makes three Rend attacks").
   * Present only on abilities whose name is "Multiattack".
   * The ability's `effects[]` are pre-multiplied to represent the full N-hit damage for AI scoring.
   */
  multiattackCount?: number;
  /**
   * IDs of the sub-attack abilities that Multiattack resolves into.
   * Used by the execution engine to chain individual attack rolls instead of a lump hit.
   */
  subAttackIds?: string[];
  /**
   * Creature types this ability can target (e.g. `["Humanoid"]` for Hold Person).
   * Empty/absent means no type restriction. Used by AI target filtering and validator.
   */
  validCreatureTypes?: string[];
}


export interface CombatAction {
  id: string;
  characterId: string;
  type: "move" | "ability" | "end_turn" | "sustain" | "break_free";
  abilityId?: string;
  targetEffectId?: string; // ID of the status effect to break free from
  targetPosition?: Position;
  /**
   * Full tile-by-tile route used for movement-sensitive spell zones.
   * The final position remains targetPosition; this path preserves the walked
   * squares so effects such as Spike Growth can count travel through an area
   * even when the move starts and ends outside that area.
   */
  movementPath?: Position[];
  /**
   * Optional movement mode used for this movement action.
   * Most current movement actions still omit this and behave as ordinary map
   * movement, but spell-created actors with form-specific traits can set it so
   * shared reaction rules know whether the creature walked, flew, swam, or
   * climbed out of reach.
   */
  movementMode?: "fly" | "walk" | "swim" | "climb" | "any";
  /**
   * Optional decisions supplied by a deterministic controller for each
   * Opportunity Attack responder discovered during this Move.
   *
   * Normal player combat omits this record and uses the reaction prompt; enemy
   * AI omits it and accepts with its first legal melee option. Replays and
   * teaching fixtures can preserve the exact accept/decline and pinned dice
   * facts without replacing the production discovery or damage transaction.
   */
  opportunityAttackDecisions?: Record<string, {
    decision: "accept" | "decline";
    abilityId?: string;
    attackRoll?: number;
    damageRoll?: number;
  }>;
  /**
   * Absolute battle-map altitude chosen for a flying Move.
   *
   * Walking actions omit this value. A normal map click made while already
   * flying preserves the creature's current altitude, while scenario or future
   * altitude controls can choose a climb, descent, or ground landing.
   */
  targetAltitudeFeet?: number;
  /**
   * Ids of creatures the caller knows to be Surprised for this action.
   *
   * There is no surprise system in the engine yet (GG-258), so surprise cannot
   * be derived from combat state. Assassinate needs the fact, so it is a
   * REQUIRED CALLER FACT: the controller that knows an ambush happened states
   * it here. An absent list means the caller reported no surprise, which the
   * rider reads as "not surprised" — it is never guessed from initiative,
   * stealth, or turn order.
   */
  surprisedCharacterIds?: string[];
  targetCharacterIds?: string[];
  /** Rich spell target refs for creature, object, and point selections. */
  selectedSpellTargets?: SelectedSpellTarget[];
  /**
   * Spend and record this action, but skip ability-triggered reactive effects
   * until command-side attack rolls have produced explicit hit/miss facts.
   */
  suppressAbilityEvents?: boolean;
  /**
   * Post-command replay used only to feed resolved attackResults into reactive
   * effects. This does not represent a second normal action.
   */
  reactiveEventsOnly?: boolean;
  /**
   * Optional per-target attack results for reactive effects that only fire on
   * confirmed hits. Older callers may omit this while attack resolution is
   * still being unified; callers that know a target was missed can pass that
   * result so Armor of Agathys-style retaliation stays silent.
   */
  attackResults?: Array<{
    targetId: string;
    isHit: boolean;
    isCritical?: boolean;
    /** Whether the resolved attack was a weapon, spell, or Unarmed Strike. */
    attackType?: "weapon" | "spell" | "unarmed" | "any";
    /** Whether the resolved attack was melee, ranged, or unarmed. */
    weaponType?: "melee" | "ranged" | "unarmed" | "any";
    rollResult?: number;
    total?: number;
  }>;
  movementUsed?: number;
  /**
   * Set by the combat executor when this cast was handed to the ritual runtime
   * instead of resolved. A long cast is a ceremony that runs over the following
   * turns, so the executor accepts the action, dispatches START_RITUAL, and
   * spends nothing — but it still returns true, because the action WAS accepted.
   *
   * Plain success and "started as a ritual" are different outcomes, and a caller
   * that cannot tell them apart casts the spell instantly on top of the ceremony
   * (agora-f821.38). Any caller that would go on to resolve spell effects must
   * read this flag and stop.
   *
   * Callers never set it. The executor writes it on the envelope it was given.
   */
  ritualStarted?: boolean;
  cost: AbilityCost;
  timestamp: number;
}
