// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:17:27
 * Dependents: components/DesignPreview/steps/scenarioControls/multiattackRidersScenarioControls.ts
 * Imports: 9 files
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
  Ability,
  AbilityCost,
  ActiveRider,
  CombatCharacter,
  CombatState,
} from '../../types/combat';
import type { DamageType } from '../../types/spells';
import { isDamageEffect } from '../../types/spells';
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem';
import { getAbilityModifierValue } from '../character/statUtils';
import { calculateProficiencyBonus } from '../character/savingThrowUtils';
import { canAffordActionCost, consumeActionCost } from './actionEconomyUtils';
import { resolveAttack, rollDamage, rollD20 } from './combatUtils';
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
  | 'no_authored_attacks'
  | 'target_missing';

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

function calculateAppliedDamage(
  state: CombatState,
  attacker: CombatCharacter,
  target: CombatCharacter,
  rolledDamage: number,
  damageType: DamageType,
  isMagical: boolean,
): number {
  // Each damage type settles immunity, resistance, or vulnerability on its own.
  // The caller combines those post-defense amounts before one HP transition so
  // a Bite plus venom remains one hit rather than two downing events.
  return ResistanceCalculator.applyResistances(
    rolledDamage,
    damageType,
    target,
    attacker,
    isMagical,
    { spellZones: state.spellZones, characters: state.characters },
  );
}

// ============================================================================
// One-Action, Many-Roll Resolution
// ============================================================================
// The complete authored transaction is validated before its one Action is paid.
// This prevents a broken later target from leaving an earlier attack applied.
// Every valid strike then gets its own attack result, damage packet, and
// hit-gated rider match. A miss never asks the rider system for hit riders.
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

  // Every authored target must exist before the Action is consumed. Multiattack
  // is one transaction: a stale second target cannot turn it into a paid partial
  // sequence after the first attack has already changed hit points.
  const hasMissingTarget = request.strikes.some(strike => (
    !request.state.characters.some(character => character.id === strike.targetId)
  ));
  if (hasMissingTarget) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: 'target_missing',
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
      baseDamageApplied = calculateAppliedDamage(
        state,
        liveAttacker,
        liveTarget,
        baseDamageRolled,
        strike.damageType,
        strike.isMagical ?? false,
      );

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
        // The `.filter(isDamageEffect)` upstream does not narrow `rider.effect`
        // through the loop, so this redundant-at-runtime guard gives the type
        // checker the same damage-effect fact the runtime already enforces.
        if (!isDamageEffect(rider.effect)) continue;
        const rolledRiderDamage = rollDamage(
          rider.effect.damage.dice,
          attack.isCritical,
          1,
          strike.damageRng,
        );
        const appliedRiderDamage = calculateAppliedDamage(
          state,
          liveAttacker,
          liveTarget,
          rolledRiderDamage,
          rider.effect.damage.type,
          true,
        );
        riderDamageRolled += rolledRiderDamage;
        riderDamageApplied += appliedRiderDamage;
      }

      // Base and rider defenses are now known. Apply their combined result as
      // one attack event so crossing 0 HP initializes death saves once and does
      // not immediately count the rider as damage taken while already downed.
      liveTarget = applyDamageAndCheckDowned(
        liveTarget,
        baseDamageApplied + riderDamageApplied,
        attack.isCritical,
      );
      state = replaceCharacter(state, liveTarget);

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

// ============================================================================
// Authored Multiattack Expansion
// ============================================================================
// A monster Multiattack button names its sub-attacks (`subAttackIds`) and its
// hit count (`multiattackCount`) while its `effects[]` stay pre-multiplied for
// AI scoring. This expansion turns those authored references into one ordered
// strike per hit, reading each sub-ability's own attack bonus, damage formula,
// damage type, and attack/weapon classification. A legal authored replacement
// (e.g. the Adult Red Dragon swapping one Rend for Scorching Ray) is honored per
// strike; an illegal or missing sub-attack id rejects the whole expansion.
// ============================================================================

export type MultiattackExpansionFailure =
  | 'no_authored_attacks'
  | 'target_count_mismatch'
  | 'missing_sub_attack'
  | 'no_damage_effect';

export interface MultiattackExpansionResult {
  strikes: MultiattackStrikeRequest[];
  failure?: MultiattackExpansionFailure;
}

export interface MultiattackExpansionInput {
  attacker: CombatCharacter;
  ability: Ability;
  targetIds: string[];
  replacementByIndex?: Record<number, string>;
  rng?: () => number;
  damageRng?: () => number;
}

function deriveAttackBonus(attacker: CombatCharacter, subAbility: Ability): number {
  const isRanged = (subAbility.range ?? 5) > 2;
  const abilityScore = isRanged ? attacker.stats.dexterity : attacker.stats.strength;
  const modifier = getAbilityModifierValue(abilityScore);
  const proficiency = subAbility.isProficient === false
    ? 0
    : calculateProficiencyBonus(attacker.level ?? 1);
  return modifier + proficiency;
}

export function expandMultiattackStrikes(
  input: MultiattackExpansionInput,
): MultiattackExpansionResult {
  const { attacker, ability, targetIds, replacementByIndex, rng, damageRng } = input;
  const subAttackIds = ability.subAttackIds ?? [];

  if (subAttackIds.length === 0) {
    return { strikes: [], failure: 'no_authored_attacks' };
  }

  const count = ability.multiattackCount ?? subAttackIds.length;
  if (targetIds.length !== count) {
    return { strikes: [], failure: 'target_count_mismatch' };
  }

  const authoredIds = new Set(subAttackIds);
  const primaryId = subAttackIds[0];
  const strikes: MultiattackStrikeRequest[] = [];

  for (let index = 0; index < count; index += 1) {
    const replacementId = replacementByIndex?.[index];
    if (replacementId !== undefined && !authoredIds.has(replacementId)) {
      return { strikes: [], failure: 'missing_sub_attack' };
    }

    const subAbilityId = replacementId ?? primaryId;
    const subAbility = attacker.abilities.find(candidate => candidate.id === subAbilityId);
    if (!subAbility) {
      return { strikes: [], failure: 'missing_sub_attack' };
    }

    const damageEffect = subAbility.effects.find(effect => effect.type === 'damage');
    const damageFormula = damageEffect?.dice
      ?? (typeof damageEffect?.value === 'number' ? String(damageEffect.value) : undefined);
    if (!damageFormula) {
      return { strikes: [], failure: 'no_damage_effect' };
    }

    const attackType: MultiattackStrikeRequest['attackType'] = subAbility.attackType
      ?? (subAbility.type === 'spell' ? 'spell' : 'weapon');
    const weaponType: MultiattackStrikeRequest['weaponType'] = attackType === 'unarmed'
      ? 'unarmed'
      : ((subAbility.range ?? 5) <= 2 ? 'melee' : 'ranged');

    strikes.push({
      id: `${ability.id}-${index}-${subAbility.id}`,
      label: subAbility.name,
      targetId: targetIds[index],
      d20Roll: rollD20({ rng }),
      attackBonus: subAbility.attackBonus ?? deriveAttackBonus(attacker, subAbility),
      damageFormula,
      damageType: damageEffect?.damageType ?? 'physical',
      attackType,
      weaponType,
      damageRng,
      isMagical: subAbility.isMagical ?? subAbility.type === 'spell',
    });
  }

  return { strikes };
}

// ============================================================================
// Production Multiattack Dispatch
// ============================================================================
// This is the normal-ability-execution bridge the isolated sandbox transaction
// could not provide: expand a real monster Multiattack button, validate the
// complete authored sequence, then resolve every ordered attack through the same
// shared sequence resolver that spends one Action and keeps per-strike target,
// hit/miss, and rider ownership.
// ============================================================================

export interface MultiattackDispatchRequest {
  state: CombatState;
  attackerId: string;
  abilityId: string;
  targetIds: string[];
  replacementByIndex?: Record<number, string>;
  rng?: () => number;
  damageRng?: () => number;
}

export function dispatchMultiattack(
  request: MultiattackDispatchRequest,
): MultiattackSequenceResolution {
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

  const ability = attacker.abilities.find(candidate => candidate.id === request.abilityId);
  if (!ability) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: 'no_authored_attacks',
      strikes: [],
    };
  }

  const expansion = expandMultiattackStrikes({
    attacker,
    ability,
    targetIds: request.targetIds,
    replacementByIndex: request.replacementByIndex,
    rng: request.rng,
    damageRng: request.damageRng,
  });

  if (expansion.failure || expansion.strikes.length === 0) {
    return {
      state: request.state,
      attempted: false,
      actionSpent: false,
      failure: expansion.failure === 'target_count_mismatch' ? 'target_missing' : 'no_authored_attacks',
      strikes: [],
    };
  }

  return resolveMultiattackSequence({
    state: request.state,
    attackerId: request.attackerId,
    strikes: expansion.strikes,
    cost: ability.cost,
  });
}
