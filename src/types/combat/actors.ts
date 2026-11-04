/**
 * @file combat/actors.ts
 * Creature, equipment, encounter-source and retained summon contracts.
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
 * Last Sync: 29/10/2026, 19:30:23
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundHostileSourceGroup } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { AbilityScoreName, CharacterStats } from '../core.js';
import type { Class, FightingStyle, SpellbookData, SpellSlots, FeatChoice, HitPointDicePool, LimitedUses, RacialBreathWeapon } from '../character.js';
import type { EquipmentSlotType, Item } from '../items.js';
import type { DamageType, ConditionName, ConditionalEnding } from '../spells.js';
import type { StateTag } from '../elemental.js';
import type { RitualState } from '../rituals.js';
import type { Position, ActionEconomyState, Direction } from './primitives.js';
import type { StatusEffect, ActiveEffect, ActiveCondition, ConcentrationState, ActiveRider, SavePenaltyRider } from './effects.js';
import type { RacialReaction, Ability } from './actions.js';
import type { TerrainMovementPolicy } from '../../utils/combat/movementUtils';

export type { CharacterStats };


export type { SpellSlots };


export interface SpellMemoryEntry {
  spellId: string;
  spellName?: string;
  casterId: string;
  affectedTurn: number;
  expiresAtTurn: number;
  kind: "cast_by_caster" | string;
}


export interface SocialAwarenessEntry {
  sourceSpellId: string;
  sourceSpellName?: string;
  casterId: string;
  learnedTurn: number;
  kind: "post_charm_awareness" | string;
  targetKnows: string;
}


/**
 * Post-combat snapshot of a party member's mutable resources. Combat runs on
 * transient CombatCharacter copies; when a battle ends this carries each surviving
 * player's final HP, spent spell slots, and used limited-use abilities back to the
 * persistent PlayerCharacter so attrition sticks instead of resetting every fight.
 */
export interface CombatPartySnapshotEntry {
  /** Accepted final tactical footing, used to resume a source dungeon floor. */
  position?: Position;
  id: string;
  currentHP: number;
  spellSlots?: SpellSlots;
  limitedUses?: LimitedUses;
  /** Original prepared concentration records ended during this battle. */
  endedPreparedConcentrationIds?: string[];
}


/**
 * Final mutable state for one enemy when combat leaves the tactical screen.
 *
 * The application-level outcome bridge needs more than an enemy id: WorldForge
 * must know which saved creature the token represented and where it was last
 * seen. The bridge deliberately carries the original source receipt unchanged
 * so a mismatched or anonymous enemy can fail closed instead of being attached
 * to the nearest plausible monster scene.
 */
export interface CombatEnemySnapshotEntry {
  id: string;
  currentHP: number;
  position: Position;
  worldSource?: WorldforgeCombatantSource;
  /** Retain spent source-enemy resources across a retreat and later contact. */
  spellSlots?: SpellSlots;
  limitedUses?: LimitedUses;
}


/**
 * Optional source-world identity for combatants projected from a generated
 * regiment. Combat rules still use the normal character fields; this receipt
 * lets diagnostics and later world-delta handling trace a token back to the
 * exact state, regiment, and military unit that authorized it.
 */
export interface WorldforgeDefenderSource {
  kind: "worldforge-defender";
  burgId: number;
  stateId: number;
  regimentIndex: number;
  unitType: string;
  representativeIndex: number;
}


/** Social function authored for one creature in a generated threat scene. */
export type OpeningThreatSocialRole =
  | "contact-lead"
  | "screen-left"
  | "screen-right"
  | "escape-guard"
  | "pack-scout"
  | "scent-flanker";


/** Map-scale posture frozen into an opening scene instead of inferred by UI. */
export type OpeningThreatBodyPosture =
  | "upright"
  | "crouched-left"
  | "crouched-right"
  | "rear-lean"
  | "low-scout"
  | "scenting";


/** Physical load that changes a creature's silhouette at tactical scale. */
export type OpeningThreatCarriedProfile =
  "none" | "salvage-pack" | "long-tool" | "buckler" | "rolled-bedding";


/**
 * Source-authored body facts for one opening creature. This stays optional on
 * the shared combat source so old v1/v2 saves remain loadable; every newly
 * authored scene writes it and strict replay preserves it exactly.
 */
export interface OpeningThreatBodyState {
  posture: OpeningThreatBodyPosture;
  carriedProfile: OpeningThreatCarriedProfile;
  facingDirection: { x: number; z: number };
}


/**
 * Persistent source identity for a monster placed by WorldForge rather than by
 * the tactical spawn referee. Combat rules remain ordinary CombatCharacter
 * fields; this record preserves the scene, role, and exact world position.
 */
export interface WorldforgeOpeningThreatSource {
  kind: "worldforge-opening-threat";
  sceneReceiptId: string;
  sourceOpeningReceiptId: string;
  entityId: string;
  monsterName: string;
  monsterOrdinal: number;
  socialRole: OpeningThreatSocialRole;
  worldGroundMeters: { x: number; z: number };
  bodyState?: OpeningThreatBodyState;
}


/** One actual generated surface creature, scoped to its source world and cell.
 * Its original meters and referee tile remain paired throughout combat. */
export interface WorldforgeSurfaceHostileSource {
  /** Original cohort retained across death, retreat and regenerated presence. */
  sourceGroup?: GroundHostileSourceGroup;
  kind: "worldforge-surface-hostile";
  sourceScope: string;
  encounterReceiptId: string;
  worldSeed: number;
  sourceCellId: number;
  entityId: string;
  monsterId: string;
  worldGroundMeters: { x: number; z: number };
  sourcePatchTile: { x: number; y: number };
}

export type WorldforgeCombatantSource =
  WorldforgeDefenderSource | WorldforgeOpeningThreatSource | WorldforgeSurfaceHostileSource;


// ============================================================================
// Combat equipment projection
// ============================================================================
// Combat rules need a stable view of worn protective equipment, but they do
// not need inventory quantities, containers, prices or item-management state.
// This projection carries the rule-facing armour facts into combat while the
// persistent character remains the owner of the complete equipped item.

export interface CombatArmorEquipmentState {
  /** Stable inventory identity used to trace a combat modifier to its source. */
  itemId: string;
  itemName: string;
  slot: "Torso" | "OffHand";
  category?: NonNullable<Item["armorCategory"]>;
  /**
   * `unknown` is deliberate for older/imported items without magic metadata.
   * Combat must not infer magic from an item's name, rarity or description.
   */
  magicStatus: "magical" | "nonmagical" | "unknown";
  properties: string[];
  baseArmorClass?: number;
  armorClassBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
}


export interface CombatEquipmentState {
  /** The torso item that establishes light, medium or heavy armour rules. */
  wornArmor?: CombatArmorEquipmentState;
  /** A shield is kept separate because it supplements rather than replaces armour. */
  shield?: CombatArmorEquipmentState;
}


/**
 * The equipped-item snapshot a combatant can carry into combat.
 *
 * WHAT CHANGED (agora-d649): this replaces `equippedItems?: any[]` on
 * `CombatCharacter`. WHY IT CHANGED: the field was never an array at runtime —
 * every producer and consumer treats it as the persistent character's
 * slot-keyed record — so each attack bridge (True Strike, Booming Blade, Green
 * Flame Blade) had to re-declare the real shape through an ad-hoc
 * `caster as CombatCharacter & { equippedItems?: ... }` cast before it could
 * read `MainHand`. WHAT IS PRESERVED: the field stays optional, because
 * `createPlayerCombatCharacter` projects only rule-facing `equipment` facts and
 * leaves the full item snapshot to the surfaces that actually attach it.
 * WHAT REMAINS DEFERRED: the two cantrip bridges still hold their own local
 * `EquippedItemSnapshot` casts; they are owned by another packet.
 */
export type CombatEquippedItems = Partial<Record<EquipmentSlotType, Item>>;


export interface CombatCharacter {
  id: string;
  name: string;
  level: number; // For scaling calculations (CR for monsters, Level for PCs)
  /**
   * Challenge rating string for monsters (e.g. '1/8', '1/4', '1/2', '0', '1').
   * Carried directly onto the combatant so reward and loot calculations receive
   * the canonical CR without losing fractional ratings or converting CR 0 to level 1.
   */
  cr?: string;
  /**
   * Creature types for targeting (e.g., ['Humanoid', 'Elf']).
   * Used by spells like Charm Person or Hold Person.
   * These remain plain strings because combatants are assembled from JSON,
   * generated monster data, tests, and saved games. CreatureTaxonomy performs
   * canonical validation where rules need a known CreatureType; narrowing this
   * storage boundary would reject otherwise valid serialized characters.
   */
  creatureTypes?: string[];
  alignment?: string; // e.g., 'Chaotic Evil', 'Lawful Good'
  class: Class;
  /** Saved class choice used by shared weapon rules; class options alone do not grant a style. */
  selectedFightingStyle?: FightingStyle;
  savingThrowProficiencies?: AbilityScoreName[]; // For characters that have additional saving throw proficiencies (e.g. from feats)
  position: Position;
  /**
   * Live vertical position for a creature using a Fly Speed.
   *
   * The ordinary `position` remains the creature's horizontal footprint anchor.
   * This separate record lets movement, collision checks, 2D badges, and the 3D
   * actor agree about height without pretending a raised creature stands on an
   * elevated ground tile. Grounded creatures leave this field undefined.
   */
  aerialMovement?: {
    /** Height above the battle map's local zero-foot floor. */
    altitudeFeet: number;
    /** Whether the creature is currently occupying air rather than the ground. */
    isFlying: boolean;
    /** Hover prevents Prone, Incapacitated, or zero Fly Speed from causing a fall. */
    canHover: boolean;
    /** Human-readable provenance such as a stat block, spell, or scenario fixture. */
    source?: string;
  };
  /**
   * Canonical receipt for a creature that is currently falling or has just
   * resolved one fall event.
   *
   * The event id prevents a delayed UI callback or reaction replay from
   * applying the same landing, damage, resource payment, or death-state change
   * twice. Ordinary grounded creatures omit this record entirely.
   */
  fallingState?: {
    eventId: string;
    isFalling: boolean;
    sourcePosition: Position;
    sourceElevationFeet: number;
    fallDistanceFeet: number;
    resolvedAt?: Position;
    mitigation?: 'feather_fall';
  };
  stats: CharacterStats;
  abilities: Ability[];
  team: "player" | "enemy" | "neutral";
  spellcastingAbility?: AbilityScoreName | 'wisdom' | 'charisma' | 'intelligence' | 'strength' | 'dexterity' | 'constitution' | string;
  /** Slot-keyed equipped items carried into combat; see `CombatEquippedItems`. */
  equippedItems?: CombatEquippedItems;
  worldSource?: WorldforgeCombatantSource;
  currentHP: number;
  maxHP: number;
  /** Minimum d20 roll for a critical hit (default 20; 19 for Champion fighters). */
  critThreshold?: number;
  /**
   * Dark One's Blessing (Fiend warlock, level 3): when this character reduces a
   * hostile creature to 0 HP, they gain temporary hit points equal to this
   * value (Charisma modifier + warlock level, minimum 1). Set once at combat
   * character construction so the damage engine can grant the temp HP without
   * re-deriving subclass/level state mid-combat.
   */
  darkOnesBlessingTempHp?: number;
  /**
   * Hunter's Prey (Hunter ranger, level 3): the chosen option among Colossus
   * Slayer, Giant Killer, and Horde Breaker. Set once at the level-3 milestone
   * so the combat engine can gate the subclass-specific riders without
   * re-deriving subclass state mid-combat. Non-Hunter rangers leave it unset.
   */
  hunterPreyChoice?: 'colossus_slayer' | 'giant_killer' | 'horde_breaker';
  /**
   * Beast Master (ranger, level 3) Primal Companion form. Stored on the beast so
   * scaling (HP/AC/speed) and Beast's Strike can be re-derived from the chosen
   * Land, Sea, or Sky form without re-reading the ranger's subclass mid-combat.
   * Non-Beast-Master creatures leave it unset.
   */
  primalBeastForm?: 'land' | 'sea' | 'sky';
  /**
   * Vow of Enmity (Oath of Vengeance paladin, level 3 — Channel Divinity): the
   * id of the single sworn foe the paladin gains advantage against. Target-bound
   * so the advantage applies to that foe only, not every attack. Cleared when
   * the one-minute vow ends.
   */
  vowOfEnmityTargetId?: string;
  /**
   * Arcane Ward (Abjurer wizard, level 3): current ward hit points that absorb
   * damage before the wizard's own hit points. Created and recharged from
   * qualifying Abjuration spells; max is 2×level + Intelligence modifier.
   * Absent (or 0) means no ward is active.
   */
  arcaneWardHp?: number;
  /**
   * Arcane Armor (Armorer artificer, level 3): the chosen model — Guardian
   * (Thunder Gauntlets, Defensive Field) or Infiltrator (Lightning Launcher).
   * Persisted so the model-specific attack/benefit can be resolved without
   * re-reading the subclass mid-combat.
   */
  armorerModel?: 'guardian' | 'infiltrator';
  /** Optional death saving throw tracking for downed player characters (at 0 HP). */
  deathSaves?: {
    successes: number;
    failures: number;
    isStable?: boolean;
  };
  savePenaltyRiders?: SavePenaltyRider[];
  /** Optional: tracks remaining/total Hit Point Dice for rest-like mechanics. */
  hitPointDice?: HitPointDicePool[];
  initiative: number;
  statusEffects: StatusEffect[];
  /** Stable Hide, search, and movement event ids already applied to this actor. */
  stealthEventIds?: string[];
  conditions?: ActiveCondition[];
  /**
   * Long-lived spell interaction memory used for recast gates such as Friends'
   * "cast on this target within 24 hours" auto-success rule.
   */
  spellMemory?: SpellMemoryEntry[];
  /**
   * Character-facing aftermath facts such as knowing a caster charmed them.
   * This is intentionally factual state, not a full relationship system.
   */
  socialAwareness?: SocialAwarenessEntry[];
  /**
   * Character ids that can currently hear this creature well enough to use
   * hearing-based target acquisition. This is intentionally narrow: it gives
   * spells such as Vicious Mockery a runtime hook without pretending the full
   * stealth/noise system already exists.
   */
  audibleTo?: string[];
  facing?: Direction; // For directional abilities
  actionEconomy: ActionEconomyState;
  spellbook?: SpellbookData;
  spellSlots?: SpellSlots;
  limitedUses?: LimitedUses;
  concentratingOn?: ConcentrationState;
  currentRitual?: RitualState;

  /**
   * List of feats the character possesses (e.g., "Slasher", "Sentinel").
   * Used for conditional logic in commands (e.g., Slasher slows on hit).
   */
  feats?: string[];
  featChoices?: Record<string, FeatChoice>;

  /** Elemental states (Wet, Frozen, etc.) affecting the character */
  stateTags?: StateTag[];

  // Summoning fields
  isSummon?: boolean;
  summonMetadata?: {
    casterId: string;
    spellId: string;
    entityType?: string;
    formName?: string;
    sourceName?: string;
    persistent?: boolean;
    dismissAction?: "action" | "bonus_action" | "free" | "none";
    commandCost?: "action" | "bonus_action" | "free" | "none";
    commandsPerTurn?: number;
    commandsUsedThisTurn?: number;
    initiativePolicy?: "immediate" | "rolled" | "shared";
    followDistance?: number;
    hoverHeight?: number;
    carriedWeightPounds?: number;
    telepathyRange?: number;
    sharedSenses?: boolean;
    sharedSensesCost?: "action" | "bonus_action" | "free" | "none";
    travelDetails?: Record<string, unknown>;
    conditionalEndings?: ConditionalEnding[];
    lifecycle?: {
      hitPointMaximum?: string;
      repairOnly?: string;
      zeroHpEnding?: string;
      recastEnding?: string;
      spellEnding?: string;
      concentrationBreak?: string;
    };
    control?: {
      entityType?: string;
      source?: string;
      allegiance?: string;
      obedience?: string;
      initiative?: string;
      restrictions?: string[];
      destruction?: string;
      bargainingRequired?: boolean;
      noCompulsion?: boolean;
      serviceLimit?: string;
      return?: string;
      bondLimit?: string;
      noCommandBehavior?: string;
    };
    actionPermissions?: {
      canAttack?: boolean;
      canDeliverTouchSpells?: boolean;
      touchDeliveryRangeFeet?: number;
      touchDeliveryCost?:
        "reaction" | "action" | "bonus_action" | "free" | "none";
      independentInitiative?: boolean;
      obeysCasterCommands?: boolean;
      notes?: string;
    };
    /** Optional ground protection created by a summoned creature's casting component. */
    bloodCircle?: {
      center: Position;
      protectedTiles: Position[];
    };
    formTraits?: Array<{
      name: string;
      appliesToForms?: string[];
      opportunityAttackPolicy?:
        "does_not_provoke_when_flying_out_of_reach" | "normal";
      movementModeRequired?: "fly" | "walk" | "swim" | "climb" | "any";
      notes?: string;
    }>;
    aftermathState?: Record<string, unknown>;
    durationRemaining?: number;
    dismissable?: boolean;
  };

  // Defensive tracking (for DefensiveCommand)
  armorClass?: number; // Current AC (including bonuses)
  baseAC?: number; // Base AC before temporary bonuses
  /**
   * Rule-facing equipment facts projected from the persistent character.
   * This supports armour, shield and item-property rules without copying the
   * complete inventory into the tactical state.
   */
  equipment?: CombatEquipmentState;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[]; // Added for full 5e mechanics support
  immunities?: DamageType[];
  /** Damage types resisted only against nonmagical attacks (e.g. lycanthropes). */
  nonMagicalResistances?: string[];
  /** Damage types that grant immunity only against nonmagical attacks. */
  nonMagicalImmunities?: string[];
  conditionImmunities?: ConditionName[];
  tempHP?: number; // Temporary hit points
  /** Spell or feature that supplied the current temporary hit points. */
  temporaryHitPointSource?: {
    spellId: string;
    spellName: string;
    casterId: string;
  };
  /**
   * Combat-facing armor material shortcut for spells that care about metal.
   *
   * Shocking Grasp is the pilot: the broader item system does not yet expose a
   * canonical material taxonomy for every equipped item, so combat can carry
   * this derived flag without forcing an inventory-wide migration first.
   */
  hasMetalArmor?: boolean;
  activeEffects?: ActiveEffect[]; // Active spell effects
  riders?: ActiveRider[]; // Active damage riders (smites, hex, etc)
  damagedThisTurn?: boolean; // Track if character took damage this turn (for concentration/repeat saves)
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  modifiers?: {
    advantage: string[];
    disadvantage: string[];
    bonuses: string[];
    baseArmorClass?: number;
    acBonus?: number;
    reachBonus?: number;
    powerfulBuild?: boolean;
    unendingBreath?: boolean;
    languages?: string[];
    skillProficiencies?: string[];
    weaponProficiencies?: string[];
    armorProficiencies?: string[];
    initiativeBonus?: number;
    initiativeProficiency?: boolean;
    ignoreDifficultTerrain?: boolean;
    terrainPolicyId?: 'earth-walk' | 'timberwalk' | 'any-difficult-terrain';
    terrainPolicy?: TerrainMovementPolicy;
    breathWeapon?: RacialBreathWeapon;
    savageAttacks?: boolean;
    reactions?: RacialReaction[];
  };
  /** Tracks which feat effects have been used this turn (e.g., 'slasher_slow' for once-per-turn limit) */
  featUsageThisTurn?: string[];
  initiativeBonus?: number;
  initiativeProficiency?: boolean;
  ignoreDifficultTerrain?: boolean;
  /**
   * The race-aware terrain movement policy this combatant moves under, named by
   * the trait that grants it (GG-257). `ignoreDifficultTerrain` above is the
   * unqualified waiver and cannot say WHICH squares are waived, so an Earth
   * Genasi waded through difficult water for free. This field carries the
   * qualifier: `utils/combat/movementUtils` owns the matching predicate and
   * `resolveCombatantTerrainMovementPolicy` in `utils/combat/combatUtils` turns
   * the id back into it. Unset means the combatant has no qualified waiver.
   *
   * The literal union is repeated here rather than imported because
   * `movementUtils` imports this module; `TerrainMovementPolicyId` is the same
   * union and a unit test pins the two together.
   */
  terrainPolicyId?: 'earth-walk' | 'timberwalk' | 'any-difficult-terrain';
  terrainPolicy?: TerrainMovementPolicy;
  /** Whether this creature is surprised at combat start (GG-258). */
  isSurprised?: boolean;
  // Optional bookkeeping for analytics/logs; these were used in factories/tests.
  damageDealt?: unknown[];
  healingDone?: unknown[];
  // Some mocks still pass extra save proficiencies; keep optional until model is unified.
  additionalSavingThrowProficiencies?: AbilityScoreName[];
}


export interface PocketedSummon {
  summon: CombatCharacter;
  casterId: string;
  spellId: string;
  dismissedTurn: number;
  lastKnownPosition: Position;
  reason: "familiar_pocket" | "manual_dismissal";
}
