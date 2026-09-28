// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 01:37:42
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Teleportation & Occupied Spaces board.
 *
 * A Large Misty Step caster begins beside a reaction-ready Space Warden. The
 * authored map contains a visible free landing, difficult terrain, a low path
 * obstacle, an occupied far-footprint landing, a blocked far-footprint square,
 * an opaque wall, and a nearby board edge. Controls send exact destinations to
 * the production teleport resolver and turn its result into visible map cues,
 * resource labels, lights, and reasoned logs.
 *
 * Called by: the Tactical Sandbox control registry and scenario host.
 * Depends on: canonical Misty Step data and the production teleport resolver.
 */

// ============================================================================
// Canonical Scenario Inputs
// ============================================================================
// The adapter consumes live spell, combat, map, placement, and economy state.
// Only control definitions and post-result teaching cues are scenario-specific.
// ============================================================================

import mistyStepData from '@/data/spells/level-2/misty-step.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
  Position,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import {
  resolveTeleportation,
  type TeleportationResolution,
  type TeleportationResolutionReason,
} from '../../../../systems/spells/mechanics/teleportationResolution';
import { getOccupiedTiles } from '../../../../utils/combat/combatUtils';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Actors, Destinations, And Cue IDs
// ============================================================================
// The Large 2-by-2 footprint makes anchor-only placement bugs visible. The
// warden occupies only the far square of the occupied test destination while
// also standing beside the starting footprint for the reaction proof.
// ============================================================================

const MISTY_STEP = mistyStepData as unknown as Spell;

export const TELEPORTATION_CASTER_ID = 'teleportation_occupied_spaces-caster';
export const TELEPORTATION_WARDEN_ID = 'teleportation_occupied_spaces-warden';
export const TELEPORTATION_CASTER_START: Position = { x: 2, y: 5 };
export const TELEPORTATION_WARDEN_START: Position = { x: 4, y: 6 };
export const TELEPORTATION_LEGAL_DESTINATION: Position = { x: 7, y: 2 };
export const TELEPORTATION_OCCUPIED_DESTINATION: Position = { x: 3, y: 6 };
export const TELEPORTATION_BLOCKED_DESTINATION: Position = { x: 5, y: 8 };
export const TELEPORTATION_BLOCKED_FOOTPRINT_TILE: Position = { x: 6, y: 9 };
export const TELEPORTATION_HIDDEN_DESTINATION: Position = { x: 7, y: 7 };
export const TELEPORTATION_SIGHT_BLOCKER_TILE: Position = { x: 5, y: 6 };
export const TELEPORTATION_OUT_OF_RANGE_DESTINATION: Position = { x: 10, y: 2 };
export const TELEPORTATION_BOUNDARY_START: Position = { x: 12, y: 9 };
export const TELEPORTATION_OUT_OF_BOUNDS_DESTINATION: Position = { x: 15, y: 10 };
export const TELEPORTATION_PATH_OBSTACLE_TILE: Position = { x: 5, y: 3 };

const INVALID_DESTINATION_CONTROL_ID = 'invalid-destination';
const SOURCE_CUE_ID = 'teleportation-source-cue';
const DESTINATION_CUE_ID = 'teleportation-destination-cue';

type InvalidDestinationChoice = 'blocked' | 'out_of_bounds' | 'hidden' | 'out_of_range';

interface TeleportationActors {
  caster: CombatCharacter;
  warden: CombatCharacter;
}

// ============================================================================
// Repeatable Board Construction
// ============================================================================
// Every control starts from the same authored board, so successes and failures
// remain independently comparable and Reset Board can restore exact resources,
// positions, reactions, terrain, and visibility.
// ============================================================================

function requireActors(characters: CombatCharacter[]): TeleportationActors | null {
  const caster = characters.find(character => character.id === TELEPORTATION_CASTER_ID);
  const warden = characters.find(character => character.id === TELEPORTATION_WARDEN_ID);
  return caster && warden ? { caster, warden } : null;
}

function replaceActors(
  characters: CombatCharacter[],
  actors: TeleportationActors,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === actors.caster.id) return actors.caster;
    if (character.id === actors.warden.id) return actors.warden;
    return character;
  });
}

function prepareActors(
  characters: CombatCharacter[],
  casterPosition = TELEPORTATION_CASTER_START,
): CombatCharacter[] {
  const found = requireActors(characters);
  if (!found) return characters;

  const freshCaster = resetEconomy({
    ...found.caster,
    name: 'Misty Vanguard · Large 2×2 · BA ready · L2 1/1 · Move 0/30',
    level: 5,
    position: { ...casterPosition },
    team: 'player',
    stats: { ...found.caster.stats, size: 'Large', baseInitiative: 20 },
    spellSlots: { level_2: { current: 1, max: 1 } },
    abilities: [],
    statusEffects: [],
    conditions: [],
    activeEffects: [],
  });
  const caster: CombatCharacter = {
    ...freshCaster,
    actionEconomy: {
      ...freshCaster.actionEconomy,
      movement: { used: 0, total: 30 },
    },
  };
  const freshWarden = resetEconomy({
    ...found.warden,
    name: 'Space Warden · occupies 4,6 · Reaction ready',
    position: { ...TELEPORTATION_WARDEN_START },
    team: 'enemy',
    stats: { ...found.warden.stats, size: 'Medium', baseInitiative: 5 },
    abilities: [],
    statusEffects: [],
    conditions: [],
    activeEffects: [],
  });

  return replaceActors(characters, { caster, warden: freshWarden });
}

/**
 * Seeds the mounted 2D/3D board with the exact actors used by every control.
 * Reset Board calls the host initializer again, restoring the unspent spell.
 */
export function prepareTeleportationOccupiedSpacesCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return prepareActors(characters);
}

function updateTile(
  mapData: BattleMapData,
  position: Position,
  patch: Partial<BattleMapTile>,
): BattleMapData {
  const id = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(id);
  if (!tile) return mapData;

  const tiles = new Map(mapData.tiles);
  tiles.set(id, { ...tile, ...patch });
  return { ...mapData, tiles };
}

/**
 * Builds the scenario's canonical placement and traversal obstacles on top of
 * the host's normal 16-by-12 dungeon. Existing unrelated map fields survive.
 */
export function prepareTeleportationOccupiedSpacesMapData(
  mapData: BattleMapData,
): BattleMapData {
  let prepared = { ...mapData, tiles: new Map(mapData.tiles), theme: 'dungeon' as const };

  // A four-cell mud strip makes the ordinary 40-foot walking price visible.
  // Misty Step crosses it without charging any movement.
  for (let y = 2; y <= 5; y += 1) {
    prepared = updateTile(prepared, { x: 4, y }, {
      terrain: 'mud',
      movementCost: 10,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: ['difficult-path'],
    });
  }

  prepared = updateTile(prepared, TELEPORTATION_PATH_OBSTACLE_TILE, {
    terrain: 'rock',
    movementCost: 0,
    blocksMovement: true,
    blocksLoS: false,
    decoration: 'low_barrier',
    effects: ['path-obstacle'],
  });
  prepared = updateTile(prepared, TELEPORTATION_SIGHT_BLOCKER_TILE, {
    terrain: 'wall',
    movementCost: 0,
    blocksMovement: true,
    blocksLoS: true,
    decoration: 'high_wall',
    effects: ['visibility-blocker'],
  });
  prepared = updateTile(prepared, TELEPORTATION_BLOCKED_FOOTPRINT_TILE, {
    terrain: 'rock',
    movementCost: 0,
    blocksMovement: true,
    blocksLoS: false,
    decoration: 'low_barrier',
    effects: ['far-footprint-blocker'],
  });

  // Green destination squares and silver source squares are teaching cues only;
  // legality still comes from the resolver and the underlying passable tiles.
  for (const position of [
    TELEPORTATION_CASTER_START,
    { x: 2, y: 6 },
    { x: 3, y: 5 },
    { x: 3, y: 6 },
  ]) {
    prepared = updateTile(prepared, position, {
      terrain: 'sand',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: ['teleport-source'],
    });
  }
  for (const position of [
    TELEPORTATION_LEGAL_DESTINATION,
    { x: 7, y: 3 },
    { x: 8, y: 2 },
    { x: 8, y: 3 },
  ]) {
    prepared = updateTile(prepared, position, {
      terrain: 'grass',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: ['legal-destination'],
    });
  }

  return prepared;
}

// ============================================================================
// Teleport Cues And Result Narration
// ============================================================================
// Cue lights are derived only from a successful production result. They remain
// after the instantaneous spell as an inspectable afterimage for 2D/3D proof.
// ============================================================================

function removeOldCueLights(lightSources: LightSource[]): LightSource[] {
  return lightSources.filter(light => (
    light.id !== SOURCE_CUE_ID && light.id !== DESTINATION_CUE_ID
  ));
}

function createCueLights(result: TeleportationResolution): LightSource[] {
  if (result.status !== 'teleported' || !result.origin) return [];
  return [
    {
      id: SOURCE_CUE_ID,
      sourceSpellId: MISTY_STEP.id,
      casterId: TELEPORTATION_CASTER_ID,
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: result.origin,
      color: '#c4b5fd',
      createdTurn: 0,
    },
    {
      id: DESTINATION_CUE_ID,
      sourceSpellId: MISTY_STEP.id,
      casterId: TELEPORTATION_CASTER_ID,
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: result.destination,
      color: '#67e8f9',
      createdTurn: 0,
    },
  ];
}

function decorateCharacters(result: TeleportationResolution): CombatCharacter[] {
  return result.characters.map(character => {
    if (character.id === TELEPORTATION_CASTER_ID) {
      const slot = character.spellSlots?.level_2;
      const bonus = character.actionEconomy.bonusAction.used ? 'BA spent' : 'BA ready';
      return {
        ...character,
        name: `Misty Vanguard · Large 2×2 · at ${character.position.x},${character.position.y} · ${bonus} · L2 ${slot?.current ?? 0}/${slot?.max ?? 0} · Move ${character.actionEconomy.movement.used}/${character.actionEconomy.movement.total}`,
      };
    }
    if (character.id === TELEPORTATION_WARDEN_ID) {
      const reaction = character.actionEconomy.reaction.used ? 'Reaction spent' : 'Reaction ready';
      return { ...character, name: `Space Warden · occupies 4,6 · ${reaction}` };
    }
    return character;
  });
}

function rejectionLabel(reason: TeleportationResolutionReason): string {
  const labels: Partial<Record<TeleportationResolutionReason, string>> = {
    destination_occupied: 'occupied by the Space Warden on the far 2×2 footprint square',
    destination_blocked: 'the far 2×2 footprint square at 6,9 is blocked',
    destination_out_of_bounds: 'the Large footprint leaves the battle map',
    destination_not_visible: 'the destination is hidden behind the opaque wall',
    destination_out_of_range: 'the destination is 40 feet away, beyond Misty Step\'s 30-foot range',
  };
  return labels[reason] ?? reason.replace(/_/g, ' ');
}

function resolveAttempt(
  application: PreviewCombatScenarioControlApplication,
  destination: Position,
  casterPosition = TELEPORTATION_CASTER_START,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Misty Step attempt skipped because no battle map is loaded.' };
  }

  const characters = prepareActors(application.snapshot.characters, casterPosition);
  const mapData = prepareTeleportationOccupiedSpacesMapData(application.snapshot.mapData);
  const result = resolveTeleportation({
    characters,
    mapData,
    casterId: TELEPORTATION_CASTER_ID,
    spell: MISTY_STEP,
    destination,
  });
  const decorated = decorateCharacters(result);
  const activeLightSources = [
    ...removeOldCueLights(application.snapshot.activeLightSources),
    ...createCueLights(result),
  ];

  if (result.status === 'teleported') {
    const footprint = result.placement?.occupiedTiles
      .map(tile => `${tile.x},${tile.y}`)
      .join(' · ');
    return {
      characters: decorated,
      mapData,
      activeLightSources,
      logMessage: `Misty Step SUCCESS: visible free Large footprint ${footprint}. Bonus Action spent; level-2 slot 1 → 0. Teleport crossed the mud and low barrier directly: movement stayed 0/30, path tiles entered 0, Space Warden Reaction stayed ready, and opportunity attacks triggered 0. Silver source and cyan destination afterimages mark the jump.`,
    };
  }

  return {
    characters: decorated,
    mapData,
    activeLightSources,
    logMessage: `Misty Step REJECTED before cost or effect: ${rejectionLabel(result.reason)}. Caster remains at ${casterPosition.x},${casterPosition.y}; Bonus Action ready, level-2 slot 1/1, movement 0/30, and Space Warden Reaction ready. ${result.placement?.reason ?? ''}`.trim(),
  };
}

// ============================================================================
// Control Dispatch And Registration
// ============================================================================
// Two action buttons prove success and full-footprint occupancy. One selector
// covers every independent invalid destination reason without multiplying UI.
// ============================================================================

function applyInvalidDestination(
  application: PreviewCombatScenarioControlApplication,
  choice: InvalidDestinationChoice,
): PreviewCombatScenarioControlPatch {
  if (choice === 'blocked') {
    return resolveAttempt(application, TELEPORTATION_BLOCKED_DESTINATION);
  }
  if (choice === 'out_of_bounds') {
    return resolveAttempt(
      application,
      TELEPORTATION_OUT_OF_BOUNDS_DESTINATION,
      TELEPORTATION_BOUNDARY_START,
    );
  }
  if (choice === 'hidden') {
    return resolveAttempt(application, TELEPORTATION_HIDDEN_DESTINATION);
  }
  return resolveAttempt(application, TELEPORTATION_OUT_OF_RANGE_DESTINATION);
}

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === INVALID_DESTINATION_CONTROL_ID) {
    const choice = String(application.value) as InvalidDestinationChoice;
    const allowed: InvalidDestinationChoice[] = [
      'blocked',
      'out_of_bounds',
      'hidden',
      'out_of_range',
    ];
    return allowed.includes(choice)
      ? applyInvalidDestination(application, choice)
      : { logMessage: `Unknown teleport invalid-destination choice: ${choice}.` };
  }

  if (application.value === false) return { logMessage: '' };
  if (application.value !== true) {
    return { logMessage: `Teleportation control ${application.controlId} requires an action trigger.` };
  }
  if (application.controlId === 'teleport-free-space') {
    return resolveAttempt(application, TELEPORTATION_LEGAL_DESTINATION);
  }
  if (application.controlId === 'teleport-occupied-space') {
    return resolveAttempt(application, TELEPORTATION_OCCUPIED_DESTINATION);
  }

  return { logMessage: `Unknown Teleportation & Occupied Spaces control: ${application.controlId}.` };
}

const teleportationOccupiedSpacesScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'teleportation_occupied_spaces',
  controls: [
    {
      id: 'teleport-free-space',
      label: 'Misty Step · free space',
      description: 'Teleport the complete Large footprint across mud and a low barrier; pay Bonus Action and level-2 slot without movement or reactions.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'teleport-occupied-space',
      label: 'Misty Step · occupied 2×2',
      description: 'Try a landing whose anchor is open but whose far footprint square overlaps the Space Warden.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: INVALID_DESTINATION_CONTROL_ID,
      label: 'Invalid destination',
      description: 'Reject a blocked footprint, board-edge overflow, hidden space, or destination beyond 30 feet before any cost.',
      kind: 'select',
      defaultValue: 'blocked',
      options: [
        { value: 'blocked', label: 'Blocked far footprint' },
        { value: 'out_of_bounds', label: 'Outside board edge' },
        { value: 'hidden', label: 'Hidden behind wall' },
        { value: 'out_of_range', label: 'Beyond 30-foot range' },
      ],
    },
  ],
  applyControl,
};

export default teleportationOccupiedSpacesScenarioControls;
