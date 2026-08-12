// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/08/2026, 20:59:19
 * Dependents: components/DesignPreview/steps/scenarioControls/shoveProneScenarioControls.ts, utils/combat/index.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves the creature Shove option of an Unarmed Strike.
 *
 * It checks reach and relative size, rolls the target's real Strength or
 * Dexterity saving throw, then delegates a push to MovementCommand or applies
 * Prone through the paired runtime-condition helper. Tactical Sandbox is the
 * first caller, while normal combat actions can reuse the same result instead
 * of growing a second shove rules path.
 *
 * Called by: shove-backed combat actions and the Shove & Knock Prone sandbox.
 * Depends on: shared save, forced-movement, size, and status mechanics.
 */

import { MovementCommand } from '../../commands/effects/MovementCommand';
import type { CommandContext } from '../../commands/base/SpellCommand';
import type {
  ActiveCondition,
  CombatCharacter,
  CombatState,
  StatusEffect,
} from '../../types/combat';
import type { GameState } from '../../types';
import type { MovementEffect, SavingThrowAbility } from '../../types/spells';
import {
  calculateProficiencyBonus,
  rollSavingThrow,
  type SavingThrowResult,
} from '../character/savingThrowUtils';
import { getAbilityModifierValue } from '../character/statUtils';
import {
  getCharacterDistance,
} from './combatUtils';
import { applyRuntimeStatusCondition } from './statusConditionUtils';

// ============================================================================
// Shove Rule Contract
// ============================================================================
// A normal shove reaches one adjacent creature, accepts the target's Strength
// or Dexterity save, and can affect a creature at most one size larger. The two
// result choices share the same eligibility and save gate.
// ============================================================================

export const SHOVE_DISTANCE_FEET = 5;
export const SHOVE_REACH_TILES = 1;

export type ShoveChoice = 'push' | 'prone';

export type ShoveResolutionReason =
  | 'resolved_push'
  | 'resolved_prone'
  | 'save_succeeded'
  | 'blocked_destination'
  | 'target_too_large'
  | 'out_of_reach'
  | 'actor_missing';

export interface ShoveResolutionRequest {
  state: CombatState;
  gameState: GameState;
  shoverId: string;
  targetId: string;
  choice: ShoveChoice;
  saveAbility: Extract<SavingThrowAbility, 'Strength' | 'Dexterity'>;
  /** Deterministic simulations can provide a stream without bypassing save math. */
  rng?: () => number;
}

export interface ShoveResolution {
  state: CombatState;
  attempted: boolean;
  shoveSucceeded: boolean;
  reason: ShoveResolutionReason;
  saveDc?: number;
  save?: SavingThrowResult;
  message: string;
}

type CreatureSize = NonNullable<CombatCharacter['stats']['size']>;

const SIZE_ORDER: CreatureSize[] = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
];

// ============================================================================
// Eligibility And Difficulty
// ============================================================================
// Size defaults to Medium because legacy combatants without a stored size
// already occupy one ordinary tile. The same CharacterStats size labels used
// by occupied-footprint math provide the ordered rule categories here.
// ============================================================================

function readCreatureSize(character: CombatCharacter): CreatureSize {
  return character.stats.size ?? 'Medium';
}

export function calculateShoveSaveDc(shover: CombatCharacter): number {
  const strengthModifier = getAbilityModifierValue(shover.stats.strength);
  return 8 + calculateProficiencyBonus(shover.level || 1) + strengthModifier;
}

export function isTargetSizeEligibleForShove(
  shover: CombatCharacter,
  target: CombatCharacter,
): boolean {
  const shoverSize = readCreatureSize(shover);
  const targetSize = readCreatureSize(target);

  return SIZE_ORDER.indexOf(targetSize) <= SIZE_ORDER.indexOf(shoverSize) + 1;
}

// ============================================================================
// Canonical Push And Prone Effects
// ============================================================================
// Push uses MovementCommand so map bounds, wall tiles, occupied destinations,
// landing terrain, and forced-movement logs keep one authority. Prone is written
// to both condition mirrors so attack math and 2D/3D badges agree immediately.
// ============================================================================

function createShoveMovementEffect(): MovementEffect {
  return {
    type: 'MOVEMENT',
    movementType: 'push',
    distance: SHOVE_DISTANCE_FEET,
    duration: { type: 'instantaneous' },
    forcedMovement: {
      direction: 'away_from_caster',
      maxDistance: `${SHOVE_DISTANCE_FEET} ft`,
      usesReaction: false,
    },
    trigger: { type: 'immediate' },
    condition: { type: 'always' },
  };
}

function applyCanonicalPush(
  state: CombatState,
  gameState: GameState,
  shover: CombatCharacter,
  target: CombatCharacter,
): CombatState {
  const context: CommandContext = {
    spellId: 'unarmed-strike-shove',
    spellName: 'Unarmed Strike: Shove',
    castAtLevel: 0,
    caster: shover,
    targets: [target],
    gameState,
  };

  return new MovementCommand(createShoveMovementEffect(), context).execute(state);
}

function createProneStatus(shover: CombatCharacter, target: CombatCharacter): StatusEffect {
  return {
    id: `shove-prone-${shover.id}-${target.id}`,
    name: 'Prone',
    type: 'debuff',
    description: 'Crawl or spend half Speed to stand; nearby attacks have Advantage.',
    duration: 10,
    source: 'Unarmed Strike: Shove',
    sourceCasterId: shover.id,
    effect: { type: 'condition' },
  };
}

function createProneCondition(shover: CombatCharacter): ActiveCondition {
  return {
    name: 'Prone',
    duration: { type: 'rounds', value: 10 },
    appliedTurn: 0,
    source: 'Unarmed Strike: Shove',
    sourceCasterId: shover.id,
  };
}

function applyCanonicalProne(
  state: CombatState,
  shover: CombatCharacter,
  target: CombatCharacter,
): CombatState {
  const proneTarget = applyRuntimeStatusCondition(
    target,
    createProneStatus(shover, target),
    createProneCondition(shover),
  ).character;

  return {
    ...state,
    characters: state.characters.map(character => (
      character.id === target.id ? proneTarget : character
    )),
  };
}

// ============================================================================
// Complete Shove Resolution
// ============================================================================
// Validation failures stop before a save. A successful save leaves the board
// unchanged. A failed save applies exactly the player's chosen physical result
// and returns a readable reason for the combat log.
// ============================================================================

export function resolveShoveAttempt(
  request: ShoveResolutionRequest,
): ShoveResolution {
  const shover = request.state.characters.find(character => character.id === request.shoverId);
  const target = request.state.characters.find(character => character.id === request.targetId);

  if (!shover || !target) {
    return {
      state: request.state,
      attempted: false,
      shoveSucceeded: false,
      reason: 'actor_missing',
      message: 'Shove could not begin because the shover or target is missing.',
    };
  }

  if (getCharacterDistance(shover, target) > SHOVE_REACH_TILES) {
    return {
      state: request.state,
      attempted: false,
      shoveSucceeded: false,
      reason: 'out_of_reach',
      message: `Shove ineligible: ${target.name} is outside ${shover.name}'s 5-foot reach.`,
    };
  }

  if (!isTargetSizeEligibleForShove(shover, target)) {
    return {
      state: request.state,
      attempted: false,
      shoveSucceeded: false,
      reason: 'target_too_large',
      message: `Shove ineligible: ${target.name} is ${readCreatureSize(target)}, more than one size larger than the ${readCreatureSize(shover)} shover.`,
    };
  }

  const saveDc = calculateShoveSaveDc(shover);
  const save = rollSavingThrow(
    target,
    request.saveAbility,
    saveDc,
    undefined,
    { tags: ['shove', 'unarmed-strike'] },
    undefined,
    { rng: request.rng },
  );
  const saveSummary = `${request.saveAbility} save d20 ${save.roll}, total ${save.total} vs DC ${saveDc}`;

  if (save.success) {
    return {
      state: request.state,
      attempted: true,
      shoveSucceeded: false,
      reason: 'save_succeeded',
      saveDc,
      save,
      message: `Shove failed: ${target.name} succeeded on its ${saveSummary}; position and conditions are unchanged.`,
    };
  }

  if (request.choice === 'prone') {
    return {
      state: applyCanonicalProne(request.state, shover, target),
      attempted: true,
      shoveSucceeded: true,
      reason: 'resolved_prone',
      saveDc,
      save,
      message: `Shove succeeded: ${target.name} failed its ${saveSummary} and gained Prone.`,
    };
  }

  const pushedState = applyCanonicalPush(request.state, request.gameState, shover, target);
  const pushedTarget = pushedState.characters.find(character => character.id === target.id) ?? target;
  const moved = pushedTarget.position.x !== target.position.x || pushedTarget.position.y !== target.position.y;

  if (!moved) {
    return {
      state: pushedState,
      attempted: true,
      shoveSucceeded: false,
      reason: 'blocked_destination',
      saveDc,
      save,
      message: `Shove blocked: ${target.name} failed its ${saveSummary}, but the 5-foot destination is blocked; the target remains at ${target.position.x},${target.position.y}.`,
    };
  }

  return {
    state: pushedState,
    attempted: true,
    shoveSucceeded: true,
    reason: 'resolved_push',
    saveDc,
    save,
    message: `Shove succeeded: ${target.name} failed its ${saveSummary} and was pushed 5 feet to ${pushedTarget.position.x},${pushedTarget.position.y}.`,
  };
}
