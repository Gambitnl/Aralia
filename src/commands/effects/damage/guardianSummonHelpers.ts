/**
 * Guardian and emanation lifecycle mutators for the damage command family.
 *
 * WHAT CHANGED: these four exported functions plus their private distance
 * helper moved here verbatim from src/commands/effects/DamageCommand.ts
 * (previously lines 1763-2034).
 *
 * WHY IT CHANGED: they are module-level free functions that never read or
 * write DamageCommand instance state. They take an explicit CombatState, a
 * guardian id, and plain options, and return a new CombatState, so they are
 * separable from the command class without any value-object refactor. The
 * rest of DamageCommand stays whole: every remaining helper reads
 * `this.effect` / `this.context` or calls the BaseEffectCommand log and
 * character-update helpers, so extracting those would need a descriptor
 * object first (see the task result for agora-907c.13).
 *
 * WHAT WAS PRESERVED: the function bodies are byte-identical to the versions
 * that lived in DamageCommand.ts, and DamageCommand.ts re-exports all four so
 * every existing import path keeps working.
 *
 * @file src/commands/effects/damage/guardianSummonHelpers.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:55:02
 * Dependents: commands/effects/DamageCommand.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatState, ActiveSpellGuardian, Position } from '../../../types/combat';
import { generateId } from '../../../utils/combat';

export function recordGuardianOfFaithDamage(
  state: CombatState,
  guardianId: string,
  damageDealt: number,
  options: {
    targetId?: string;
  } = {}
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian) {
    return state;
  }

  const totalDamageDealt = guardian.damageCap.dealtDamage + damageDealt;
  const shouldVanish = guardian.damageCap.vanishWhenReached &&
    totalDamageDealt >= guardian.damageCap.maxTotalDamage;
  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    active: !shouldVanish,
    damageCap: {
      ...guardian.damageCap,
      dealtDamage: totalDamageDealt
    }
  };

  if (shouldVanish) {
    return {
      ...state,
      activeSpellGuardians: (state.activeSpellGuardians || []).filter(record => record.id !== guardianId),
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${guardian.spellName || 'Guardian of Faith'} vanishes after dealing ${totalDamageDealt} damage.`,
          characterId: guardian.casterId,
          targetIds: options.targetId ? [options.targetId] : undefined,
          data: {
            spellGuardianSurface: 'guardian_of_faith',
            guardianId,
            targetId: options.targetId,
            damageDealt,
            totalDamageDealt,
            vanishReason: 'damage_cap_reached'
          }
        }
      ]
    };
  }

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'damage',
        message: `${guardian.spellName || 'Guardian of Faith'} has dealt ${totalDamageDealt} total damage.`,
        characterId: guardian.casterId,
        targetIds: options.targetId ? [options.targetId] : undefined,
        data: {
          spellGuardianSurface: 'guardian_of_faith',
          guardianId,
          targetId: options.targetId,
          damageDealt,
          totalDamageDealt
        }
      }
    ]
  };
}

export function moveFaithfulHoundGuardian(
  state: CombatState,
  guardianId: string,
  nextPosition: Position,
  options: {
    casterPosition: Position;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'faithful_hound') {
    return state;
  }

  const maxDistanceFeet = guardian.separationEnding?.maxDistanceFeet ?? 300;
  const distanceFromCasterFeet = getGridDistanceFeet(options.casterPosition, nextPosition);
  if (distanceFromCasterFeet > maxDistanceFeet) {
    return {
      ...state,
      activeSpellGuardians: (state.activeSpellGuardians || []).filter(record => record.id !== guardianId),
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${guardian.spellName || "Mordenkainen's Faithful Hound"} ends because it is too far from its caster.`,
          characterId: guardian.casterId,
          data: {
            spellGuardianSurface: 'faithful_hound',
            guardianId,
            endingReason: 'beyond_max_distance',
            distanceFromCasterFeet,
            maxDistanceFeet
          }
        }
      ]
    };
  }

  const movedGuardian: ActiveSpellGuardian = {
    ...guardian,
    position: nextPosition
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? movedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'movement',
        message: `${guardian.spellName || "Mordenkainen's Faithful Hound"} moves up to ${guardian.movement?.maxDistanceFeet ?? 30} feet.`,
        characterId: guardian.casterId,
        data: {
          spellGuardianSurface: 'faithful_hound',
          guardianId,
          moveReason: 'magic_action',
          position: nextPosition
        }
      }
    ]
  };
}

export function recordConjureElementalRestraint(
  state: CombatState,
  guardianId: string,
  options: {
    targetId: string;
    failedSave: boolean;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'conjure_elemental' || !options.failedSave) {
    return state;
  }

  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    elementalSpirit: {
      ...guardian.elementalSpirit,
      restrainedTargetId: options.targetId
    }
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${guardian.spellName || 'Conjure Elemental'} restrains ${options.targetId}.`,
        characterId: guardian.casterId,
        targetIds: [options.targetId],
        data: {
          spellGuardianSurface: 'conjure_elemental',
          guardianId,
          restrainedTargetId: options.targetId,
          damageDice: guardian.elementalSpirit?.initialDamageDice ?? guardian.triggerPolicy.damageDice,
          damageType: guardian.elementalSpirit?.damageType ?? guardian.triggerPolicy.damageType
        }
      }
    ]
  };
}

export function resolveConjureElementalRepeatSave(
  state: CombatState,
  guardianId: string,
  options: {
    targetId: string;
    failedSave: boolean;
  }
): CombatState {
  const guardian = state.activeSpellGuardians?.find(record => record.id === guardianId);

  if (!guardian || guardian.kind !== 'conjure_elemental') {
    return state;
  }

  const repeatDamageDice = guardian.elementalSpirit?.repeatDamageDice ?? '4d8';
  if (options.failedSave) {
    return {
      ...state,
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'damage',
          message: `${guardian.spellName || 'Conjure Elemental'} deals repeat damage to ${options.targetId}.`,
          characterId: guardian.casterId,
          targetIds: [options.targetId],
          data: {
            spellGuardianSurface: 'conjure_elemental',
            guardianId,
            repeatSaveOutcome: 'failed',
            damageDice: repeatDamageDice,
            damageType: guardian.elementalSpirit?.damageType ?? guardian.triggerPolicy.damageType
          }
        }
      ]
    };
  }

  const updatedGuardian: ActiveSpellGuardian = {
    ...guardian,
    elementalSpirit: {
      ...guardian.elementalSpirit,
      restrainedTargetId: undefined
    }
  };

  return {
    ...state,
    activeSpellGuardians: (state.activeSpellGuardians || []).map(record =>
      record.id === guardianId ? updatedGuardian : record
    ),
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${options.targetId} is no longer restrained by ${guardian.spellName || 'Conjure Elemental'}.`,
        characterId: guardian.casterId,
        targetIds: [options.targetId],
        data: {
          spellGuardianSurface: 'conjure_elemental',
          guardianId,
          repeatSaveOutcome: 'succeeded',
          releasedTargetId: options.targetId
        }
      }
    ]
  };
}

function getGridDistanceFeet(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt((dx * dx) + (dy * dy)) * 5;
}
