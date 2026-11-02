/**
 * @file combat/log.ts
 * Closed combat-log payloads and their category-aware producer contracts.
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
import type { CombatEventClass } from '../combatMessages.js';
import type { SpellEffect, RepeatSave, AbilityCheckModifier, CreatedObject, TerrainManipulation, ControlOption, TauntEffect, TauntBreakEvent, UtilityEffect } from '../spells.js';
import type { StateTag } from '../elemental.js';
import type { Position } from './primitives.js';
import type { ActiveCondition, ActiveRider, LightSource, SpellObjectImpact, SpellCommunicationExchange, ActiveIllusionEffect, ActiveFireEffect, ActiveShapeWaterEffect, ActiveThaumaturgyEffect, ActiveMinorUtilityEffect, ActiveTruePolymorphTransformation, ActiveMoldEarthSurfaceMark } from './effects.js';
import type { CombatAction } from './actions.js';
import type { CombatTurnGroup, ActiveCombatTurnGroup } from './turn.js';
import type { EnvironmentalEffect } from './map.js';

// ============================================================================
// Combat log payload contract
// ============================================================================
// Combat records are read by concentration cleanup, the message adapter, combat
// history and tests. The outer `type` field is the discriminator, so producers
// keep their existing runtime shape while TypeScript checks the allowed payload
// for that record category. There is deliberately no catch-all index signature:
// a renamed field now fails at the producer instead of silently breaking a reader.

export type CombatLogType =
  | "action"
  | "damage"
  | "heal"
  | "status"
  | "summon"
  | "movement"
  | "turn_start"
  | "turn_end";


/**
 * Log-view of a shared-initiative turn transition. Mirrors the scheduler's
 * `GroupTurnTransition` (utils/combat/groupTurnUtils) without importing from
 * the utils layer, keeping the type module self-contained.
 */
export interface CombatTurnTransitionLogData {
  previousCharacterId: string | null;
  nextCharacterId: string | null;
  previousGroupId: string | null;
  nextGroupId: string | null;
  isGroupCompleted: boolean;
  isNewRound: boolean;
  skippedMemberIds: string[];
}


/**
 * Fields used across more than one combat-log category.
 *
 * These include the stable concentration links that let the game remove an
 * effect when its spell ends. Keeping their domain types here removes the old
 * casts and shape guessing from concentration cleanup.
 */
export interface CommonCombatLogData {
  /** Existing action-outcome journal payloads retained for history readers. */
  actionName?: string;
  healing?: number;
  statusEffect?: string;
  appliedStatusId?: string;
  /** Source-backed choices and pillar outcomes emitted by spell commands. */
  targetWilling?: boolean;
  voluntaryFailure?: boolean;
  pillarLifted?: boolean;
  blockedPillar?: boolean;
  grantedActionName?: string;
  abilityName?: string;
  advantageFromCombat?: boolean;
  blockerReason?: string;
  condition?: ActiveCondition;
  certainDeath?: boolean;
  conflictsWithDesires?: boolean;
  currentHitPoints?: number;
  damage?: number;
  damageAmount?: number;
  damageIgnored?: boolean;
  damageType?: string;
  damagedStructureId?: string;
  heal?: number;
  healAmount?: number;
  grantedAction?: string;
  grantedActionAreaShape?: unknown;
  grantedActionAreaSize?: number;
  grantedActionAreaSizeUnit?: string;
  grantedActionAttackType?: string;
  grantedActionCost?: unknown;
  grantedActionDamageAbilityModifier?: boolean;
  grantedActionDamageDice?: string;
  grantedActionDamageType?: string;
  grantedActionEndsWhenLengthZero?: boolean;
  grantedActionFrequency?: string;
  grantedActionPrerequisites?: unknown;
  grantedActionRangeLimit?: number;
  grantedActionSaveEffect?: string;
  grantedActionSaveType?: string;
  grantedActionWallLengthReduction?: number;
  isCrit?: boolean;
  isCritical?: boolean;
  isDeath?: boolean;
  isImmune?: boolean;
  isResisted?: boolean;
  isVulnerable?: boolean;
  immunityApplied?: boolean;
  resistanceApplied?: boolean;
  vulnerabilityApplied?: boolean;
  resistedDamageType?: string;
  vulnerableDamageType?: string;
  immuneDamageType?: string;
  defenseTags?: string[];
  defenseMultiplier?: number;
  channel?: string;
  lightSource?: LightSource;
  notes?: string;
  privateRecipientIds?: string[];
  rider?: ActiveRider;
  rollResult?: number;
  source?: string;
  sourceSpellId?: string;
  spellId?: string;
  spellCommunicationExchange?: SpellCommunicationExchange;
  spellName?: string;
  spellSchool?: string;
  socialServiceRequest?: string;
  statusEffectName?: string;
  statusId?: string;
  structureSurface?: string;
  summonedId?: string;
  targetTags?: string[];
  targetId?: string;
  outcome?: string;
  harmful?: boolean;
  repeatSaveTiming?: string;
  dc?: number;
  firstRoll?: number;
  secondRoll?: number;
  sectionDestroyed?: boolean;
  sectionId?: string;
}


/** Records for attacks, abilities, summons and other deliberate actions. */
export interface ActionCombatLogData extends CommonCombatLogData {
  /** The full resolved action, preserved so history readers can replay it. */
  action?: CombatAction;
  activeTargetId?: string;
  actionType?: string;
  affectedPositions?: Position[];
  allocationApplied?: boolean;
  /**
   * The Assassinate modifiers that applied to one attack roll (Assassin rogue,
   * level 3). Written only when the rider resolved and granted something.
   */
  assassinate?: { advantage: boolean; criticalOnHit: boolean };
  /** Resolved attack-roll flags and their source receipts. Both flags mean
   * cancellation; these explain the chosen face without changing raw dice. */
  advantage?: boolean;
  disadvantage?: boolean;
  closeCombatPressure?: boolean;
  attackRollModifierSources?: string[];
  attackModifier?: number;
  attackRoll?: number;
  attackTotal?: number;
  attackType?: string;
  /** Set to 'movement_blocked' when a blood-circle effect halts movement. */
  bloodCircle?: string;
  availableControlOptions?: string[];
  casterId?: string;
  commandDescription?: string;
  commandSurface?: string;
  commandsPerTurn?: number;
  commandsUsedThisTurn?: number;
  currentTurn?: number;
  destination?: Position;
  dismissAction?: string;
  entityType?: string;
  familiarId?: string;
  from?: Position;
  forcedMovement?: unknown;
  formName?: string;
  grantedAction?: string;
  grantedActionAreaShape?: unknown;
  grantedActionAreaSize?: number;
  grantedActionAreaSizeUnit?: string;
  grantedActionAttackType?: string;
  grantedActionCost?: unknown;
  grantedActionDamageAbilityModifier?: boolean;
  grantedActionDamageDice?: string;
  grantedActionDamageType?: string;
  grantedActionEndsWhenLengthZero?: boolean;
  grantedActionFrequency?: string;
  grantedActionPrerequisites?: unknown;
  grantedActionRangeLimit?: number;
  grantedActionSaveEffect?: string;
  grantedActionSaveType?: string;
  grantedActionWallLengthReduction?: number;
  /**
   * True when the attacker held an undetected Hide-derived Hidden source
   * against this defender, so the roll was made with Advantage. Published on
   * the attack entry because the status is removed right after the roll
   * (AbilityCommandFactory), leaving no other record of why it applied.
   */
  hiddenAttackerAdvantage?: boolean;
  /** A confirmed hit promoted by a live nearby-target condition, after defenses. */
  conditionCritical?: { condition: string; distanceFeet: number };
  interruptedSpellId?: string;
  isAutoMiss?: boolean;
  isHit?: boolean;
  manipulation?: TerrainManipulation;
  maplessBoundsPolicy?: string;
  maxDistance?: number;
  movedDancingLights?: unknown;
  movedHelperId?: string;
  movementFeet?: number;
  movementGain?: number;
  notes?: string;
  /**
   * How far resource payment got before the action was refused. `'not_started'`
   * marks a rejection raised before any slot, use, or action cost was spent,
   * so a reader knows nothing needs to be refunded (useAbilityExecution).
   */
  payment?: string;
  pendingGap?: string;
  pocketState?: string;
  position?: Position;
  primalSavageryDamageDice?: string;
  rejectedControlOption?: string;
  removedSummonId?: string;
  removedSummonIds?: string[];
  returnHomeOutcome?: string;
  saveSucceeded?: boolean;
  sharedSenses?: unknown;
  sourceName?: string;
  spellAttackInstanceCount?: number;
  spellAttackInstanceIndex?: number;
  spellAttackInstanceType?: string;
  summonDismissAction?: string;
  summonEffect?: SpellEffect;
  summonLabel?: string;
  summonReturnHomeAction?: string;
  surfaceMark?: ActiveMoldEarthSurfaceMark;
  targetArmorClass?: number;
  /**
   * The free 5-foot shove Tavern Brawler offers after a hit with an Unarmed
   * Strike or an Improvised Weapon (AbilityCommandFactory). The offer is
   * published, not applied, so the executor or the player decides.
   *
   * Typed `unknown` because the shape (`TavernBrawlerShoveOffer`) is declared
   * in `utils/combat/shoveUtils.ts`, and nothing under `src/types` imports from
   * `utils`. Same treatment as `forcedMovement` and `sharedSenses` above.
   */
  tavernBrawlerShoveOffer?: unknown;
  /** Voluntary movement rule that rejected the action. */
  tauntConstraint?: string;
  telepathyRange?: number;
  teleportedSummonId?: string;
  terrainEffect?: EnvironmentalEffect;
  to?: Position;
  total?: number;
  attemptedDestination?: Position;
  requestedDestination?: Position;
  requestedDistanceFeet?: number;
  requestedBudgetTiles?: number;
  actualDistanceTiles?: number;
  actualDistanceFeet?: number;
  budgetSpentFeet?: number;
  budgetRemainingFeet?: number;
  clampedByBounds?: boolean;
  usedFallbackDestination?: boolean;
  utilityEffect?: Extract<SpellEffect, { type: "UTILITY" }>;
  vanishedDancingLights?: unknown;
  weaponType?: string;
}


/** Records for hit-point loss and damage dealt to combat objects. */
export interface DamageCombatLogData extends CommonCombatLogData {
  /** Typed parts of one hit, after each part's defenses and whole-hit prevention. */
  damageComponents?: Array<{ damageType: string; rawDamage: number; finalDamage: number }>;
  /** Marks the one authoritative boundary after defenses, temporary HP, HP, and downing have resolved. */
  damageEventBoundary?: 'post_hp';
  /** Stable source/target ownership lets reaction consumers avoid guessing from display-oriented log fields. */
  sourceCharacterId?: string;
  targetCharacterId?: string;
  /** DamageCommand only publishes this event for a confirmed effect path; zero final damage remains explicit. */
  hitConfirmed?: boolean;
  rawDamage?: number;
  finalDamage?: number;
  hitPointsBefore?: number;
  hitPointsAfter?: number;
  temporaryHitPointsBefore?: number;
  temporaryHitPointsAfter?: number;
  targetDownedAfter?: boolean;
  targetIncapacitatedAfter?: boolean;
  currentHitPoints?: number;
  damageDealt?: number;
  damageDice?: string;
  damagedSpellForceId?: string;
  guardianId?: string;
  objectImpact?: SpellObjectImpact;
  repeatSaveOutcome?: string;
  spellForceSurface?: string;
  spellGuardianSurface?: string;
  targetId?: string;
  totalDamageDealt?: number;
  trigger?: string;
  type?: string;
  value?: number;
}


/** Records for hit-point and temporary-hit-point recovery. */
export interface HealCombatLogData extends CommonCombatLogData {
  healing?: number;
  trigger?: string;
  type?: string;
  value?: number;
}


/**
 * Records for conditions, spell-owned effects and lifecycle decisions.
 *
 * Status records cover the widest feature surface. Rare feature payloads stay
 * `unknown` until a reader needs their internal fields, but their field names
 * are still closed and checked at every producer.
 */
export interface StatusCombatLogData extends CommonCombatLogData {
  abilityCheckModifier?: AbilityCheckModifier;
  active?: boolean;
  activeIllusionEffect?: ActiveIllusionEffect;
  activeNonInstantaneousCount?: number;
  advantageText?: string;
  animatedObjectSurface?: string;
  animatedObjects?: unknown;
  animatingSpiritOnly?: boolean;
  attemptedMoveFeet?: number;
  attitude?: string;
  availableModes?: string[];
  awakenedCreature?: unknown;
  awakenedCreatureId?: string;
  awakenedCreatureSurface?: string;
  cannotCrossElevationChangeFeet?: boolean;
  carriedWeightPounds?: number;
  casterId?: string;
  chosenAbility?: AbilityScoreName;
  chosenSkill?: string;
  cleanup?: string;
  commandSurface?: string;
  commandsPerTurn?: number;
  commandsUsedThisTurn?: number;
  communicationControl?: unknown;
  communicationControlSurface?: string;
  companionSurface?: string;
  conditionName?: string;
  controlDirective?: string;
  controlOptions?: ControlOption[];
  controlState?: string;
  /** Set to 'broken' when a controlled summon's caster-side control ends. */
  summonControl?: string;
  /** Save DC/success captured when a delayed status save resolves. */
  saveDC?: number;
  saveResult?: boolean;
  /** Turn-order transition recorded when a removed actor hands the group over. */
  groupTransition?: CombatTurnTransitionLogData;
  removal?: string;
  /**
   * Status IDs this record ended. Written when attacking reveals a hidden
   * attacker and only the Hide-derived Hidden sources are removed, so a reader
   * can tell which sources ended from unrelated Hidden or Invisible state.
   */
  removedStatusIds?: string[];
  /**
   * How a combatant left the fight under their own power (fight-in-place 9B:
   * `'edge-of-map'`). Distinct from `removal`, which records a dismissal or
   * death; an escape is a choice the player made and paid movement for.
   */
  escape?: string;
  /** Movement feet an escape or similar movement-priced departure consumed. */
  movementCostFeet?: number;
  createdObjects?: CreatedObject[];
  creationState?: string;
  crumbleReason?: string;
  crumblesSafely?: boolean;
  currentHP?: number;
  currentTurn?: number;
  damageDealt?: number;
  damageDice?: string;
  dc?: number;
  deathSaves?: unknown;
  destination?: Position;
  destinationPosition?: Position;
  destinationPreference?: string;
  destroyedSpellForceId?: string;
  detail?: string;
  dismissedShapeWaterEffectId?: string;
  distanceFeet?: number;
  distanceFromCasterFeet?: number;
  durationRemaining?: number;
  elapsedHours?: number;
  earlyEndReason?: string;
  effectId?: string;
  eligibleWeaponTypes?: string[];
  empoweredWeaponId?: string;
  empoweredWeaponName?: string;
  endReason?: string;
  endedHelperId?: string;
  endingReason?: string;
  entityType?: string;
  environmentalControlSurface?: string;
  excessDamageCarriedOver?: number;
  existingHomunculusId?: string;
  expelledCreatureIds?: string[];
  expelledObjectIds?: string[];
  expulsionSurface?: string;
  failureOutcome?: string;
  familiarId?: string;
  feature?: string;
  fireEffect?: ActiveFireEffect;
  formName?: string;
  grantedAction?: string;
  guardianId?: string;
  handled?: boolean;
  leashDistanceFeet?: number;
  maxActiveNonInstantaneous?: number;
  maxCasterSeparationFeet?: number;
  maxDistanceFeet?: number;
  maxLoadPounds?: number;
  minorUtilityEffect?: ActiveMinorUtilityEffect;
  missingMinorUtilityMode?: string;
  modifiersApplied?: unknown;
  movementLimitFeet?: number;
  objectAccessChange?: unknown;
  objectRepair?: unknown;
  pendingAftermath?: string;
  pendingRise?: unknown;
  /**
   * The stable `AbilityPrerequisiteErrorCode` from `useCombatValidation` when an
   * ability action is refused before payment (for example `USES_DEPLETED`). It
   * rides its own field so a reader never has to split `rejectedReason` on a
   * colon to learn which prerequisite failed.
   */
  prerequisiteCode?: string;
  rangeLimit?: number;
  rejectedAttackAugment?: string;
  rejectedConjureFeyTeleport?: string;
  rejectedDancingLightsMove?: string;
  rejectedHelperMoveId?: string;
  rejectedHitPointState?: string;
  rejectedMinorUtilityMode?: string;
  rejectedObjectAccessChange?: string;
  rejectedPrestidigitationMode?: string;
  rejectedReason?: string;
  rejectedRepairState?: string;
  rejectedShapeWaterDismissal?: string;
  rejectedShapeWaterMode?: string;
  rejectedShapeWaterTarget?: string;
  rejectedThaumaturgyMode?: string;
  rejectedThaumaturgyTarget?: string;
  releasedTargetId?: string;
  removedExtradimensionalSpaceId?: string;
  removedRecastCommunicationControls?: number;
  removedRecastIllusions?: number;
  removedRecastLightSources?: number;
  removedStructureId?: string;
  removedSummonId?: string;
  removedSummonIds?: string[];
  removedWardId?: string;
  repeatPrerequisites?: unknown;
  repeatSave?: RepeatSave;
  repeatSaveOutcome?: string;
  repeatSaveProgress?: unknown;
  repeatSaveType?: string;
  replyText?: string;
  rerootReason?: string;
  rerootedGuardianIds?: string[];
  rerootsWhenSpellEndsIfPossible?: boolean;
  restrainedTargetId?: string;
  reversionReason?: string;
  revertedAnimatedObjectId?: string;
  saveOutcomeOverride?: string;
  saveSucceeded?: boolean;
  saveTotal?: number;
  saveType?: string;
  separationFeet?: number;
  shapeWaterEffect?: ActiveShapeWaterEffect;
  soulReturned?: boolean;
  sourceCasterId?: string;
  sourceName?: string;
  speedDelta?: number;
  spellCommunicationExchangeId?: string;
  spellForceSurface?: string;
  spellGuardianSurface?: string;
  status?: string;
  statusCondition?: string;
  statusName?: string;
  stateTags?: StateTag[];
  structureSurface?: string;
  summonCondition?: unknown;
  summonId?: string;
  summonReturnHomeAction?: string;
  suppressedConditionBenefit?: string;
  suppressedFireEffect?: unknown;
  targetId?: string;
  taunt?: TauntEffect;
  /** Structured reason a taunt-owned spell ended early. */
  tauntBreakEvent?: TauntBreakEvent;
  telepathyRange?: number;
  tempHp?: number;
  terrainControl?: unknown;
  thaumaturgyEffect?: ActiveThaumaturgyEffect;
  totalDamageDealt?: number;
  transientTransformation?: string;
  travelRule?: string;
  trigger?: string;
  truePolymorphTransformation?: ActiveTruePolymorphTransformation | string;
  utilityEffect?: unknown;
  vanishReason?: string;
  wardSurface?: string;
}


/** Records for creatures and persistent spell-created entities. */
export interface SummonCombatLogData extends CommonCombatLogData {
  animatedCount?: number;
  bloodCircleUsed?: boolean;
  bondLimit?: string | number;
  commandChannel?: string;
  companionSurface?: string;
  controlDurationHours?: number;
  controlState?: string;
  corpseIds?: string[];
  createdResource?: unknown;
  demonForm?: string;
  devilForm?: string;
  durationRemaining?: number;
  environmentalControl?: unknown;
  environmentalControlSurface?: string;
  expulsionSurface?: string;
  extradimensionalSpace?: unknown;
  formName?: string;
  hasTalisman?: boolean;
  hitPointState?: UtilityEffect["hitPointState"];
  maxTargets?: number;
  pendingAftermath?: string;
  removedBondedMountIds?: string[];
  removedRecastEnvironmentalControls?: number;
  removedRecastForces?: number;
  removedRecastGuardians?: number;
  removedRecastHelpers?: number;
  removedRecastSpaces?: number;
  removedRecastStructures?: number;
  removedRecastWards?: number;
  rolledCount?: number;
  sourceTargetId?: string;
  spellForce?: unknown;
  spellForceSurface?: string;
  spellGuardian?: unknown;
  spellGuardianSurface?: string;
  spellHelper?: unknown;
  spellHelperSurface?: string;
  spellStructure?: unknown;
  spellWard?: unknown;
  statScaling?: unknown;
  structureLifecycle?: unknown;
  structureSurface?: string;
  summonSurface?: string;
  transformedCreatureId?: string;
  travelDetails?: UtilityEffect["travelDetails"];
  trueNameSpoken?: boolean;
  truePolymorphTransformation?: ActiveTruePolymorphTransformation;
  wardSurface?: string;
  lockoutExpiresAtTimestamp?: number;
}


/** Records for map movement emitted by guardian and forced-movement systems. */
export interface MovementCombatLogData extends CommonCombatLogData {
  guardianId?: string;
  moveReason?: string;
  position?: Position;
  spellGuardianSurface?: string;
}


/** Records that establish initiative, joins and round boundaries. */
export interface TurnStartCombatLogData extends CommonCombatLogData {
  initiative?: number;
  initiatives?: Array<{ id: string; initiative: number }>;
  round?: number;
  turnOrder?: string[];
  turnGroups?: CombatTurnGroup[];
  groupContract?: Pick<
    ActiveCombatTurnGroup,
    "actionOwnership" | "movementOwnership" | "reactionOwnership" | "effectTiming"
  >;
  groupTransition?: CombatTurnTransitionLogData;
}


/** Turn-end records currently need no category-specific payload fields. */
export type TurnEndCombatLogData = CommonCombatLogData;


export interface CombatLogDataByType {
  action: ActionCombatLogData;
  damage: DamageCombatLogData;
  heal: HealCombatLogData;
  status: StatusCombatLogData;
  summon: SummonCombatLogData;
  movement: MovementCombatLogData;
  turn_start: TurnStartCombatLogData;
  turn_end: TurnEndCombatLogData;
}


type CombatLogCategoryData = CombatLogDataByType[keyof CombatLogDataByType];

type KeysOfUnion<Union> = Union extends Union ? keyof Union : never;

type ValueOfUnionField<Union, Field extends PropertyKey> = Union extends Union
  ? Field extends keyof Union
    ? Union[Field]
    : never
  : never;

type CombatLogCategoryField = KeysOfUnion<CombatLogCategoryData>;


/**
 * Closed readable view used by consumers that search across log categories.
 *
 * Existing history screens and tests often find a record by a payload field
 * before checking its outer type. This mapped view exposes every declared field
 * and the union of its declared value types. It does not restore an open string
 * index signature, so unknown field names still fail compilation.
 */
export type CombatLogData = {
  [Field in CombatLogCategoryField]?: ValueOfUnionField<CombatLogCategoryData, Field>;
};


interface CombatLogEntryBase {
  id: string;
  timestamp: number;
  message: string;
  characterId?: string;
  targetIds?: string[];
  /**
   * Typed classification stamped by the emitter (CMB-GAP-003, added 2026-09-09).
   *
   * WHY: routing used to be recovered downstream by matching words in `message`, which
   * breaks on any copy edit. An emitter that knows what it just did should say so.
   *
   * OPTIONAL ON PURPOSE: dozens of hooks emit log records. Records without this field
   * still route correctly through `deriveEventClass` in combatLogToMessageAdapter.ts,
   * so emitters can be migrated one at a time instead of in one sweeping change.
   */
  eventClass?: CombatEventClass;
}


/**
 * Stored combat history uses the closed readable payload view.
 *
 * New records enter through CombatLogEntryInput below, where the outer type
 * selects the category-specific payload. The stored view remains compatible
 * with history readers that inspect a declared field before its category.
 */
export interface CombatLogEntry extends CombatLogEntryBase {
  type: CombatLogType;
  data?: CombatLogData;
}


/**
 * Producer-facing union used before the log assigns its ID and timestamp.
 * Unlike the readable stored form, this keeps each category's input payload
 * separate so a producer cannot invent an undeclared field.
 */
export type CombatLogEntryInput = {
  [Type in CombatLogType]: Omit<CombatLogEntryBase, "id" | "timestamp"> & {
    type: Type;
    data?: CombatLogDataByType[Type];
  };
}[CombatLogType];
