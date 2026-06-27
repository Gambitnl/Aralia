// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/06/2026, 19:35:31
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatLogEntry, CombatState, Position, BattleMapData } from '../types/combat';
import { MovementEffect } from '../types/spells';
import { rollSavingThrow } from '../utils/savingThrowUtils';
import { generateId } from '../utils/combatUtils';
import { findPath } from '../utils/spatial/pathfinding';
import { SavePenaltySystem } from '../systems/combat/SavePenaltySystem';

export interface SpellMovementVisualInput {
  spellId: string;
  targetId: string;
  type: 'teleport' | 'forced_movement';
  from: Position;
  to: Position;
  path: Position[];
}

export const getMovementVisualType = (effects: MovementEffect[]): SpellMovementVisualInput['type'] => (
  effects.some(effect => effect.movementType === 'teleport') ? 'teleport' : 'forced_movement'
);

export const isForcedMovementForRepeatSave = (effect: MovementEffect): boolean => (
  effect.trigger?.movementType === 'forced' ||
  effect.movementType === 'push' ||
  effect.movementType === 'pull' ||
  effect.movementType === 'stop' ||
  Boolean(effect.forcedMovement)
);

export const repeatSaveHasRuntimeTiming = (
  repeatSave: NonNullable<CombatCharacter['statusEffects'][number]['repeatSave']>,
  timing: 'after_forced_movement'
): boolean => (
  repeatSave.timing === timing || repeatSave.additionalTimings?.includes(timing) === true
);

export const getRepeatSaveRuntimeDc = (
  repeatSave: NonNullable<CombatCharacter['statusEffects'][number]['repeatSave']>
): number => {
  const repeatWithRuntimeDc = repeatSave as typeof repeatSave & { dc?: unknown };
  return typeof repeatWithRuntimeDc.dc === 'number' ? repeatWithRuntimeDc.dc : 10;
};

export const appendImmediateRepeatSaveLog = (
  state: CombatState,
  entry: Omit<CombatLogEntry, 'id' | 'timestamp'>
): CombatState => ({
  ...state,
  combatLog: [
    ...state.combatLog,
    {
      ...entry,
      id: generateId(),
      timestamp: Date.now()
    }
  ]
});

export const resolveImmediateAfterForcedMovementRepeatSaves = (
  state: CombatState,
  originalTargets: CombatCharacter[],
  movementEffects: MovementEffect[]
): CombatState => {
  if (!movementEffects.some(isForcedMovementForRepeatSave)) {
    return state;
  }

  let nextState = state;

  originalTargets.forEach(originalTarget => {
    const movedTarget = nextState.characters.find(character => character.id === originalTarget.id);
    if (!movedTarget) return;
    if (movedTarget.position.x === originalTarget.position.x && movedTarget.position.y === originalTarget.position.y) return;

    const savedEffectNamesById = new Map<string, string>();

    movedTarget.statusEffects.forEach(effect => {
      const repeatSave = effect.repeatSave;
      if (!repeatSave || !repeatSaveHasRuntimeTiming(repeatSave, 'after_forced_movement')) return;

      if (repeatSave.progression) {
        nextState = appendImmediateRepeatSaveLog(nextState, {
          type: 'status',
          message: `${movedTarget.name}'s after-movement repeat progression for ${effect.name} needs a dedicated immediate-movement bridge.`,
          characterId: movedTarget.id,
          targetIds: [movedTarget.id],
          data: { effectId: effect.id, repeatSave }
        });
        return;
      }

      const supportedSaveTypes = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
      if (!supportedSaveTypes.includes(String(repeatSave.saveType))) {
        nextState = appendImmediateRepeatSaveLog(nextState, {
          type: 'status',
          message: `${movedTarget.name}'s after-movement repeat save for ${effect.name} is not implemented yet (${repeatSave.saveType}).`,
          characterId: movedTarget.id,
          targetIds: [movedTarget.id],
          data: { effectId: effect.id, repeatSaveType: repeatSave.saveType }
        });
        return;
      }

      // Immediate forced-movement repeat saves are real saving throws, so they
      // must see the same Mind Sliver/Bane-style modifiers as damage and status
      // commands. Without this bridge, a spell could move a target and grant an
      // after-movement save while silently ignoring a pending next-save rider.
      const savePenaltySystem = new SavePenaltySystem();
      const saveModifiers = savePenaltySystem.getActivePenalties(movedTarget);
      const saveResult = rollSavingThrow(
        movedTarget,
        repeatSave.saveType as Parameters<typeof rollSavingThrow>[1],
        getRepeatSaveRuntimeDc(repeatSave),
        saveModifiers
      );
      nextState = savePenaltySystem.consumeNextSavePenalties(nextState, movedTarget.id);
      nextState = appendImmediateRepeatSaveLog(nextState, {
        type: 'status',
        message: saveResult.success
          ? `${movedTarget.name} succeeds on after-movement repeat save against ${effect.name}.`
          : `${movedTarget.name} fails after-movement repeat save against ${effect.name}.`,
        characterId: movedTarget.id,
        targetIds: [movedTarget.id],
        data: { effectId: effect.id, saveType: repeatSave.saveType, saveTotal: saveResult.total }
      });

      if (saveResult.success && repeatSave.successEnds) {
        savedEffectNamesById.set(effect.id, String(effect.name));
      }
    });

    if (savedEffectNamesById.size > 0) {
      const savedEffectIds = new Set(savedEffectNamesById.keys());
      const savedEffectNames = new Set(savedEffectNamesById.values());
      nextState = {
        ...nextState,
        characters: nextState.characters.map(character => (
          character.id === movedTarget.id
            ? {
              ...character,
              statusEffects: character.statusEffects.filter(effect => !savedEffectIds.has(effect.id)),
              conditions: character.conditions?.filter(condition => !savedEffectNames.has(String(condition.name)))
            }
            : character
        ))
      };
    }
  });

  return nextState;
};

export const buildResolvedMovementVisualPath = (
  mapData: BattleMapData | null,
  from: Position,
  to: Position,
  visualType: SpellMovementVisualInput['type']
): Position[] => {
  if (visualType === 'teleport' || !mapData) {
    return [from, to];
  }

  const startTile = mapData.tiles.get(`${from.x}-${from.y}`);
  const endTile = mapData.tiles.get(`${to.x}-${to.y}`);

  if (!startTile || !endTile) {
    return [from, to];
  }

  const routedTiles = findPath(startTile, endTile, mapData);
  return routedTiles.length > 1
    ? routedTiles.map(tile => tile.coordinates)
    : [from, to];
};
