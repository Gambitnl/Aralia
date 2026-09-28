// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:32
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/ability/useConcentration.ts
 * Manages concentration tracking, manual concentration termination, and state propagation.
 *
 * In tabletop combat, powerful ongoing spells (such as Bless, Wall of Fire, or Fly) require
 * the caster's concentration. A caster can only concentrate on one spell at a time, and
 * they can choose to drop concentration voluntarily at any time for free. When concentration
 * ends, any ongoing magical effects (such as summoned creatures, light glows, persistent spell
 * zones, or polymorphed forms) are dismissed and cleaned up from the battlefield.
 *
 * Called by: useAbilitySystem.ts
 * Depends on: BreakConcentrationCommand, CommandExecutor, combat types
 */

import { useCallback } from 'react';
import type {
  ActiveAnimatedObject,
  ActiveExtradimensionalSpace,
  ActiveFireEffect,
  ActiveSpellEmanation,
  ActiveSpellForce,
  ActiveSpellGuardian,
  ActiveSpellHelper,
  ActiveSpellStructure,
  ActiveTruePolymorphTransformation,
  CombatCharacter,
  BattleMapData,
  CombatState,
  CombatLogEntry,
  ReactiveTrigger,
  LightSource,
  SpellObjectImpact,
  SpellObjectRepair,
  SpellObjectAccessChange
} from '../../types/combat';
import type { GameState } from '../../types';
import { BreakConcentrationCommand } from '../../commands/effects/ConcentrationCommands';
import { CommandExecutor } from '../../commands';
import type { ActiveSpellZone } from '../../systems/spells/effects/triggerHandler';

// ============================================================================
// Types
// ============================================================================

export interface UseConcentrationProps {
  charactersRef: React.MutableRefObject<CombatCharacter[]>;
  reactiveTriggersRef: React.MutableRefObject<ReactiveTrigger[] | undefined>;
  mapDataRef: React.MutableRefObject<BattleMapData | null>;
  activeLightSources?: LightSource[];
  spellZones?: ActiveSpellZone[];
  activeSpellHelpersRef: React.MutableRefObject<ActiveSpellHelper[] | undefined>;
  activeSpellForcesRef: React.MutableRefObject<ActiveSpellForce[] | undefined>;
  activeSpellGuardiansRef: React.MutableRefObject<ActiveSpellGuardian[] | undefined>;
  activeAnimatedObjectsRef: React.MutableRefObject<ActiveAnimatedObject[] | undefined>;
  activeSpellStructuresRef: React.MutableRefObject<ActiveSpellStructure[] | undefined>;
  activeExtradimensionalSpacesRef: React.MutableRefObject<ActiveExtradimensionalSpace[] | undefined>;
  activeSpellEmanationsRef: React.MutableRefObject<ActiveSpellEmanation[] | undefined>;
  spellObjectImpactsRef: React.MutableRefObject<SpellObjectImpact[] | undefined>;
  spellObjectRepairsRef: React.MutableRefObject<SpellObjectRepair[] | undefined>;
  spellObjectAccessChangesRef: React.MutableRefObject<SpellObjectAccessChange[] | undefined>;
  activeFireEffectsRef: React.MutableRefObject<ActiveFireEffect[] | undefined>;
  activeTruePolymorphTransformationsRef: React.MutableRefObject<ActiveTruePolymorphTransformation[] | undefined>;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry?: (entry: CombatLogEntry) => void;
  onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
  onActiveSpellHelpersUpdate?: (helpers: ActiveSpellHelper[]) => void;
  onActiveSpellForcesUpdate?: (forces: ActiveSpellForce[]) => void;
  onActiveSpellGuardiansUpdate?: (guardians: ActiveSpellGuardian[]) => void;
  onActiveAnimatedObjectsUpdate?: (objects: ActiveAnimatedObject[]) => void;
  onActiveSpellStructuresUpdate?: (structures: ActiveSpellStructure[]) => void;
  onActiveExtradimensionalSpacesUpdate?: (spaces: ActiveExtradimensionalSpace[]) => void;
  onActiveSpellEmanationsUpdate?: (emanations: ActiveSpellEmanation[]) => void;
  onSpellObjectImpactsUpdate?: (impacts: SpellObjectImpact[]) => void;
  onSpellObjectRepairsUpdate?: (repairs: SpellObjectRepair[]) => void;
  onSpellObjectAccessChangesUpdate?: (accessChanges: SpellObjectAccessChange[]) => void;
  onActiveFireEffectsUpdate?: (effects: ActiveFireEffect[]) => void;
  onActiveTruePolymorphTransformationsUpdate?: (transformations: ActiveTruePolymorphTransformation[]) => void;
  onSpellZonesUpdate?: (zones: ActiveSpellZone[]) => void;
  onMapUpdate?: (mapData: BattleMapData) => void;
}

// ============================================================================
// React Sub-Hook: useConcentration
// ============================================================================
// Provides the voluntary dropConcentration action and cleans up all linked map
// hazards, light sources, constructs, and transformations.
// ============================================================================

export const useConcentration = ({
  charactersRef,
  reactiveTriggersRef,
  mapDataRef,
  activeLightSources,
  spellZones,
  activeSpellHelpersRef,
  activeSpellForcesRef,
  activeSpellGuardiansRef,
  activeAnimatedObjectsRef,
  activeSpellStructuresRef,
  activeExtradimensionalSpacesRef,
  activeSpellEmanationsRef,
  spellObjectImpactsRef,
  spellObjectRepairsRef,
  spellObjectAccessChangesRef,
  activeFireEffectsRef,
  activeTruePolymorphTransformationsRef,
  onCharacterUpdate,
  onLogEntry,
  onActiveLightSourcesUpdate,
  onActiveSpellHelpersUpdate,
  onActiveSpellForcesUpdate,
  onActiveSpellGuardiansUpdate,
  onActiveAnimatedObjectsUpdate,
  onActiveSpellStructuresUpdate,
  onActiveExtradimensionalSpacesUpdate,
  onActiveSpellEmanationsUpdate,
  onSpellObjectImpactsUpdate,
  onSpellObjectRepairsUpdate,
  onSpellObjectAccessChangesUpdate,
  onActiveFireEffectsUpdate,
  onActiveTruePolymorphTransformationsUpdate,
  onSpellZonesUpdate,
  onMapUpdate
}: UseConcentrationProps) => {

  /**
   * Allows a character to voluntarily end concentration on their current spell.
   * Cleans up all spell entities, persistent zones, and map lights tied to that spell.
   */
  const dropConcentration = useCallback(async (character: CombatCharacter) => {
    // If the character is not currently concentrating on any spell, do nothing.
    if (!character.concentratingOn) return;

    const currentCharacters = charactersRef.current;
    const currentTriggers = reactiveTriggersRef.current;

    // Construct a snapshot of combat state for command execution.
    const currentState: CombatState = {
      isActive: true,
      characters: currentCharacters,
      turnState: {
        currentTurn: 0,
        turnOrder: [],
        currentCharacterId: null,
        phase: 'planning',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
      spellZones: spellZones ?? [],
      reactiveTriggers: currentTriggers || [],
      activeLightSources: activeLightSources || [],
      activeSpellHelpers: activeSpellHelpersRef.current || [],
      activeSpellForces: activeSpellForcesRef.current || [],
      activeSpellGuardians: activeSpellGuardiansRef.current || [],
      activeAnimatedObjects: activeAnimatedObjectsRef.current || [],
      activeSpellStructures: activeSpellStructuresRef.current || [],
      activeExtradimensionalSpaces: activeExtradimensionalSpacesRef.current || [],
      activeSpellEmanations: activeSpellEmanationsRef.current || [],
      spellObjectImpacts: spellObjectImpactsRef.current || [],
      spellObjectRepairs: spellObjectRepairsRef.current || [],
      spellObjectAccessChanges: spellObjectAccessChangesRef.current || [],
      activeFireEffects: activeFireEffectsRef.current || [],
      activeTruePolymorphTransformations: activeTruePolymorphTransformationsRef.current || [],
      mapData: mapDataRef.current ?? undefined
    };

    // Instantiate the BreakConcentrationCommand with the caster's concentration info.
    const command = new BreakConcentrationCommand({
      spellId: character.concentratingOn.spellId,
      spellName: character.concentratingOn.spellName,
      caster: character,
      targets: [],
      castAtLevel: character.concentratingOn.spellLevel,
      gameState: {} as unknown as GameState,
    });

    // Execute the command to remove concentration effects.
    const result = await CommandExecutor.execute([command], currentState);

    if (result.success) {
      // Propagate the updated character with concentration cleared.
      result.finalState.characters.forEach(finalChar => {
        if (finalChar.id === character.id) {
          onCharacterUpdate(finalChar);
        }
      });

      // Output combat log entries.
      if (onLogEntry) {
        result.finalState.combatLog.forEach(entry => onLogEntry(entry));
      }

      // Dropping concentration can remove light sources linked to that spell.
      // Publish the resulting light array so the map glow disappears with the spell.
      if (onActiveLightSourcesUpdate && result.finalState.activeLightSources !== currentState.activeLightSources) {
        onActiveLightSourcesUpdate(result.finalState.activeLightSources || []);
      }
      if (onActiveSpellHelpersUpdate && result.finalState.activeSpellHelpers !== currentState.activeSpellHelpers) {
        onActiveSpellHelpersUpdate(result.finalState.activeSpellHelpers || []);
      }
      if (onActiveSpellForcesUpdate && result.finalState.activeSpellForces !== currentState.activeSpellForces) {
        onActiveSpellForcesUpdate(result.finalState.activeSpellForces || []);
      }
      if (onActiveSpellGuardiansUpdate && result.finalState.activeSpellGuardians !== currentState.activeSpellGuardians) {
        onActiveSpellGuardiansUpdate(result.finalState.activeSpellGuardians || []);
      }
      if (onActiveAnimatedObjectsUpdate && result.finalState.activeAnimatedObjects !== currentState.activeAnimatedObjects) {
        onActiveAnimatedObjectsUpdate(result.finalState.activeAnimatedObjects || []);
      }
      if (onActiveSpellStructuresUpdate && result.finalState.activeSpellStructures !== currentState.activeSpellStructures) {
        onActiveSpellStructuresUpdate(result.finalState.activeSpellStructures || []);
      }
      if (onActiveExtradimensionalSpacesUpdate && result.finalState.activeExtradimensionalSpaces !== currentState.activeExtradimensionalSpaces) {
        onActiveExtradimensionalSpacesUpdate(result.finalState.activeExtradimensionalSpaces || []);
      }
      if (onActiveSpellEmanationsUpdate && result.finalState.activeSpellEmanations !== currentState.activeSpellEmanations) {
        onActiveSpellEmanationsUpdate(result.finalState.activeSpellEmanations || []);
      }
      if (onSpellObjectImpactsUpdate && result.finalState.spellObjectImpacts !== currentState.spellObjectImpacts) {
        onSpellObjectImpactsUpdate(result.finalState.spellObjectImpacts || []);
      }
      if (onSpellObjectRepairsUpdate && result.finalState.spellObjectRepairs !== currentState.spellObjectRepairs) {
        onSpellObjectRepairsUpdate(result.finalState.spellObjectRepairs || []);
      }
      if (onSpellObjectAccessChangesUpdate && result.finalState.spellObjectAccessChanges !== currentState.spellObjectAccessChanges) {
        onSpellObjectAccessChangesUpdate(result.finalState.spellObjectAccessChanges || []);
      }
      if (onActiveFireEffectsUpdate && result.finalState.activeFireEffects !== currentState.activeFireEffects) {
        onActiveFireEffectsUpdate(result.finalState.activeFireEffects || []);
      }
      if (onActiveTruePolymorphTransformationsUpdate && result.finalState.activeTruePolymorphTransformations !== currentState.activeTruePolymorphTransformations) {
        onActiveTruePolymorphTransformationsUpdate(result.finalState.activeTruePolymorphTransformations || []);
      }
      if (onSpellZonesUpdate && result.finalState.spellZones !== currentState.spellZones) {
        onSpellZonesUpdate((result.finalState.spellZones || []) as ActiveSpellZone[]);
      }
      if (onMapUpdate && result.finalState.mapData && result.finalState.mapData !== currentState.mapData) {
        onMapUpdate(result.finalState.mapData);
      }
    }
  }, [
    charactersRef,
    reactiveTriggersRef,
    mapDataRef,
    activeLightSources,
    spellZones,
    activeSpellHelpersRef,
    activeSpellForcesRef,
    activeSpellGuardiansRef,
    activeAnimatedObjectsRef,
    activeSpellStructuresRef,
    activeExtradimensionalSpacesRef,
    activeSpellEmanationsRef,
    spellObjectImpactsRef,
    spellObjectRepairsRef,
    spellObjectAccessChangesRef,
    activeFireEffectsRef,
    activeTruePolymorphTransformationsRef,
    onCharacterUpdate,
    onLogEntry,
    onActiveLightSourcesUpdate,
    onActiveSpellHelpersUpdate,
    onActiveSpellForcesUpdate,
    onActiveSpellGuardiansUpdate,
    onActiveAnimatedObjectsUpdate,
    onActiveSpellStructuresUpdate,
    onActiveExtradimensionalSpacesUpdate,
    onActiveSpellEmanationsUpdate,
    onSpellObjectImpactsUpdate,
    onSpellObjectRepairsUpdate,
    onSpellObjectAccessChangesUpdate,
    onActiveFireEffectsUpdate,
    onActiveTruePolymorphTransformationsUpdate,
    onSpellZonesUpdate,
    onMapUpdate
  ]);

  return {
    dropConcentration
  };
};

export type UseConcentrationReturn = ReturnType<typeof useConcentration>;
