// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/08/2026, 21:31:27
 * Dependents: components/BattleMap/CombatCharacterInspector.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/grappleEscapeScenarioControls.ts, utils/combat/index.ts
 * Imports: 6 files
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
  CombatCharacter,
  StatusEffect,
} from '../../types/combat';
import { rollAbilityCheck, type CheckResult } from '../character/checkUtils';
import {
  calculateMovementTotal,
  canAffordActionCost,
  consumeActionCost,
} from './actionEconomyUtils';
import { getCharacterDistance } from './combatUtils';
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
