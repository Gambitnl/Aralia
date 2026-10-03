// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 13/08/2026, 18:02:52
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/HealingCommand.ts, commands/effects/StatusConditionCommand.ts, components/DesignPreview/steps/raceDomain/leaves/bugbearRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/centaurRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGenasiRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/companionReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/counterspellNestedReactionsScenarioControls.ts, components/DesignPreview/steps/scenarioControls/deathSavesScenarioControls.ts, components/DesignPreview/steps/scenarioControls/healingTempHpScenarioControls.ts, components/DesignPreview/steps/scenarioControls/reachCreatureSizeScenarioControls.ts, components/DesignPreview/steps/scenarioControls/resistanceScenarioControls.ts, components/DesignPreview/steps/scenarioControls/savingThrowsHalfDamageScenarioControls.ts, components/DesignPreview/steps/spells/fireBoltScenario.tsx, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useTurnManager.ts, systems/combat/fallingGroundImpactResolution.ts, systems/combat/reactions/companionProtectionReaction.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, systems/spells/mechanics/healingTemporaryHitPointResolution.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, utils/combat/actionEconomyUtils.ts, utils/combat/grappleUtils.ts, utils/combat/multiattackUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file utils/combat/deathSaveUtils.ts
 * Centralized utility functions for managing Downing states, Death Saving Throws,
 * unconsciousness conditions, and HP transition mutations for players at 0 HP.
 *
 * This system is built to strictly implement standard D&D 5e Rules:
 * - When a player drops to 0 HP, they gain the Unconscious condition and death save tracking initializes.
 * - Taking damage while at 0 HP inflicts death save failures (1 failure standard, 2 if critical).
 * - A turn-start death save records success or failure, stabilizes at three successes,
 *   marks death at three failures, and restores 1 HP on a natural 20.
 * - Receiving healing while downed immediately restores consciousness, clears saves, and removes Unconscious.
 * - Unconscious or incapacitated creatures are restricted from executing actions, reactions, or moving.
 *
 * DESIGN DECISIONS:
 * We decouple these helper calculations from the React hook state updates so that tests, commands, 
 * and turn coordinators can execute pure HP transitions predictably and isolate state leaks.
 */

import { CombatCharacter } from '../../types/combat';

/**
 * Checks if a combat character possesses any incapacitating status conditions.
 * Standard D&D 5e rules state that incapacitated creatures cannot take actions or reactions.
 *
 * @param character The character to evaluate.
 * @returns True if the character is incapacitated, false otherwise.
 */
export function isIncapacitated(character: CombatCharacter | undefined): boolean {
  if (!character) return false;
  const incapacitatedConditions = ['unconscious', 'incapacitated', 'stunned', 'paralyzed', 'petrified'];
  
  return (
    character.statusEffects?.some(se => incapacitatedConditions.includes(se.name.toLowerCase())) ||
    character.conditions?.some(c => incapacitatedConditions.includes(c.name.toLowerCase())) ||
    false
  );
}

/**
 * Checks if a character's movement is completely blocked by status conditions.
 * Unconscious, paralyzed, petrified, and restrained characters have their speed reduced to 0.
 *
 * @param character The character to evaluate.
 * @returns True if the character cannot move, false otherwise.
 */
export function isMovementBlocked(character: CombatCharacter | undefined): boolean {
  if (!character) return false;
  const blockingConditions = ['unconscious', 'paralyzed', 'petrified', 'restrained'];
  
  return (
    character.statusEffects?.some(se => blockingConditions.includes(se.name.toLowerCase())) ||
    character.conditions?.some(c => blockingConditions.includes(c.name.toLowerCase())) ||
    false
  );
}

/**
 * Safely adds the "Unconscious" condition to a character's statusEffects and conditions arrays.
 * Preserves existing status effects and prevents duplicate entries.
 *
 * @param character The character falling unconscious.
 * @returns An updated CombatCharacter with the Unconscious status applied.
 */
export function addUnconsciousCondition(character: CombatCharacter): CombatCharacter {
  const hasUnconsciousStatus = character.statusEffects?.some(se => se.name.toLowerCase() === 'unconscious');
  const hasUnconsciousCondition = character.conditions?.some(c => c.name.toLowerCase() === 'unconscious');

  let statusEffects = character.statusEffects ? [...character.statusEffects] : [];
  let conditions = character.conditions ? [...character.conditions] : [];

  if (!hasUnconsciousStatus) {
    statusEffects.push({
      id: 'unconscious_' + Math.random().toString(36).substring(2, 9),
      name: 'Unconscious',
      type: 'debuff',
      description: 'Unconscious due to being downed at 0 HP.',
      duration: 999, // Indefinite until healed or stabilized/revived
      icon: 'unconscious'
    });
  }

  if (!hasUnconsciousCondition) {
    conditions.push({
      name: 'Unconscious',
      duration: { type: 'permanent' },
      appliedTurn: 1
    });
  }

  return {
    ...character,
    statusEffects,
    conditions
  };
}

/**
 * Safely removes the "Unconscious" condition from a character's statusEffects and conditions arrays.
 * Used when a downed character is healed or revived.
 *
 * @param character The character regaining consciousness.
 * @returns An updated CombatCharacter with the Unconscious status removed.
 */
export function removeUnconsciousCondition(character: CombatCharacter): CombatCharacter {
  const statusEffects = (character.statusEffects || []).filter(se => se.name.toLowerCase() !== 'unconscious');
  const conditions = (character.conditions || []).filter(c => c.name.toLowerCase() !== 'unconscious');
  
  return {
    ...character,
    statusEffects,
    conditions
  };
}

// ============================================================================
// Turn-Start Death Saving Throw
// ============================================================================
// The combat turn manager and deterministic teaching scenarios share this one
// transaction. The caller owns when the roll occurs; this helper owns every
// resulting HP, pip, stabilization, death, and Unconscious transition.
// ============================================================================

export type DeathSavingThrowOutcome =
  | 'not_eligible'
  | 'success'
  | 'failure'
  | 'stable'
  | 'dead'
  | 'revived';

export interface DeathSavingThrowResult {
  character: CombatCharacter;
  roll: number | null;
  outcome: DeathSavingThrowOutcome;
}

/**
 * Resolves one death saving throw for a downed player character.
 *
 * Stable, dead, recovered, and non-player combatants are explicit no-ops. A
 * natural 20 restores 1 HP and clears the downed condition; a natural 1 adds
 * two failures; ordinary 10-19 rolls add one success; and other rolls add one
 * failure. Three successes stabilize and three failures represent death.
 */
export function resolveDeathSavingThrow(
  character: CombatCharacter,
  roll: number,
): DeathSavingThrowResult {
  const deathSaves = character.deathSaves;

  // A death save only belongs to a living player at 0 HP whose tracker is
  // still active. Replaying Stable or Dead therefore preserves exact state.
  if (
    character.team !== 'player'
    || character.currentHP !== 0
    || !deathSaves
    || deathSaves.isStable
    || deathSaves.failures >= 3
  ) {
    return { character, roll: null, outcome: 'not_eligible' };
  }

  // Dice sources must provide a real d20 face. Rejecting invalid input keeps
  // production bugs visible instead of silently converting them into a rule.
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
    throw new RangeError(`Death saving throw must be an integer from 1 to 20; received ${roll}.`);
  }

  // A natural 20 is immediate recovery rather than a recorded success. The
  // ordinary healing helper is not used because this rule sets exactly 1 HP.
  if (roll === 20) {
    return {
      character: removeUnconsciousCondition({
        ...character,
        currentHP: 1,
        deathSaves: undefined,
      }),
      roll,
      outcome: 'revived',
    };
  }

  const successes = Math.min(3, deathSaves.successes + (roll >= 10 ? 1 : 0));
  const failures = Math.min(3, deathSaves.failures + (roll === 1 ? 2 : roll < 10 ? 1 : 0));
  const isStable = successes >= 3;
  const outcome: DeathSavingThrowOutcome = failures >= 3
    ? 'dead'
    : isStable
      ? 'stable'
      : roll >= 10
        ? 'success'
        : 'failure';

  // Death remains represented by three failed pips, matching initiative and
  // group-turn consumers. Stabilization changes only the tracker and leaves
  // the character Unconscious at 0 HP until healing or a natural 20 occurs.
  return {
    character: {
      ...character,
      deathSaves: { successes, failures, isStable },
    },
    roll,
    outcome,
  };
}

// ============================================================================
// Temporary Hit Point Replacement
// ============================================================================
// Temporary hit points are a separate buffer rather than healing. Every spell,
// feature, and sandbox proof uses this one replacement rule so a smaller offer
// can never stack with or silently overwrite a larger pool.
// ============================================================================

/**
 * Offers a character a new temporary-hit-point pool.
 *
 * The higher pool wins. When a new pool replaces the old one, its optional
 * source replaces the old source as well; a source-less grant clears stale
 * spell ownership so reactive effects cannot claim another feature's buffer.
 *
 * @param character The character receiving the temporary-hit-point offer.
 * @param amount The size of the newly offered pool.
 * @param source The spell or feature that owns the new pool, when relevant.
 * @returns A copied character carrying the canonical non-stacking result.
 */
export function applyTemporaryHitPoints(
  character: CombatCharacter,
  amount: number,
  source?: CombatCharacter['temporaryHitPointSource'],
): CombatCharacter {
  const currentTemporaryHitPoints = character.tempHP ?? 0;
  const offeredTemporaryHitPoints = Math.max(0, amount);

  // Equal or smaller offers leave both the pool and its ownership untouched.
  // This preserves effects such as Armor of Agathys when another feature offers
  // a weaker buffer that the character optimally declines.
  if (offeredTemporaryHitPoints <= currentTemporaryHitPoints) {
    return { ...character };
  }

  // Replacing the pool also replaces its provenance. A generic grant has no
  // spell owner, so omit the old source rather than carrying stale retaliation.
  const updatedCharacter: CombatCharacter = {
    ...character,
    tempHP: offeredTemporaryHitPoints,
  };

  if (source) {
    updatedCharacter.temporaryHitPointSource = { ...source };
  } else {
    delete updatedCharacter.temporaryHitPointSource;
  }

  return updatedCharacter;
}

/**
 * Deducts HP (applying Temporary HP first) and applies Downing / Death Save Failure transitions.
 * - Players reaching 0 HP are downed, starting death save tracking and falling unconscious.
 * - Players already at 0 HP suffer 1 death save failure (2 if a critical hit).
 *
 * @param character The character taking damage.
 * @param amount The raw amount of damage to deduct from HP.
 * @param isCritical Whether the source damage is a critical hit (inflicts 2 failures while downed).
 * @returns The mutated CombatCharacter state.
 */
export function applyDamageAndCheckDowned(character: CombatCharacter, amount: number, isCritical: boolean = false): CombatCharacter {
  let updatedCharacter = { ...character };
  const originalHP = updatedCharacter.currentHP;

  // 1. Resolve damage against Temporary HP first
  let damageToApply = amount;
  if (updatedCharacter.tempHP && updatedCharacter.tempHP > 0) {
    if (updatedCharacter.tempHP >= damageToApply) {
      updatedCharacter.tempHP -= damageToApply;
      if (updatedCharacter.tempHP === 0) {
        delete updatedCharacter.temporaryHitPointSource;
      }
      damageToApply = 0;
    } else {
      damageToApply -= updatedCharacter.tempHP;
      updatedCharacter.tempHP = 0;
      delete updatedCharacter.temporaryHitPointSource;
    }
  }

  // 2. Apply remaining damage to standard HP pool
  updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - damageToApply);
  updatedCharacter.damagedThisTurn = true;

  // 3. Downed & Death Saving Throw Transitions
  if (updatedCharacter.currentHP === 0 && originalHP > 0) {
    if (updatedCharacter.team === 'player') {
      // Transition player character to downed / dying state
      updatedCharacter.deathSaves = {
        successes: 0,
        failures: 0,
        isStable: false
      };
      updatedCharacter = addUnconsciousCondition(updatedCharacter);
    }
  } else if (updatedCharacter.currentHP === 0 && originalHP === 0 && updatedCharacter.team === 'player' && amount > 0) {
    // A player character already at 0 HP takes damage. This counts as an automatic death save failure.
    // (If the damage is critical, it counts as two failures).
    const failuresToAdd = isCritical ? 2 : 1;
    const currentFailures = updatedCharacter.deathSaves?.failures || 0;
    const newFailures = Math.min(3, currentFailures + failuresToAdd);
    
    updatedCharacter.deathSaves = {
      successes: updatedCharacter.deathSaves?.successes || 0,
      failures: newFailures,
      isStable: false // Taking damage breaks stabilization
    };
  }

  return updatedCharacter;
}

/**
 * Standard healing helper that restores HP and manages downed recovery.
 * - Receives standard healing (HP > 0) restores consciousness, clears saves, and clears Unconscious status.
 *
 * @param character The character receiving healing.
 * @param amount The HP to restore.
 * @returns The mutated CombatCharacter state.
 */
export function applyHealingAndRestore(character: CombatCharacter, amount: number): CombatCharacter {
  let updatedCharacter = { ...character };
  const originalHP = updatedCharacter.currentHP;

  // Chill Touch-style lockouts prevent Hit Point regain while the rider is
  // active. This check lives in the shared HP helper so every healing command,
  // area trigger, or future item path gets the same rules outcome.
  if (hasHitPointRegainLockout(updatedCharacter)) {
    return updatedCharacter;
  }

  // Apply standard healing capped at max HP
  updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + amount);

  // Revive transition: if healed from 0 HP to >0 HP, remove downed status and unconsciousness
  if (originalHP === 0 && updatedCharacter.currentHP > 0 && updatedCharacter.team === 'player') {
    updatedCharacter.deathSaves = undefined;
    updatedCharacter = removeUnconsciousCondition(updatedCharacter);
  }

  return updatedCharacter;
}

function hasHitPointRegainLockout(character: CombatCharacter): boolean {
  const statusLockout = (character.statusEffects || []).some(effect =>
    effect.hitPointState?.mode === 'healing_lockout' &&
    effect.hitPointState.preventsHitPointRegain === true &&
    effect.duration > 0
  );

  if (statusLockout) {
    return true;
  }

  return (character.conditions || []).some(condition =>
    condition.hitPointState?.mode === 'healing_lockout' &&
    condition.hitPointState.preventsHitPointRegain === true
  );
}
