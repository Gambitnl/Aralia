// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/08/2026, 22:18:21
 * Dependents: components/DesignPreview/steps/scenarioControls/multiattackRidersScenarioControls.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves an authored Multiattack as one action containing separate attacks.
 *
 * Monster data already names each sub-attack, but the older execution path combines
 * their damage into one synthetic hit. This narrow resolver keeps the attacks separate
 * while delegating every rule decision to existing combat helpers: action spending,
 * attack rolls, damage dice, resistance or immunity, hit points, and attack riders.
 * It returns structured outcomes so a caller can render honest cues and combat logs.
 *
 * Called by: Tactical Sandbox Multiattack & Attack Riders controls.
 * Depends on: actionEconomyUtils, combatUtils, deathSaveUtils,
 * ResistanceCalculator, and AttackRiderSystem.
 */

import type {
  AbilityCost,
  ActiveRider,
  CombatCharacter,
  CombatState,
} from '../../types/combat';
import type { DamageType } from '../../types/spells';
import { isDamageEffect } from '../../types/spells';
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem';
import { canAffordActionCost, consumeActionCost } from './actionEconomyUtils';
import { resolveAttack, rollDamage } from './combatUtils';
import { applyDamageAndCheckDowned } from './deathSaveUtils';
import { ResistanceCalculator } from './resistanceUtils';

// ============================================================================
// Authored Sequence Contract
// ============================================================================
// The caller supplies one row per authored attack. Explicit d20 faces and an
// optional dice stream make teaching fixtures repeatable without replacing any
// of the canonical math that interprets those rolls.
// ============================================================================

export interface MultiattackStrikeRequest {
  id: string;
  label: string;
  targetId: string;
  d20Roll: number;
  attackBonus: number;
  damageFormula: string;
  damageType: DamageType;
  attackType: 'weapon' | 'spell' | 'unarmed';
  weaponType?: 'melee' | 'ranged' | 'unarmed';
  damageRng?: () => number;
  isMagical?: boolean;
}

export interface MultiattackSequenceRequest {
  state: CombatState;
  attackerId: string;
  strikes: MultiattackStrikeRequest[];
  cost?: AbilityCost;
}

export type MultiattackSequenceFailure =
  | 'attacker_missing'
  | 'action_unavailable'
  | 'no_authored_attacks';

export interface MultiattackStrikeResolution {
  id: string;
  label: string;
  targetId: string;
  targetName: string;
  d20Roll: number;
  attackBonus: number;
  attackTotal: number;
  targetArmorClass: number;
  isHit: boolean;
  isCritical: boolean;
  baseDamageRolled: number;
  baseDamageApplied: number;
  riderDamageRolled: number;
  riderDamageApplied: number;
  triggeredRiderNames: string[];
  targetHpBefore: number;
  targetHpAfter: number;
}

export interface MultiattackSequenceResolution {
  state: CombatState;
  attempted: boolean;
  actionSpent: boolean;
  failure?: MultiattackSequenceFailure;
  strikes: MultiattackStrikeResolution[];
}

// ============================================================================
// Immutable Character Replacement
// ============================================================================
// Each damage or resource transition produces a fresh character object. This
// helper returns a fresh combat state so React snapshots and command-style
// simulations never mutate the board that existed before the Multiattack.
// ============================================================================

function replaceCharacter(
  state: CombatState,
  replacement: CombatCharacter,
): CombatState {
  return {
    ...state,
    characters: state.characters.map(character => (
      character.id === replacement.id ? replacement : character
    )),
  };
}

function applyDamagePacket(
  state: CombatState,
  attacker: CombatCharacter,
  target: CombatCharacter,
  rolledDamage: number,
  damageType: DamageType,
  isMagical: boolean,
  isCritical: boolean,
): { state: CombatState; target: CombatCharacter; appliedDamage: number } {
  // Immunity, resistance, and vulnerability are settled before the shared HP
  // transition, matching the production DamageCommand order.
  const appliedDamage = ResistanceCalculator.applyResistances(
    rolledDamage,
    damageType,
    target,
    attacker,
    isMagical,
    { spellZones: state.spellZones, characters: state.characters },
  );
  const damagedTarget = applyDamageAndCheckDowned(
    target,
    appliedDamage,
    isCritical,
  );

  return {
    state: replaceCharacter(state, damagedTarget),
    target: damagedTarget,
    appliedDamage,
  };
}

// ============================================================================
// One-Action, Many-Roll Resolution
// ============================================================================
// The action is validated and consumed once before any authored strike resolves.
// Every strike then gets its own target lookup, attack result, damage packet,
// and hit-gated rider match. A miss never asks the rider system for hit riders.
// ============================================================================

export function resolveMultiattackSequence(
  request: MultiattackSequenceRequest,
): MultiattackSequenceResolution {
  const cost = request.cost ?? { type: 'action' };
  const attacker = request.state.characters.find(
    character => character.id === request.attackerId,
  );

  if (!attacker) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: 'attacker_missing',
      strikes: [],
    };
  }

  if (request.strikes.length === 0) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: 'no_authored_attacks',
      strikes: [],
    };
  }

  if (!canAffordActionCost(attacker, cost)) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: 'action_unavailable',
      strikes: [],
    };
  }

  // Pay once for the Multiattack button. Sub-attacks deliberately have no
  // second action cost because they are authored parts of that one action.
  let state = replaceCharacter(
    request.state,
    consumeActionCost(attacker, cost),
  );
  const riderSystem = new AttackRiderSystem();
  const strikes: MultiattackStrikeResolution[] = [];

  for (const strike of request.strikes) {
    const liveAttacker = state.characters.find(
      character => character.id === request.attackerId,
    );
    const target = state.characters.find(
      character => character.id === strike.targetId,
    );

    // A missing target is an authored-data failure, not permission to redirect
    // an attack. Record a harmless miss-shaped row and continue the sequence.
    if (!liveAttacker || !target) {
      strikes.push({
        id: strike.id,
        label: strike.label,
        targetId: strike.targetId,
        targetName: 'Missing target',
        d20Roll: strike.d20Roll,
        attackBonus: strike.attackBonus,
        attackTotal: strike.d20Roll + strike.attackBonus,
        targetArmorClass: 0,
        isHit: false,
        isCritical: false,
        baseDamageRolled: 0,
        baseDamageApplied: 0,
        riderDamageRolled: 0,
        riderDamageApplied: 0,
        triggeredRiderNames: [],
        targetHpBefore: 0,
        targetHpAfter: 0,
      });
      continue;
    }

    const targetArmorClass = target.armorClass ?? target.baseAC ?? 10;
    const attack = resolveAttack(
      strike.d20Roll,
      strike.attackBonus,
      targetArmorClass,
      liveAttacker.critThreshold ?? 20,
    );
    let liveTarget = target;
    let baseDamageRolled = 0;
    let baseDamageApplied = 0;
    let riderDamageRolled = 0;
    let riderDamageApplied = 0;
    let matchingDamageRiders: ActiveRider[] = [];

    if (attack.isHit) {
      // Damage dice are rolled only after this individual attack hits. Critical
      // doubling remains owned by the shared dice helper.
      baseDamageRolled = rollDamage(
        strike.damageFormula,
        attack.isCritical,
        1,
        strike.damageRng,
      );
      const basePacket = applyDamagePacket(
        state,
        liveAttacker,
        liveTarget,
        baseDamageRolled,
        strike.damageType,
        strike.isMagical ?? false,
        attack.isCritical,
      );
      state = basePacket.state;
      liveTarget = basePacket.target;
      baseDamageApplied = basePacket.appliedDamage;

      // AttackRiderSystem remains the authority for hit gating, target binding,
      // attack filters, and first-hit/per-turn consumption. This first narrow
      // sequence primitive resolves damage riders; other rider payload types
      // remain on their existing command paths until a production caller needs
      // them in Multiattack.
      matchingDamageRiders = riderSystem.getMatchingRiders(state, {
        attackerId: liveAttacker.id,
        targetId: liveTarget.id,
        attackType: strike.attackType,
        weaponType: strike.weaponType,
        isHit: true,
      }).filter(rider => isDamageEffect(rider.effect));

      for (const rider of matchingDamageRiders) {
        const currentTarget = state.characters.find(
          character => character.id === liveTarget.id,
        ) ?? liveTarget;
        const rolledRiderDamage = rollDamage(
          rider.effect.damage.dice,
          attack.isCritical,
          1,
          strike.damageRng,
        );
        const riderPacket = applyDamagePacket(
          state,
          liveAttacker,
          currentTarget,
          rolledRiderDamage,
          rider.effect.damage.type,
          true,
          attack.isCritical,
        );
        state = riderPacket.state;
        liveTarget = riderPacket.target;
        riderDamageRolled += rolledRiderDamage;
        riderDamageApplied += riderPacket.appliedDamage;
      }

      if (matchingDamageRiders.length > 0) {
        state = riderSystem.consumeRiders(
          state,
          liveAttacker.id,
          matchingDamageRiders,
        );
      }
    }

    strikes.push({
      id: strike.id,
      label: strike.label,
      targetId: strike.targetId,
      targetName: target.name,
      d20Roll: strike.d20Roll,
      attackBonus: strike.attackBonus,
      attackTotal: attack.total,
      targetArmorClass,
      isHit: attack.isHit,
      isCritical: attack.isCritical,
      baseDamageRolled,
      baseDamageApplied,
      riderDamageRolled,
      riderDamageApplied,
      triggeredRiderNames: matchingDamageRiders.map(rider => rider.sourceName),
      targetHpBefore: target.currentHP,
      targetHpAfter: liveTarget.currentHP,
    });
  }

  return {
    state,
    attempted: true,
    actionSpent: true,
    strikes,
  };
}
