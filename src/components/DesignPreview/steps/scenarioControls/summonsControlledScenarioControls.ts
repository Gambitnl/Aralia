/**
 * This file owns the production-backed Summons & Controlled Allies sandbox.
 *
 * Selectors prepare one deterministic Summon Beast, placement, command, or source-
 * loss case. Action controls then call the real summoning, concentration, targeting,
 * turn, and commanded-summon paths. Reset applies the same defaults again, so the
 * board never stores a second private version of summon truth.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: SummoningCommand, concentration cleanup, action economy, and map geometry.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// ============================================================================
// Production Rules And Shared Types
// ============================================================================
// Summon Beast JSON supplies the actor, command, initiative, range, and lifecycle
// facts. The adapter only supplies stable actors, positions, and proof choices.
// ============================================================================

import summonBeastData from '@/data/spells/level-2/summon-beast.json';
import type { GameState, Spell } from '../../../../types';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
} from '../../../../types/combat';
import type { SummoningEffect } from '../../../../types/spells';
import { SummoningCommand } from '../../../../commands/effects/SummoningCommand';
import {
  BreakConcentrationCommand,
  StartConcentrationCommand,
} from '../../../../commands/effects/ConcentrationCommands';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../utils/combat/actionEconomyUtils';
import { getCombatDistanceFeet } from '../../../../utils/spatial/elevationGeometry';
import {
  getExactOwnedSummons,
  resolveSummonPlacement,
} from '../../../../systems/combat/summonControlledResolution';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Board Identities And Cases
// ============================================================================
// The production command generates a transient actor id. This teaching board
// normalizes that one id after creation so Reset, replay, and screenshots remain stable.
// ============================================================================

export const SUMMONS_CONTROLLED_OWNER_ID = 'summons_controlled-tester';
export const SUMMONS_CONTROLLED_TARGET_ID = 'summons_controlled-target';
export const SUMMONS_CONTROLLED_SUMMON_ID = 'controlled-summon';
export const SUMMONS_CONTROLLED_OTHER_SUMMON_ID = 'opposing-controlled-summon';

const LIFECYCLE_CASE_CONTROL_ID = 'lifecycle_case';
const COMMAND_CASE_CONTROL_ID = 'command_case';
const SUMMON_EVENT_ID = 'cs14-summon-event-001';
const COMMAND_EVENT_ID = 'cs14-command-event-001';
const SUMMON_RANGE_FEET = summonBeastData.range.distance;
const LEGAL_DESTINATION = { x: 6, y: 6 } as const;
const EDGE_DESTINATION = { x: 20, y: 6 } as const;
const OUT_OF_RANGE_DESTINATION = { x: 21, y: 6 } as const;

type LifecycleCase = 'ready' | 'summon_legal' | 'summon_edge' | 'summon_out_of_range'
  | 'summon_occupied' | 'source_loss' | 'replay';
type CommandCase = 'advance_to_summon' | 'legal' | 'out_of_range' | 'replay';

const summonBeast = summonBeastData as unknown as Spell;
const summonEffect: SummoningEffect = (() => {
  const effect = summonBeast.effects.find((candidate): candidate is SummoningEffect => candidate.type === 'SUMMONING');
  if (!effect) throw new Error('Summon Beast no longer contains the summoning effect required by CS14.');
  return effect;
})();

// ============================================================================
// Deterministic Production State
// ============================================================================
// These helpers construct the narrow CombatState envelope required by commands.
// Logs are translated into one stable scenario message rather than retaining command
// timestamps, which keeps repeated pure applications byte-for-byte deterministic.
// ============================================================================

function createCombatState(
  application: PreviewCombatScenarioControlApplication,
  characters: CombatCharacter[],
): CombatState {
  return {
    isActive: true,
    characters,
    turnState: application.snapshot.turnState ?? {
      currentTurn: 1,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: SUMMONS_CONTROLLED_OWNER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: application.snapshot.reactiveTriggers,
    activeLightSources: application.snapshot.activeLightSources,
    mapData: application.snapshot.mapData ?? undefined,
  };
}

function commandGameState(state: CombatState): GameState {
  // The summon and concentration commands do not read world campaign fields.
  // Reusing the combat envelope avoids mock data in production while satisfying
  // the legacy command-context slot until that older API is narrowed.
  return state as unknown as GameState;
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => character.id === replacement.id ? replacement : character);
}

function createFullSpellSlots(levelTwoCurrent: number): NonNullable<CombatCharacter['spellSlots']> {
  return {
    level_1: { current: 0, max: 0 },
    level_2: { current: levelTwoCurrent, max: 1 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function normalizeSummon(
  character: CombatCharacter,
  id: string,
  owner: CombatCharacter,
  name: string,
): CombatCharacter {
  return {
    ...resetEconomy(character),
    id,
    name,
    team: owner.team,
    initiative: owner.initiative,
    summonMetadata: character.summonMetadata
      ? {
          ...character.summonMetadata,
          casterId: owner.id,
          spellId: summonBeast.id,
          sourceName: summonBeast.name,
          initiativePolicy: 'shared',
          commandsUsedThisTurn: 0,
        }
      : character.summonMetadata,
  };
}

function createBaselineCharacters(
  application: PreviewCombatScenarioControlApplication,
): CombatCharacter[] {
  const ownerSeed = application.snapshot.characters.find(character => character.id === SUMMONS_CONTROLLED_OWNER_ID);
  const targetSeed = application.snapshot.characters.find(character => character.id === SUMMONS_CONTROLLED_TARGET_ID);
  if (!ownerSeed || !targetSeed) return application.snapshot.characters;

  const owner = {
    ...resetEconomy(ownerSeed),
    name: 'Circle Shepherd · Summon Owner · Init 18',
    position: { x: 2, y: 6 },
    team: 'player' as const,
    initiative: 18,
    spellSlots: createFullSpellSlots(1),
    concentratingOn: undefined,
  };
  const target = {
    ...resetEconomy(targetSeed),
    name: 'Training Target · Init 10',
    position: { x: 8, y: 6 },
    team: 'enemy' as const,
    initiative: 10,
    currentHP: 40,
    maxHP: 40,
  };
  let state = createCombatState(application, [owner, target]);
  const summoning = new SummoningCommand(summonEffect, {
    spellId: summonBeast.id,
    spellName: summonBeast.name,
    castAtLevel: 2,
    caster: owner,
    targets: [],
    selectedSpellTargets: [{ kind: 'point', position: { x: 5, y: 6 }, purpose: 'ground_target' }],
    playerInput: 'Air',
    gameState: commandGameState(state),
  });
  state = summoning.execute(state);
  const created = state.characters.find(character => character.isSummon);
  if (!created) return [owner, target];

  const ownedSummon = normalizeSummon(created, SUMMONS_CONTROLLED_SUMMON_ID, owner, 'Bestial Spirit · owner Circle Shepherd');
  state = {
    ...state,
    characters: [...state.characters.filter(character => !character.isSummon), ownedSummon],
    combatLog: state.combatLog.map(entry => ({
      ...entry,
      data: entry.data?.summonedId === created.id
        ? { ...entry.data, summonedId: ownedSummon.id }
        : entry.data,
    })),
  };
  const concentration = new StartConcentrationCommand(summonBeast, {
    spellId: summonBeast.id,
    spellName: summonBeast.name,
    castAtLevel: 2,
    caster: owner,
    targets: [],
    gameState: commandGameState(state),
  });
  state = concentration.execute(state);

  const liveOwner = state.characters.find(character => character.id === owner.id) ?? owner;
  const exactOwnedSummon = state.characters.find(character => character.id === ownedSummon.id) ?? ownedSummon;
  const otherSummon = normalizeSummon(
    exactOwnedSummon,
    SUMMONS_CONTROLLED_OTHER_SUMMON_ID,
    target,
    'Rival Bestial Spirit · owner Training Target',
  );
  otherSummon.position = { x: 11, y: 8 };

  return [liveOwner, target, exactOwnedSummon, otherSummon];
}

// ============================================================================
// Map And Initiative Preparation
// ============================================================================
// The extended floor exposes the exact 90/95-foot boundary in both renderers.
// Initiative totals stay authored while useTurnManager owns grouping and turns.
// ============================================================================

function prepareMap(mapData: BattleMapData | null): BattleMapData | undefined {
  if (!mapData) return undefined;
  const tiles = new Map(mapData.tiles);
  for (let y = 0; y < mapData.dimensions.height; y += 1) {
    for (let x = mapData.dimensions.width; x < 24; x += 1) {
      const id = `${x}-${y}`;
      const tile: BattleMapTile = {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      };
      tiles.set(id, tile);
    }
  }
  return { ...mapData, dimensions: { ...mapData.dimensions, width: 24 }, tiles };
}

export function getSummonsControlledInitiativeTotal(character: CombatCharacter): number {
  return character.initiative ?? 0;
}

// ============================================================================
// Lifecycle Cases
// ============================================================================
// A legal cast spends the owner's Action and level-2 slot, creates the actor through
// SummoningCommand, then starts real concentration. Invalid inputs stop before payment.
// Source loss delegates exact owner/spell cleanup to BreakConcentrationCommand.
// ============================================================================

function lifecycleDestination(choice: LifecycleCase) {
  if (choice === 'summon_edge') return EDGE_DESTINATION;
  if (choice === 'summon_out_of_range') return OUT_OF_RANGE_DESTINATION;
  return LEGAL_DESTINATION;
}

function prepareLifecycleCase(
  application: PreviewCombatScenarioControlApplication,
  choice: LifecycleCase,
): PreviewCombatScenarioControlPatch {
  if (choice === 'replay') return { logMessage: '' };
  const mapData = prepareMap(application.snapshot.mapData);
  let characters = createBaselineCharacters(application);

  if (choice.startsWith('summon_')) {
    characters = characters.filter(character => character.id !== SUMMONS_CONTROLLED_SUMMON_ID);
    characters = characters.map(character => character.id === SUMMONS_CONTROLLED_OWNER_ID
      ? {
          ...resetEconomy(character),
          spellSlots: createFullSpellSlots(1),
          concentratingOn: undefined,
        }
      : character);
  }
  if (choice === 'summon_occupied') {
    characters = characters.map(character => character.id === SUMMONS_CONTROLLED_TARGET_ID
      ? { ...character, position: { ...LEGAL_DESTINATION } }
      : character);
  }

  return {
    mapData,
    characters,
    reinitializeCombat: true,
    logMessage: choice === 'ready'
      ? ''
      : `SUMMON LIFECYCLE CASE PREPARED: ${choice}; no Action, slot, creation, or cleanup resolved yet.`,
  };
}

function resolveSummonEvent(
  application: PreviewCombatScenarioControlApplication,
  choice: LifecycleCase,
): PreviewCombatScenarioControlPatch {
  const owner = application.snapshot.characters.find(character => character.id === SUMMONS_CONTROLLED_OWNER_ID);
  const mapData = prepareMap(application.snapshot.mapData);
  if (!owner || !mapData) return { logMessage: 'SUMMON EVENT REJECTED: owner or map is missing.' };

  if (choice === 'source_loss') {
    if (!owner.concentratingOn) {
      return { logMessage: 'SOURCE LOSS REPLAY: no owned concentration or summon changed.' };
    }
    const state = createCombatState(application, application.snapshot.characters);
    const cleanup = new BreakConcentrationCommand({
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster: owner,
      targets: [],
      gameState: commandGameState(state),
    }).execute(state);
    const removedOwned = !cleanup.characters.some(character => character.id === SUMMONS_CONTROLLED_SUMMON_ID);
    const preservedOther = cleanup.characters.some(character => character.id === SUMMONS_CONTROLLED_OTHER_SUMMON_ID);
    return {
      characters: cleanup.characters,
      removeCharacterFromCombatId: removedOwned ? SUMMONS_CONTROLLED_SUMMON_ID : undefined,
      logMessage: `SOURCE LOSS RESOLVED: owned Bestial Spirit ${removedOwned ? 'despawned' : 'unchanged'}; rival owned summon ${preservedOther ? 'preserved' : 'missing'}.`,
    };
  }

  const alreadyOwned = getExactOwnedSummons(
    application.snapshot.characters,
    owner.id,
    summonBeast.id,
  );
  if (alreadyOwned.length > 0) {
    return { logMessage: `SUMMON REPLAY ${SUMMON_EVENT_ID}: stable no-op; the exact owned spirit already exists.` };
  }

  const destination = lifecycleDestination(choice);
  const placement = resolveSummonPlacement({
    caster: owner,
    destination,
    characters: application.snapshot.characters,
    mapData,
    rangeFeet: SUMMON_RANGE_FEET,
    requireLineOfSight: true,
  });
  if (placement.status === 'rejected') {
    return { logMessage: `SUMMON REJECTED ATOMIC NO-OP: ${placement.message} Action and level-2 slot remain ready.` };
  }

  const spellCost = { type: 'action' as const, spellSlotLevel: 2 };
  if (!canAffordActionCost(owner, spellCost)) {
    return { logMessage: 'SUMMON REJECTED ATOMIC NO-OP: owner lacks the Action or level-2 slot.' };
  }
  const paidOwner = consumeActionCost(owner, spellCost);
  let state = createCombatState(
    application,
    replaceCharacter(application.snapshot.characters, paidOwner),
  );
  state = new SummoningCommand(summonEffect, {
    spellId: summonBeast.id,
    spellName: summonBeast.name,
    castAtLevel: 2,
    caster: paidOwner,
    targets: [],
    selectedSpellTargets: [{ kind: 'point', position: destination, purpose: 'ground_target' }],
    playerInput: 'Air',
    gameState: commandGameState(state),
  }).execute(state);
  const created = getExactOwnedSummons(state.characters, owner.id, summonBeast.id)[0];
  if (!created) return { logMessage: 'SUMMON REJECTED: production command created no actor.' };

  const normalized = normalizeSummon(created, SUMMONS_CONTROLLED_SUMMON_ID, paidOwner, 'Bestial Spirit · owner Circle Shepherd');
  state = {
    ...state,
    characters: state.characters.map(character => character.id === created.id ? normalized : character),
    combatLog: state.combatLog.map(entry => ({
      ...entry,
      data: entry.data?.summonedId === created.id
        ? { ...entry.data, summonedId: normalized.id }
        : entry.data,
    })),
  };
  state = new StartConcentrationCommand(summonBeast, {
    spellId: summonBeast.id,
    spellName: summonBeast.name,
    castAtLevel: 2,
    caster: paidOwner,
    targets: [],
    gameState: commandGameState(state),
  }).execute(state);

  return {
    mapData,
    characters: state.characters,
    reinitializeCombat: true,
    logMessage: `SUMMON RESOLVED ${SUMMON_EVENT_ID}: Bestial Spirit at ${destination.x},${destination.y}; owner Action spent; L2 slot 0/1; shared initiative; independent economy ready.`,
  };
}

// ============================================================================
// Command And Turn Cases
// ============================================================================
// End Turn remains production-owned. Once the summon is active, its real Rend button
// crosses the commanded-summon gate, attack roll, damage, and actor-local Action ledger.
// ============================================================================

function prepareCommandCase(
  application: PreviewCombatScenarioControlApplication,
  choice: CommandCase,
): PreviewCombatScenarioControlPatch {
  if (choice === 'advance_to_summon' || choice === 'replay') return { logMessage: '' };
  const targetPosition = choice === 'out_of_range' ? { x: 20, y: 6 } : { x: 6, y: 6 };
  return {
    characters: application.snapshot.characters.map(character => {
      if (character.id === SUMMONS_CONTROLLED_SUMMON_ID) return { ...character, position: { x: 5, y: 6 } };
      if (character.id === SUMMONS_CONTROLLED_TARGET_ID) return { ...character, position: targetPosition };
      return character;
    }),
    logMessage: `COMMAND CASE PREPARED: ${choice}; no command, Action, roll, or damage resolved yet.`,
  };
}

function resolveCommandEvent(
  application: PreviewCombatScenarioControlApplication,
  choice: CommandCase,
): PreviewCombatScenarioControlPatch {
  if (choice === 'advance_to_summon') {
    return application.snapshot.turnState?.currentCharacterId === SUMMONS_CONTROLLED_OWNER_ID
      ? { endTurn: true, logMessage: 'OWNER TURN ENDS: production group order now starts the owned spirit turn with its own resources.' }
      : { logMessage: 'TURN ADVANCE REJECTED: the summon owner is not the current actor.' };
  }

  const summon = getExactOwnedSummons(
    application.snapshot.characters,
    SUMMONS_CONTROLLED_OWNER_ID,
    summonBeast.id,
  )[0];
  const target = application.snapshot.characters.find(character => character.id === SUMMONS_CONTROLLED_TARGET_ID);
  const rend = summon?.abilities.find(ability => ability.name === 'Rend');
  if (!summon || !target || !rend) {
    return { logMessage: 'COMMAND REJECTED: owned spirit, target, or production Rend ability is missing.' };
  }
  if (application.snapshot.turnState?.currentCharacterId !== summon.id) {
    return { logMessage: 'COMMAND REJECTED: end the owner turn first; the spirit owns its Action and turn.' };
  }

  const distanceFeet = application.snapshot.mapData
    ? getCombatDistanceFeet(summon, target, application.snapshot.mapData)
    : Math.max(
        Math.abs(summon.position.x - target.position.x),
        Math.abs(summon.position.y - target.position.y),
      ) * 5;
  if (distanceFeet > rend.range * 5) {
    return { logMessage: `COMMAND REJECTED ATOMIC NO-OP: target is ${distanceFeet} ft away; Rend reach is ${rend.range * 5} ft. Summon Action and command budget remain unchanged.` };
  }

  return {
    abilityExecution: {
      ability: rend,
      casterId: summon.id,
      targetId: target.id,
      attackRollRng: () => 0.95,
      damageRng: () => 0.5,
      executionEventId: COMMAND_EVENT_ID,
      executionDecision: 'accept',
    },
    logMessage: choice === 'replay'
      ? `COMMAND REPLAY REQUESTED ${COMMAND_EVENT_ID}: the hook-owned receipt must preserve HP, Action, and command count.`
      : `OWNER COMMAND REQUESTED ${COMMAND_EVENT_ID}: verbal command costs the owner nothing; the spirit spends its own Action if Rend resolves.`,
  };
}

// ============================================================================
// Control Registration
// ============================================================================
// Four controls cover preparation and execution. The host's existing Reset Board
// reapplies their defaults, restoring both owners, both summons, turn resources,
// concentration ownership, positions, HP, and the stable event epoch.
// ============================================================================

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: LIFECYCLE_CASE_CONTROL_ID,
    label: 'Summon / despawn case',
    description: 'Choose legal creation, range edge, rejection, source loss, or replay before resolving.',
    kind: 'select',
    defaultValue: 'ready',
    options: [
      { value: 'ready', label: 'Ready · owned summon present' },
      { value: 'summon_legal', label: 'Summon · legal 20 ft space' },
      { value: 'summon_edge', label: 'Summon · exact 90 ft edge' },
      { value: 'summon_out_of_range', label: 'Reject · 95 ft away' },
      { value: 'summon_occupied', label: 'Reject · occupied space' },
      { value: 'source_loss', label: 'Despawn · source concentration lost' },
      { value: 'replay', label: 'Replay · same summon event' },
    ],
  },
  {
    id: 'resolve_lifecycle',
    label: 'Resolve summon event',
    description: 'Use production placement, payment, summoning, concentration, or exact source cleanup.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: COMMAND_CASE_CONTROL_ID,
    label: 'Owner command / turn case',
    description: 'Advance to the spirit turn, resolve in/out-of-range Rend, or replay the same command.',
    kind: 'select',
    defaultValue: 'advance_to_summon',
    options: [
      { value: 'advance_to_summon', label: 'End owner turn · start summon' },
      { value: 'legal', label: 'Command Rend · 5 ft' },
      { value: 'out_of_range', label: 'Reject Rend · 75 ft' },
      { value: 'replay', label: 'Replay · same command event' },
    ],
  },
  {
    id: 'resolve_command',
    label: 'Resolve owner command',
    description: 'Use the production turn, command gate, attack, damage, and independent summon Action.',
    kind: 'action',
    defaultValue: false,
  },
];

function isLifecycleCase(value: unknown): value is LifecycleCase {
  return ['ready', 'summon_legal', 'summon_edge', 'summon_out_of_range', 'summon_occupied', 'source_loss', 'replay']
    .includes(String(value));
}

function isCommandCase(value: unknown): value is CommandCase {
  return ['advance_to_summon', 'legal', 'out_of_range', 'replay'].includes(String(value));
}

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === LIFECYCLE_CASE_CONTROL_ID) {
    return isLifecycleCase(application.value)
      ? prepareLifecycleCase(application, application.value)
      : { logMessage: `SUMMON CASE REJECTED: unknown value ${String(application.value)}.` };
  }
  if (application.controlId === COMMAND_CASE_CONTROL_ID) {
    return isCommandCase(application.value)
      ? prepareCommandCase(application, application.value)
      : { logMessage: `COMMAND CASE REJECTED: unknown value ${String(application.value)}.` };
  }
  if (application.value !== true) return { logMessage: '' };
  if (application.controlId === 'resolve_lifecycle') {
    const choice = application.snapshot.controlValues?.[LIFECYCLE_CASE_CONTROL_ID];
    return isLifecycleCase(choice)
      ? resolveSummonEvent(application, choice)
      : { logMessage: 'SUMMON EVENT REJECTED: choose a lifecycle case first.' };
  }
  if (application.controlId === 'resolve_command') {
    const choice = application.snapshot.controlValues?.[COMMAND_CASE_CONTROL_ID];
    return isCommandCase(choice)
      ? resolveCommandEvent(application, choice)
      : { logMessage: 'COMMAND EVENT REJECTED: choose a command case first.' };
  }
  return { logMessage: `SUMMON CONTROL REJECTED: unknown control ${application.controlId}.` };
}

const summonsControlledScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'summons_controlled',
  controls,
  applyControl,
};

export default summonsControlledScenarioControls;
