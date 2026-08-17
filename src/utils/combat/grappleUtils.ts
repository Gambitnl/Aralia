// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/08/2026, 12:07:30
 * Dependents: commands/factory/AbilityCommandFactory.ts, components/BattleMap/CombatCharacterInspector.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/grappleEscapeScenarioControls.ts, hooks/combat/useTurnManager.ts, utils/combat/index.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves the shared creature-grapple rules used by combat surfaces.
 *
 * A grapple is stored in both of Aralia's condition mirrors, reduces the held
 * creature's live movement pool to zero, spends an action on an escape check,
 * and ends when its named grappler is missing, incapacitated, or beyond normal
 * five-foot reach. Tactical Sandbox calls these helpers, and future combat
 * actions can reuse the same functions instead of rebuilding grapple rules.
 *
 * Called by: grapple-backed combat actions and the Grapple & Escape sandbox.
 * Depends on: shared status, action-economy, ability-check, and distance helpers.
 */

import type {
  ActiveCondition,
  BattleMapData,
  CombatCharacter,
  Position,
  StatusEffect,
} from '../../types/combat';
import { rollAbilityCheck, type CheckResult } from '../character/checkUtils';
import {
  calculateMovementTotal,
  canAffordActionCost,
  consumeActionCost,
} from './actionEconomyUtils';
import { getCharacterDistance, getOccupiedTiles } from './combatUtils';
import { getTargetDistance } from './movementUtils';
import { isIncapacitated } from './deathSaveUtils';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

// ============================================================================
// Grapple Runtime Contract
// ============================================================================
// These stable facts describe an ordinary creature grapple. Source identity and
// escape metadata live on both condition mirrors, so UI, movement, and later
// rule executors all inspect the same relationship.
// ============================================================================

export const GRAPPLED_CONDITION_NAME = 'Grappled';
export const NORMAL_GRAPPLE_REACH_TILES = 1;
export const GRAPPLED_RULE_SUMMARY = [
  'Speed 0 and cannot increase.',
  'Attacks against anyone other than the grappler have disadvantage.',
  'The grappler can drag or carry the target at 1 extra foot of movement per foot, unless the target is Tiny or at least two sizes smaller.',
  'Ends on escape, voluntary release, grappler incapacity, or separation beyond the grapple reach.',
  'Grappled does not also apply Restrained.',
].join(' ');

export type GrappleEscapeAbility = 'Strength' | 'Dexterity';
export type GrappleEscapeSkill = 'Athletics' | 'Acrobatics';

export interface GrappleApplication {
  grapplerId: string;
  escapeDc: number;
  source?: string;
  durationRounds?: number;
}

export interface GrappleEscapeAttempt {
  character: CombatCharacter;
  attempted: boolean;
  success: boolean;
  check?: CheckResult;
  reason?: 'not_grappled' | 'action_unavailable' | 'invalid_escape_option';
}

export type GrappleReleaseReason = 'grappler_missing' | 'grappler_incapacitated' | 'out_of_reach';

export interface GrappleMaintenanceRelease {
  targetId: string;
  grapplerId: string;
  reason: GrappleReleaseReason;
}

export interface GrappleMaintenanceResult {
  characters: CombatCharacter[];
  releases: GrappleMaintenanceRelease[];
}

interface GrappleRuntimeFact {
  sourceCasterId: string;
  escapeDc: number;
}

// ============================================================================
// Paired Condition Creation And Removal
// ============================================================================
// Applying and ending a grapple always updates both runtime mirrors and then
// recalculates the current movement pool. That immediate refresh is what keeps
// movement clicks and the Action Economy display aligned with the visible badge.
// ============================================================================

function refreshMovementPool(character: CombatCharacter): CombatCharacter {
  const total = calculateMovementTotal(character);

  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      movement: {
        ...character.actionEconomy.movement,
        total,
        used: Math.min(character.actionEconomy.movement.used, total),
      },
    },
  };
}

function createGrappledStatus(
  target: CombatCharacter,
  application: GrappleApplication,
): StatusEffect {
  // Ordinary grapples have no round countdown. Infinity keeps the legacy
  // numeric status mirror alive until a real release rule removes it; callers
  // can still provide a round limit for a special effect that explicitly has one.
  const duration = application.durationRounds ?? Number.POSITIVE_INFINITY;
  const source = application.source ?? 'Grapple';

  return {
    id: `grapple-${application.grapplerId}-${target.id}`,
    name: GRAPPLED_CONDITION_NAME,
    type: 'debuff',
    description: GRAPPLED_RULE_SUMMARY,
    duration,
    source,
    sourceCasterId: application.grapplerId,
    effect: { type: 'condition' },
    escapeCheck: {
      abilityOptions: ['Strength', 'Dexterity'],
      skill: 'Athletics or Acrobatics',
      dc: application.escapeDc,
      actionCost: 'action',
      success: 'Ends the Grappled condition.',
      eligibleActors: ['affected_creature'],
    },
  };
}

function createGrappledCondition(
  application: GrappleApplication,
): ActiveCondition {
  const source = application.source ?? 'Grapple';

  return {
    name: GRAPPLED_CONDITION_NAME,
    // The rules-facing mirror uses its native permanent shape for an ordinary
    // maintained hold. "Permanent" here means no timer, not unbreakable: escape,
    // release, incapacity, and reach reconciliation remain authoritative.
    duration: application.durationRounds === undefined
      ? { type: 'permanent' }
      : { type: 'rounds', value: application.durationRounds },
    appliedTurn: 0,
    source,
    sourceCasterId: application.grapplerId,
    escapeCheck: {
      abilityOptions: ['Strength', 'Dexterity'],
      skill: 'Athletics or Acrobatics',
      dc: application.escapeDc,
      actionCost: 'action',
      success: 'Ends the Grappled condition.',
      eligibleActors: ['affected_creature'],
    },
  };
}

export function applyGrappledCondition(
  target: CombatCharacter,
  application: GrappleApplication,
): CombatCharacter {
  // The generic runtime helper refreshes a prior Grappled record rather than
  // stacking duplicate badges when the same hold is applied again.
  const applied = applyRuntimeStatusCondition(
    target,
    createGrappledStatus(target, application),
    createGrappledCondition(application),
  ).character;

  return refreshMovementPool(applied);
}

export function removeGrappledCondition(
  target: CombatCharacter,
  grapplerId?: string,
): CombatCharacter {
  const matchesOwnedGrapple = (fact: { name: string; sourceCasterId?: string }): boolean => (
    fact.name === GRAPPLED_CONDITION_NAME
    && (grapplerId === undefined || fact.sourceCasterId === grapplerId)
  );
  const statusEffects = target.statusEffects.filter(effect => !matchesOwnedGrapple(effect));
  const conditions = (target.conditions ?? []).filter(condition => !matchesOwnedGrapple(condition));

  // Preserve object identity when this target did not carry the named hold.
  if (
    statusEffects.length === target.statusEffects.length
    && conditions.length === (target.conditions ?? []).length
  ) {
    return target;
  }

  return refreshMovementPool({ ...target, statusEffects, conditions });
}

// ============================================================================
// Attack-Roll Disadvantage
// ============================================================================
// The 2024 Grappled rule does more than zero Speed: the held creature has
// disadvantage on attack rolls against every target other than its grappler.
// The grappler identity is the `sourceCasterId` carried by both condition
// mirrors, so attack resolution can key the penalty to the exact relationship
// instead of a broad "any Grappled" flag that would also penalize attacking
// the grappler itself.
// ============================================================================

export function hasGrappledAttackDisadvantage(
  attacker: CombatCharacter,
  targetId: string,
): boolean {
  const attacksSomeoneOtherThanGrappler = (fact: { name: string; sourceCasterId?: string }): boolean => (
    fact.name === GRAPPLED_CONDITION_NAME
    && typeof fact.sourceCasterId === 'string'
    && fact.sourceCasterId !== targetId
  );

  return (
    attacker.statusEffects.some(attacksSomeoneOtherThanGrappler)
    || (attacker.conditions ?? []).some(attacksSomeoneOtherThanGrappler)
  );
}

// ============================================================================
// Escape Action Resolution
// ============================================================================
// The attempt reads its DC and grappler identity from live Grappled metadata,
// spends the production action resource, and asks the shared ability-check
// roller for the result. An injected random stream makes proof deterministic
// without replacing the normal dice or skill-modifier rules.
// ============================================================================

function readGrappleRuntimeFact(character: CombatCharacter): GrappleRuntimeFact | null {
  const status = character.statusEffects.find(effect => (
    effect.name === GRAPPLED_CONDITION_NAME
    && typeof effect.sourceCasterId === 'string'
    && typeof effect.escapeCheck?.dc === 'number'
  ));
  const condition = (character.conditions ?? []).find(effect => (
    effect.name === GRAPPLED_CONDITION_NAME
    && typeof effect.sourceCasterId === 'string'
    && typeof effect.escapeCheck?.dc === 'number'
  ));
  const fact = status ?? condition;

  if (!fact?.sourceCasterId || typeof fact.escapeCheck?.dc !== 'number') {
    return null;
  }

  return {
    sourceCasterId: fact.sourceCasterId,
    escapeDc: fact.escapeCheck.dc,
  };
}

function isValidEscapePair(
  ability: GrappleEscapeAbility,
  skill: GrappleEscapeSkill,
): boolean {
  return (
    (ability === 'Strength' && skill === 'Athletics')
    || (ability === 'Dexterity' && skill === 'Acrobatics')
  );
}

export function resolveGrappleEscapeAttempt(
  target: CombatCharacter,
  ability: GrappleEscapeAbility,
  skill: GrappleEscapeSkill,
  options: { rng?: () => number } = {},
): GrappleEscapeAttempt {
  const grapple = readGrappleRuntimeFact(target);

  if (!grapple) {
    return { character: target, attempted: false, success: false, reason: 'not_grappled' };
  }

  if (!isValidEscapePair(ability, skill)) {
    return { character: target, attempted: false, success: false, reason: 'invalid_escape_option' };
  }

  if (!canAffordActionCost(target, { type: 'action' })) {
    return { character: target, attempted: false, success: false, reason: 'action_unavailable' };
  }

  const check = rollAbilityCheck(target, ability, skill, { rng: options.rng });
  const afterAction = consumeActionCost(target, { type: 'action' });
  const success = check.total >= grapple.escapeDc;

  return {
    character: success
      ? removeGrappledCondition(afterAction, grapple.sourceCasterId)
      : afterAction,
    attempted: true,
    success,
    check,
  };
}

// ============================================================================
// Grappler Maintenance
// ============================================================================
// Any roster update can pass through this pure reconciliation step. A hold ends
// when its source no longer exists, cannot maintain actions, or is more than one
// grid tile from the held creature. Unrelated conditions and actors are preserved.
// ============================================================================

export function reconcileGrappleMaintenance(
  characters: CombatCharacter[],
): GrappleMaintenanceResult {
  const releases: GrappleMaintenanceRelease[] = [];

  const reconciled = characters.map(target => {
    const grapple = readGrappleRuntimeFact(target);

    if (!grapple) {
      return target;
    }

    const grappler = characters.find(character => character.id === grapple.sourceCasterId);
    let reason: GrappleReleaseReason | null = null;

    if (!grappler) {
      reason = 'grappler_missing';
    } else if (isIncapacitated(grappler)) {
      reason = 'grappler_incapacitated';
    } else if (getCharacterDistance(grappler, target) > NORMAL_GRAPPLE_REACH_TILES) {
      reason = 'out_of_reach';
    }

    if (!reason) {
      return target;
    }

    releases.push({
      targetId: target.id,
      grapplerId: grapple.sourceCasterId,
      reason,
    });
    return removeGrappledCondition(target, grapple.sourceCasterId);
  });

  return { characters: reconciled, releases };
}

// ============================================================================
// Drag / Carry Movement
// ============================================================================
// A grappler can spend its own movement to drag or carry the held creature
// along. The 2024 rule charges one extra foot of movement per foot travelled
// unless the target is Tiny or at least two sizes smaller than the grappler.
// This resolver keeps the pair as one atomic transaction: both destinations are
// validated before either combatant moves, and the grappler's movement is paid
// only after the complete paired move is known to be legal. Movement executors
// and mounted proof share this resolver instead of teleporting tokens or
// replaying a second, scenario-only drag engine.
// ============================================================================

const DRAG_CARRY_SIZE_ORDER: NonNullable<CombatCharacter['stats']['size']>[] = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
];

function dragCarrySizeRank(size: string | undefined): number {
  const index = DRAG_CARRY_SIZE_ORDER.indexOf(
    size as NonNullable<CombatCharacter['stats']['size']>,
  );
  return index === -1 ? DRAG_CARRY_SIZE_ORDER.indexOf('Medium') : index;
}

export function dragCarrySizeExceptionApplies(
  grappler: CombatCharacter,
  target: CombatCharacter,
): boolean {
  const targetSize = target.stats.size ?? 'Medium';
  return (
    targetSize === 'Tiny'
    || dragCarrySizeRank(target.stats.size) <= dragCarrySizeRank(grappler.stats.size) - 2
  );
}

export type DragCarryRejectionReason =
  | 'grappler_missing'
  | 'target_missing'
  | 'not_grappling'
  | 'zero_distance'
  | 'grappler_destination_blocked'
  | 'target_destination_blocked'
  | 'insufficient_movement';

export interface DragCarryResolution {
  characters: CombatCharacter[];
  moved: boolean;
  reason?: DragCarryRejectionReason;
  movementCost: number;
  baseMovementCost: number;
  sizeExceptionApplied: boolean;
  grappler?: CombatCharacter;
  target?: CombatCharacter;
}

interface PairedPlacementCheck {
  allowed: boolean;
  reason: string;
}

function validatePairedPlacement(
  character: CombatCharacter,
  position: Position,
  mapData: BattleMapData | null,
  blockers: CombatCharacter[],
): PairedPlacementCheck {
  const candidate = { ...character, position: { ...position } };
  const occupiedTiles = getOccupiedTiles(candidate);

  if (mapData) {
    const missingTile = occupiedTiles.find(tile => !mapData.tiles.has(`${tile.x}-${tile.y}`));
    if (missingTile) {
      return { allowed: false, reason: 'footprint leaves the battle map' };
    }
    const blockedTile = occupiedTiles.find(tile => (
      mapData.tiles.get(`${tile.x}-${tile.y}`)?.blocksMovement === true
    ));
    if (blockedTile) {
      return { allowed: false, reason: 'footprint is blocked by terrain' };
    }
  }

  const occupiedKeys = new Set(occupiedTiles.map(tile => `${tile.x}-${tile.y}`));
  const blocker = blockers.find(other => (
    other.currentHP > 0
    && getOccupiedTiles(other).some(tile => occupiedKeys.has(`${tile.x}-${tile.y}`))
  ));
  if (blocker) {
    return { allowed: false, reason: `footprint overlaps ${blocker.name}` };
  }

  return { allowed: true, reason: 'placement is legal' };
}

export function resolveDragCarryMovement(
  characters: CombatCharacter[],
  request: {
    grapplerId: string;
    targetId: string;
    destination: Position;
    mapData?: BattleMapData | null;
    pathMovementCost?: number;
  },
): DragCarryResolution {
  const grappler = characters.find(character => character.id === request.grapplerId);
  if (!grappler) {
    return {
      characters, moved: false, reason: 'grappler_missing',
      movementCost: 0, baseMovementCost: 0, sizeExceptionApplied: false,
    };
  }

  const target = characters.find(character => character.id === request.targetId);
  if (!target) {
    return {
      characters, moved: false, reason: 'target_missing',
      movementCost: 0, baseMovementCost: 0, sizeExceptionApplied: false,
    };
  }

  const grapple = readGrappleRuntimeFact(target);
  if (grapple?.sourceCasterId !== grappler.id) {
    return {
      characters, moved: false, reason: 'not_grappling',
      movementCost: 0, baseMovementCost: 0, sizeExceptionApplied: false,
    };
  }

  const baseMovementCost = request.pathMovementCost
    ?? getTargetDistance(grappler.position, request.destination);
  if (baseMovementCost <= 0) {
    return {
      characters, moved: false, reason: 'zero_distance',
      movementCost: 0, baseMovementCost, sizeExceptionApplied: false,
    };
  }

  const sizeExceptionApplied = dragCarrySizeExceptionApplies(grappler, target);
  const movementCost = sizeExceptionApplied ? baseMovementCost : baseMovementCost * 2;

  if (!canAffordActionCost(grappler, { type: 'movement-only', movementCost })) {
    return {
      characters, moved: false, reason: 'insufficient_movement',
      movementCost, baseMovementCost, sizeExceptionApplied,
    };
  }

  // The held creature is dragged by the same delta the grappler travels, so
  // the pair stays adjacent. Validate both complete footprints before either
  // combatant moves — a blocked held-target square rejects the whole move.
  const delta = {
    x: request.destination.x - grappler.position.x,
    y: request.destination.y - grappler.position.y,
  };
  const targetDestination = {
    x: target.position.x + delta.x,
    y: target.position.y + delta.y,
  };

  const thirdParties = characters.filter(character => (
    character.id !== grappler.id && character.id !== target.id
  ));

  const grapplerPlacement = validatePairedPlacement(
    grappler, request.destination, request.mapData ?? null, thirdParties,
  );
  if (!grapplerPlacement.allowed) {
    return {
      characters, moved: false, reason: 'grappler_destination_blocked',
      movementCost, baseMovementCost, sizeExceptionApplied,
    };
  }

  const targetPlacement = validatePairedPlacement(
    target, targetDestination, request.mapData ?? null, thirdParties,
  );
  if (!targetPlacement.allowed) {
    return {
      characters, moved: false, reason: 'target_destination_blocked',
      movementCost, baseMovementCost, sizeExceptionApplied,
    };
  }

  // The pair must not land on each other. Same-delta dragging preserves the
  // original adjacency, but overlapping footprints still deserve the atomic
  // rejection rather than a merged token.
  const grapplerNewTiles = getOccupiedTiles({ ...grappler, position: { ...request.destination } });
  const targetNewTiles = getOccupiedTiles({ ...target, position: { ...targetDestination } });
  const grapplerNewKeys = new Set(grapplerNewTiles.map(tile => `${tile.x}-${tile.y}`));
  if (targetNewTiles.some(tile => grapplerNewKeys.has(`${tile.x}-${tile.y}`))) {
    return {
      characters, moved: false, reason: 'target_destination_blocked',
      movementCost, baseMovementCost, sizeExceptionApplied,
    };
  }

  const paidGrappler = consumeActionCost(grappler, { type: 'movement-only', movementCost });
  const movedGrappler = {
    ...paidGrappler,
    position: { ...request.destination },
  };
  const movedTarget = {
    ...target,
    position: { ...targetDestination },
  };

  const updatedCharacters = characters.map(character => {
    if (character.id === grappler.id) return movedGrappler;
    if (character.id === target.id) return movedTarget;
    return character;
  });

  return {
    characters: updatedCharacters,
    moved: true,
    movementCost,
    baseMovementCost,
    sizeExceptionApplied,
    grappler: movedGrappler,
    target: movedTarget,
  };
}
