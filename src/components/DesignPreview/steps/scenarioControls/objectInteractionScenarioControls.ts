/**
 * This file adapts CS15 controls to the production object transaction.
 *
 * Selectors prepare deterministic range, sight, ownership, economy, and object
 * facts. The action control then calls `resolveObjectInteraction`; it never
 * spends resources or changes object state independently. Reset applies these
 * same defaults to a fresh crate, producing the exact authored baseline.
 *
 * Called by: Tactical Sandbox scenario-control registry.
 * Depends on: production object interaction resolution and the training crate.
 */

import type { BattleMapData, CombatCharacter, TargetableMapObject } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import {
  resolveObjectInteraction,
  type ObjectInteractionOperation,
} from '../../../../systems/combat/objectInteractionResolution';
import {
  OBJECT_INTERACTION_CRATE_ID,
  createObjectInteractionCrate,
} from '../PreviewCombatScenarioObjects';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable CS15 Facts
// ============================================================================

export const OBJECT_INTERACTION_TESTER_ID = 'object_interaction-tester';
const OBJECT_INTERACTION_EVENT_ID = 'cs15-object-event-001';
const BLOCKER_TILE_ID = '6-5';

type InteractionCase = 'legal' | 'free_used' | 'all_spent' | 'out_of_range'
  | 'total_cover' | 'wrong_owner' | 'missing_target' | 'replay';
type ObjectOperationChoice = ObjectInteractionOperation | 'destroy';

function readOperationChoice(application: PreviewCombatScenarioControlApplication): ObjectOperationChoice {
  const value = String(application.snapshot.controlValues?.operation ?? 'open');
  return value === 'use' || value === 'damage' || value === 'destroy' ? value : 'open';
}

function productionOperation(choice: ObjectOperationChoice): ObjectInteractionOperation {
  return choice === 'destroy' ? 'damage' : choice;
}

function damageForChoice(choice: ObjectOperationChoice): number | undefined {
  if (choice === 'destroy') return 10;
  return choice === 'damage' ? 4 : undefined;
}

function readCase(application: PreviewCombatScenarioControlApplication): InteractionCase {
  const value = String(application.snapshot.controlValues?.interaction_case ?? 'legal');
  return ['free_used', 'all_spent', 'out_of_range', 'total_cover', 'wrong_owner', 'missing_target', 'replay']
    .includes(value) ? value as InteractionCase : 'legal';
}

function replaceTester(
  characters: CombatCharacter[],
  change: (tester: CombatCharacter) => CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => character.id === OBJECT_INTERACTION_TESTER_ID
    ? change(character)
    : character);
}

function replaceCrate(
  mapData: BattleMapData,
  change: (crate: TargetableMapObject) => TargetableMapObject,
): BattleMapData {
  return {
    ...mapData,
    targetableObjects: (mapData.targetableObjects ?? []).map(targetObject => (
      targetObject.id === OBJECT_INTERACTION_CRATE_ID ? change(targetObject) : targetObject
    )),
  };
}

// ============================================================================
// Deterministic Case Preparation
// ============================================================================

function prepareOperation(
  application: PreviewCombatScenarioControlApplication,
  operation: ObjectOperationChoice,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) return { logMessage: 'Object Interaction requires a battle map.' };

  // Changing operation establishes its own clean object precondition. Use needs
  // an open container; open and damage start from the exact factory baseline.
  const baseline = createObjectInteractionCrate();
  const crate = operation === 'use'
    ? { ...baseline, interactionState: { ...baseline.interactionState!, isOpen: true } }
    : baseline;
  const mapData = replaceCrate(application.snapshot.mapData, () => crate);
  const characters = replaceTester(application.snapshot.characters, tester => ({
    ...resetEconomy(tester),
    position: { x: 5, y: 5 },
  }));
  return {
    mapData,
    characters,
    logMessage: `Object operation prepared: ${operation}.`,
  };
}

function prepareCase(
  application: PreviewCombatScenarioControlApplication,
  interactionCase: InteractionCase,
): PreviewCombatScenarioControlPatch {
  const mapData = application.snapshot.mapData;
  if (!mapData) return { logMessage: 'Object Interaction requires a battle map.' };
  const choice = readOperationChoice(application);
  const operation = productionOperation(choice);

  let nextMap = replaceCrate(mapData, crate => ({
    ...crate,
    interactionState: {
      ...(crate.interactionState ?? createObjectInteractionCrate().interactionState!),
      ownerId: interactionCase === 'wrong_owner' ? 'object_interaction-target' : undefined,
    },
  }));
  let nextCharacters = replaceTester(application.snapshot.characters, tester => {
    const ready = resetEconomy(tester);
    return {
      ...ready,
      position: interactionCase === 'out_of_range' ? { x: 3, y: 5 } : { x: 5, y: 5 },
      actionEconomy: {
        ...ready.actionEconomy,
        freeActions: interactionCase === 'free_used' || interactionCase === 'all_spent' ? 0 : 1,
        action: interactionCase === 'all_spent'
          ? { used: true, remaining: 0 }
          : ready.actionEconomy.action,
      },
    };
  });

  // Total Cover changes the real tile consumed by the shared LoS resolver.
  // Every other case restores that tile's original authored facts.
  const baselineBlocker = mapData.tiles.get(BLOCKER_TILE_ID);
  if (baselineBlocker) {
    const tiles = new Map(nextMap.tiles);
    tiles.set(BLOCKER_TILE_ID, {
      ...baselineBlocker,
      blocksLoS: interactionCase === 'total_cover',
      blocksMovement: interactionCase === 'total_cover',
    });
    nextMap = { ...nextMap, tiles };
  }
  if (interactionCase === 'missing_target') {
    nextMap = {
      ...nextMap,
      targetableObjects: (nextMap.targetableObjects ?? [])
        .filter(targetObject => targetObject.id !== OBJECT_INTERACTION_CRATE_ID),
    };
  }

  // Replay preparation performs the first delivery through the production
  // transaction, then exposes that exact post-state for one duplicate attempt.
  if (interactionCase === 'replay') {
    const first = resolveObjectInteraction({
      characters: nextCharacters,
      mapData: nextMap,
      turnState: application.snapshot.turnState,
      request: {
        eventId: OBJECT_INTERACTION_EVENT_ID,
        actorId: OBJECT_INTERACTION_TESTER_ID,
        objectId: OBJECT_INTERACTION_CRATE_ID,
        operation,
        damage: damageForChoice(choice),
      },
    });
    nextCharacters = first.characters;
    nextMap = first.mapData;
  }

  return {
    mapData: nextMap,
    characters: nextCharacters,
    logMessage: `Object interaction case prepared: ${interactionCase}.`,
  };
}

// ============================================================================
// Production Action Dispatch
// ============================================================================

function resolvePreparedInteraction(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const mapData = application.snapshot.mapData;
  if (!mapData) return { logMessage: 'Object Interaction requires a battle map.' };
  const choice = readOperationChoice(application);
  const operation = productionOperation(choice);
  const result = resolveObjectInteraction({
    characters: application.snapshot.characters,
    mapData,
    turnState: application.snapshot.turnState,
    request: {
      eventId: OBJECT_INTERACTION_EVENT_ID,
      actorId: OBJECT_INTERACTION_TESTER_ID,
      objectId: OBJECT_INTERACTION_CRATE_ID,
      operation,
      damage: damageForChoice(choice),
    },
  });
  return {
    mapData: result.mapData,
    characters: result.characters,
    logMessage: `${result.accepted ? 'ACCEPTED' : 'REJECTED'} · ${result.reason}${result.cost ? ` · ${result.cost} spent` : ''}`,
  };
}

function applyObjectInteractionControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === 'operation') {
    return prepareOperation(application, readOperationChoice(application));
  }
  if (application.controlId === 'interaction_case') {
    return prepareCase(application, readCase(application));
  }
  if (application.controlId === 'resolve_interaction') {
    return application.value === true
      ? resolvePreparedInteraction(application)
      : { logMessage: '' };
  }
  return { logMessage: `Unknown Object Interaction control: ${application.controlId}.` };
}

// ============================================================================
// Registered Control Surface
// ============================================================================

export const objectInteractionScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'object_interaction',
  controls: [
    {
      id: 'operation',
      label: 'Object Operation',
      description: 'Open or use the container, or damage its finite durability.',
      kind: 'select',
      defaultValue: 'open',
      options: [
        { value: 'open', label: 'Open Container' },
        { value: 'use', label: 'Use Open Container' },
        { value: 'damage', label: 'Damage Object (4)' },
        { value: 'destroy', label: 'Destroy Object (10)' },
      ],
    },
    {
      id: 'interaction_case',
      label: 'Interaction Case',
      description: 'Prepare range, sight, ownership, economy, target, or stable replay facts.',
      kind: 'select',
      defaultValue: 'legal',
      options: [
        { value: 'legal', label: 'Legal · Free Ready' },
        { value: 'free_used', label: 'Free Used · Action Fallback' },
        { value: 'all_spent', label: 'Free + Action Spent' },
        { value: 'out_of_range', label: 'Out of Range' },
        { value: 'total_cover', label: 'Total Cover' },
        { value: 'wrong_owner', label: 'Wrong Owner' },
        { value: 'missing_target', label: 'Invalid Target' },
        { value: 'replay', label: 'Replay Stable Event' },
      ],
    },
    {
      id: 'resolve_interaction',
      label: 'Resolve Object Event',
      description: 'Run the prepared object event through the production transaction.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyObjectInteractionControl,
};

export default objectInteractionScenarioControls;
