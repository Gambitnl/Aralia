// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 04:47:31
 * Dependents: components/DesignPreview/steps/scenarioControls/healingTempHpScenarioControls.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Resolves targeted healing and temporary-hit-point actions against live combat state.
 *
 * The resolver deliberately validates the live turn owner and the canonical
 * spell-targeting contract before it asks the shared action economy to pay.
 * Successful actions then delegate HP truth to the same helpers used by combat
 * commands. This keeps scenario adapters, future commands, and tests from
 * inventing their own caps, downed cleanup, or temporary-HP stacking rules.
 *
 * Called by: Healing & Temporary HP scenario controls and focused mechanics tests.
 * Depends on: TargetResolver, actionEconomyUtils, and deathSaveUtils.
 */

import type {
  AbilityCost,
  BattleMapData,
  CombatCharacter,
  CombatState,
  TurnState,
} from '../../../types/combat';
import type { PlayerCharacter, Spell, SpellTargeting } from '../../../types';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';
import {
  applyHealingAndRestore,
  applyTemporaryHitPoints,
} from '../../../utils/combat/deathSaveUtils';
import { TargetResolver } from '../targeting/TargetResolver';

// ============================================================================
// Public Transaction Contract
// ============================================================================
// A successful receipt includes the paid caster and changed target in one
// roster. Every rejection returns the original roster by identity, making it
// straightforward for callers to prove that validation happened before cost.
// ============================================================================

export type HitPointActionMode = 'healing' | 'temporary_hit_points';

export interface HitPointActionDefinition {
  name: string;
  targeting: SpellTargeting;
  cost: AbilityCost;
}

export interface ResolveHitPointActionInput {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  turnState: TurnState;
  casterId: string;
  targetId: string;
  action: HitPointActionDefinition;
  mode: HitPointActionMode;
  /** Healing has one amount; temp-HP demonstrations may offer several pools in order. */
  amounts: number[];
}

export type HitPointActionRejectionReason =
  | 'missing_actor'
  | 'off_turn'
  | 'invalid_amount'
  | 'unaffordable_cost'
  | `invalid_target:${string}`;

export interface HitPointActionResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | HitPointActionRejectionReason;
  characters: CombatCharacter[];
  casterBefore?: CombatCharacter;
  casterAfter?: CombatCharacter;
  targetBefore?: CombatCharacter;
  targetAfter?: CombatCharacter;
  targetRejectionMessage?: string;
  appliedAmount: number;
  /** Result after each offered pool, allowing logs to explain keep/replace decisions. */
  temporaryHitPointSteps: number[];
}

/**
 * Converts a canonical spell record into the action definition consumed by the
 * transaction. The spell factory remains the source of casting-time and slot
 * cost; deterministic scenarios only provide the resolved healing roll.
 */
export function createHitPointSpellAction(
  spell: Spell,
  caster: CombatCharacter,
  castAtLevel: number,
  targetingOverride?: SpellTargeting,
): HitPointActionDefinition {
  const ability = createAbilityFromSpell(
    spell,
    caster as unknown as PlayerCharacter,
  );
  const targeting = targetingOverride ?? (
    spell.range.type.toLowerCase() === 'touch'
      ? {
          ...spell.targeting,
          // The ability factory is the canonical feet-to-grid adapter. TargetResolver
          // accepts feet, so translate its one adjacent tile back to five feet.
          range: ability.range * 5,
        }
      : spell.targeting
  );

  return {
    name: spell.name,
    targeting,
    cost: {
      ...ability.cost,
      spellSlotLevel: castAtLevel,
    },
  };
}

// ============================================================================
// Canonical Targeting Projection
// ============================================================================
// TargetResolver currently accepts the complete CombatState even though this
// transaction only needs roster, map, and turn state. The remaining fields are
// inert selections, never a second source of combat truth.
// ============================================================================

function createTargetingState(input: ResolveHitPointActionInput): CombatState {
  return {
    isActive: true,
    characters: input.characters,
    turnState: input.turnState,
    selectedCharacterId: input.casterId,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: [],
    mapData: input.mapData,
  } as CombatState;
}

function replaceResolvedActors(
  characters: CombatCharacter[],
  caster: CombatCharacter,
  target: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === caster.id) return caster;
    if (character.id === target.id) return target;
    return character;
  });
}

// ============================================================================
// Atomic Hit-Point Action Resolution
// ============================================================================
// Validation order is intentional: missing/off-turn/invalid targets and bad
// amounts cannot spend an Action, Bonus Action, or spell slot. Affordability is
// the final gate before payment and the HP transition is applied exactly once.
// ============================================================================

export function resolveHitPointAction(
  input: ResolveHitPointActionInput,
): HitPointActionResolution {
  const caster = input.characters.find(character => character.id === input.casterId);
  const target = input.characters.find(character => character.id === input.targetId);
  const reject = (
    reason: HitPointActionRejectionReason,
    targetRejectionMessage?: string,
  ): HitPointActionResolution => ({
    status: 'rejected',
    reason,
    characters: input.characters,
    casterBefore: caster,
    casterAfter: caster,
    targetBefore: target,
    targetAfter: target,
    targetRejectionMessage,
    appliedAmount: 0,
    temporaryHitPointSteps: [],
  });

  if (!caster || !target) {
    return reject('missing_actor');
  }

  if (input.turnState.currentCharacterId !== caster.id) {
    return reject('off_turn');
  }

  if (input.amounts.length === 0 || input.amounts.some(amount => !Number.isFinite(amount) || amount < 0)) {
    return reject('invalid_amount');
  }

  const targetRejection = TargetResolver.getTargetRejectionReason(
    input.action.targeting,
    caster,
    target,
    createTargetingState(input),
  );
  if (targetRejection) {
    return reject(
      `invalid_target:${targetRejection.code}`,
      targetRejection.message,
    );
  }

  if (!canAffordActionCost(caster, input.action.cost)) {
    return reject('unaffordable_cost');
  }

  const paidCaster = consumeActionCost(caster, input.action.cost);
  const temporaryHitPointSteps: number[] = [];
  const resolvedTarget = input.mode === 'healing'
    ? applyHealingAndRestore(target, input.amounts[0] ?? 0)
    : input.amounts.reduce((currentTarget, offer) => {
        const nextTarget = applyTemporaryHitPoints(currentTarget, offer);
        temporaryHitPointSteps.push(nextTarget.tempHP ?? 0);
        return nextTarget;
      }, target);
  const appliedAmount = input.mode === 'healing'
    ? resolvedTarget.currentHP - target.currentHP
    : (resolvedTarget.tempHP ?? 0) - (target.tempHP ?? 0);

  return {
    status: 'resolved',
    reason: 'resolved',
    characters: replaceResolvedActors(input.characters, paidCaster, resolvedTarget),
    casterBefore: caster,
    casterAfter: paidCaster,
    targetBefore: target,
    targetAfter: resolvedTarget,
    appliedAmount,
    temporaryHitPointSteps,
  };
}
