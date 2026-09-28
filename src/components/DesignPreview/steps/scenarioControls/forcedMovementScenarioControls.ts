// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 16:00:58
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic controls for CS09 Forced Movement.
 *
 * It prepares one spell-backed push/pull lane, changes authored distance and
 * collision facts, places a real spell-zone boundary, and requests the normal
 * mounted ability transaction with a stable event id. The production command,
 * action/slot payment, replay gate, Opportunity Attack detector, and hazard
 * trigger helpers remain authoritative; this adapter only authors inputs.
 *
 * Called by: the Tactical Sandbox control registry and PreviewCombatScenarios.
 * Depends on: the shared control contract, combat types, action-economy reset,
 * OpportunityAttackSystem, and canonical spell-zone shapes.
 */

import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../../../types/combat';
import { SpellSchool } from '../../../../types/spells';
import type { MovementEffect, Spell, SpellEffect } from '../../../../types/spells';
import type { ActiveSpellZone } from '../../../../systems/spells/effects';
import { OpportunityAttackSystem } from '../../../../systems/combat/reactions/OpportunityAttackSystem';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlValues,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable CS09 Actors, Events, And Player Choices
// ============================================================================
// These identities survive every selector change and Reset Board. Stable actor
// and event ids let the mounted logs prove one source transaction and one replay
// no-op without conflating a new delivery with a repeated delivery.
// ============================================================================

export const FORCED_MOVEMENT_CASTER_ID = 'forced_movement-tester';
export const FORCED_MOVEMENT_TARGET_ID = 'forced_movement-target';
export const FORCED_MOVEMENT_GUARD_ID = 'forced-movement-boundary-guard';
export const FORCED_MOVEMENT_COLLISION_ID = 'forced-movement-collision-dummy';
export const FORCED_MOVEMENT_ABILITY_ID = 'forced-movement-force-push';
export const FORCED_MOVEMENT_EVENT_ID = 'cs09-forced-movement-event-1';

const CASTER_START = { x: 3, y: 5 } as const;
const TARGET_START = { x: 6, y: 5 } as const;
const GUARD_START = { x: 6, y: 4 } as const;
const OFF_BOARD_CASTER_START = { x: 12, y: 5 } as const;
const OFF_BOARD_TARGET_START = { x: 15, y: 5 } as const;

type ForceDirection = 'push' | 'pull';
type ForceDistance = 5 | 10;
type ObstructionCase = 'clear' | 'blocked' | 'occupied' | 'off_board' | 'invalid_vector';
type HazardBoundary = 'none' | 'entry' | 'exit';

interface ForcedMovementChoices {
  direction: ForceDirection;
  distance: ForceDistance;
  obstruction: ObstructionCase;
  hazardBoundary: HazardBoundary;
}

const DEFAULT_CHOICES: ForcedMovementChoices = {
  direction: 'push',
  distance: 10,
  obstruction: 'clear',
  hazardBoundary: 'none',
};

const FORCE_DIRECTIONS = new Set<ForceDirection>(['push', 'pull']);
const OBSTRUCTION_CASES = new Set<ObstructionCase>([
  'clear',
  'blocked',
  'occupied',
  'off_board',
  'invalid_vector',
]);
const HAZARD_BOUNDARIES = new Set<HazardBoundary>(['none', 'entry', 'exit']);

// ============================================================================
// Canonical Spell And Reaction Fixtures
// ============================================================================
// The force effect is a level-1 Action spell so the mounted transaction exposes
// exactly one Action and one slot payment. The boundary guard owns an ordinary
// melee attack and ready Reaction for the forced-versus-voluntary comparison.
// ============================================================================

function createMovementEffect(
  direction: ForceDirection,
  distance: ForceDistance,
): MovementEffect {
  return {
    type: 'MOVEMENT',
    movementType: direction,
    distance,
    duration: { type: 'instantaneous' },
    forcedMovement: {
      direction: direction === 'push' ? 'away_from_caster' : 'toward_caster',
      maxDistance: `${distance} ft`,
      usesReaction: false,
    },
    trigger: { type: 'immediate', movementType: 'forced' },
    condition: { type: 'always' },
  };
}

function createForceSpell(
  direction: ForceDirection,
  distance: ForceDistance,
): Spell {
  const verb = direction === 'push' ? 'Push' : 'Pull';

  return {
    id: FORCED_MOVEMENT_ABILITY_ID,
    name: `Sandbox Force ${verb}`,
    level: 1,
    school: SpellSchool.Evocation,
    classes: [],
    subClasses: [],
    description: `${verb} one creature the authored ${distance} feet.`,
    castingTime: { value: 1, unit: 'action', combatCost: { type: 'action' } },
    range: { type: 'ranged', distance: 30, distanceUnit: 'feet' },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: {
      type: 'single',
      range: 30,
      rangeUnit: 'feet',
      validTargets: ['creatures'],
      lineOfSight: true,
    },
    effects: [createMovementEffect(direction, distance)],
  };
}

export function createForcedMovementAbility(
  direction: ForceDirection,
  distance: ForceDistance,
): Ability {
  const verb = direction === 'push' ? 'Push' : 'Pull';

  return {
    id: FORCED_MOVEMENT_ABILITY_ID,
    name: `Sandbox Force ${verb}`,
    description: `${verb} the CS09 target ${distance} feet through the canonical spell command.`,
    type: 'spell',
    cost: { type: 'action' },
    targeting: 'single_any',
    range: 6,
    effects: [],
    spell: createForceSpell(direction, distance),
    icon: direction === 'push' ? '>>' : '<<',
  };
}

const BOUNDARY_GUARD_ATTACK: Ability = {
  id: 'forced-movement-boundary-strike',
  name: 'Boundary Strike',
  description: 'A normal five-foot melee attack used only by the OA comparison.',
  type: 'attack',
  cost: { type: 'reaction' },
  targeting: 'single_enemy',
  range: 1,
  attackBonus: 5,
  attackType: 'weapon',
  effects: [{ type: 'damage', value: 4, damageType: 'bludgeoning' }],
};

// ============================================================================
// Choice Reading And Authored Geometry
// ============================================================================
// Every control application merges current selectors with defaults and the new
// value. This keeps Reset Board deterministic even though its default pass does
// not supply a prebuilt control-values object.
// ============================================================================

function readChoices(
  values: PreviewCombatScenarioControlValues | undefined,
  controlId?: string,
  value?: unknown,
): ForcedMovementChoices {
  const merged = { ...(values ?? {}), ...(controlId ? { [controlId]: value } : {}) };
  const directionValue = String(merged['force-direction'] ?? DEFAULT_CHOICES.direction) as ForceDirection;
  const obstructionValue = String(merged['obstruction-case'] ?? DEFAULT_CHOICES.obstruction) as ObstructionCase;
  const hazardValue = String(merged['hazard-boundary'] ?? DEFAULT_CHOICES.hazardBoundary) as HazardBoundary;
  const distanceValue = Number(merged['force-distance'] ?? DEFAULT_CHOICES.distance);

  return {
    direction: FORCE_DIRECTIONS.has(directionValue) ? directionValue : DEFAULT_CHOICES.direction,
    distance: distanceValue === 5 ? 5 : 10,
    obstruction: OBSTRUCTION_CASES.has(obstructionValue) ? obstructionValue : DEFAULT_CHOICES.obstruction,
    hazardBoundary: HAZARD_BOUNDARIES.has(hazardValue) ? hazardValue : DEFAULT_CHOICES.hazardBoundary,
  };
}

function actorStarts(choices: ForcedMovementChoices): {
  caster: Position;
  target: Position;
} {
  if (choices.obstruction === 'off_board') {
    return { caster: OFF_BOARD_CASTER_START, target: OFF_BOARD_TARGET_START };
  }

  if (choices.obstruction === 'invalid_vector') {
    return { caster: TARGET_START, target: TARGET_START };
  }

  return { caster: CASTER_START, target: TARGET_START };
}

function intendedDestination(
  choices: ForcedMovementChoices,
  target: Position,
): Position {
  const tiles = choices.distance / 5;
  return {
    x: target.x + (choices.direction === 'push' ? tiles : -tiles),
    y: target.y,
  };
}

function firstDestination(
  choices: ForcedMovementChoices,
  target: Position,
): Position {
  return {
    x: target.x + (choices.direction === 'push' ? 1 : -1),
    y: target.y,
  };
}

// ============================================================================
// Pure Character, Map, And Hazard Preparation
// ============================================================================
// Selectors rearm only CS09-owned actors and lane facts. Unrelated combatants,
// tiles, and zones remain intact so the shared dirty preview is never rewritten.
// ============================================================================

function prepareCharacters(
  characters: CombatCharacter[],
  choices: ForcedMovementChoices,
): CombatCharacter[] {
  const starts = actorStarts(choices);
  const forceAbility = createForcedMovementAbility(choices.direction, choices.distance);
  const existingTarget = characters.find(character => character.id === FORCED_MOVEMENT_TARGET_ID);
  const withoutFixtures = characters.filter(character => (
    character.id !== FORCED_MOVEMENT_COLLISION_ID
    && character.id !== FORCED_MOVEMENT_GUARD_ID
  ));
  const prepared = withoutFixtures.map(character => {
    if (character.id === FORCED_MOVEMENT_CASTER_ID) {
      const readyCaster = resetEconomy(character);
      return {
        ...readyCaster,
        name: `Force Adept at ${starts.caster.x},${starts.caster.y} - Action ready - L1 1/1`,
        team: 'player' as const,
        position: { ...starts.caster },
        initiative: 20,
        spellSlots: {
          ...readyCaster.spellSlots,
          level_1: { current: 1, max: 1 },
        },
        abilities: [
          ...readyCaster.abilities.filter(ability => ability.id !== FORCED_MOVEMENT_ABILITY_ID),
          forceAbility,
        ],
      };
    }

    if (character.id === FORCED_MOVEMENT_TARGET_ID) {
      const readyTarget = resetEconomy(character);
      return {
        ...readyTarget,
        name: `Forced Target at ${starts.target.x},${starts.target.y} - movement unspent`,
        team: 'player' as const,
        position: { ...starts.target },
        initiative: 10,
        currentHP: 20,
        maxHP: 20,
      };
    }

    return character;
  });

  // Clone a complete combatant for each fixture so the renderer, initiative
  // tracker, and rules helpers receive the same full shape as authored actors.
  const targetTemplate = prepared.find(character => character.id === FORCED_MOVEMENT_TARGET_ID)
    ?? existingTarget;
  if (!targetTemplate) {
    return prepared;
  }

  const guard: CombatCharacter = {
    ...targetTemplate,
    id: FORCED_MOVEMENT_GUARD_ID,
    name: 'Boundary Guard - Reaction ready - forced OA 0 / voluntary OA 1',
    team: 'enemy',
    position: { ...GUARD_START },
    initiative: 5,
    abilities: [BOUNDARY_GUARD_ATTACK],
    statusEffects: [],
    conditions: [],
    actionEconomy: {
      ...targetTemplate.actionEconomy,
      reaction: {
        ...targetTemplate.actionEconomy.reaction,
        used: false,
        remaining: 1,
      },
    },
  };
  const withGuard = [...prepared, guard];

  if (choices.obstruction !== 'occupied') {
    return withGuard;
  }

  const destination = intendedDestination(choices, starts.target);
  const collision: CombatCharacter = {
    ...targetTemplate,
    id: FORCED_MOVEMENT_COLLISION_ID,
    name: `Collision Dummy at ${destination.x},${destination.y}`,
    team: 'neutral',
    position: destination,
    initiative: 0,
    abilities: [],
    statusEffects: [],
    conditions: [],
  };

  return [...withGuard, collision];
}

function prepareMap(
  mapData: BattleMapData | null,
  choices: ForcedMovementChoices,
): BattleMapData | undefined {
  if (!mapData) {
    return undefined;
  }

  const starts = actorStarts(choices);
  const blocked = firstDestination(choices, starts.target);
  const tiles = new Map<string, BattleMapTile>(mapData.tiles);

  // Clear only the horizontal CS09 lane before applying the selected blocker.
  // This removes stale walls from earlier direction choices without touching
  // any fixture outside the scenario-owned row.
  for (let x = 0; x < mapData.dimensions.width; x += 1) {
    const id = `${x}-5`;
    const tile = tiles.get(id);
    if (!tile) continue;
    tiles.set(id, {
      ...tile,
      terrain: 'floor',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
    });
  }

  if (choices.obstruction === 'blocked') {
    const id = `${blocked.x}-${blocked.y}`;
    const tile = tiles.get(id);
    if (tile) {
      tiles.set(id, {
        ...tile,
        terrain: 'wall',
        blocksMovement: true,
        blocksLoS: true,
      });
    }
  }

  return { ...mapData, tiles };
}

function createBoundaryZone(
  choices: ForcedMovementChoices,
  target: Position,
): ActiveSpellZone[] {
  if (choices.hazardBoundary === 'none') {
    return [];
  }

  const position = choices.hazardBoundary === 'entry'
    ? intendedDestination(choices, target)
    : target;
  const boundaryEffect: SpellEffect = {
    type: 'DAMAGE',
    damage: { dice: '1d1', type: 'Force' },
    trigger: {
      type: choices.hazardBoundary === 'entry' ? 'on_enter_area' : 'on_exit_area',
      frequency: 'once_per_creature',
    },
    condition: { type: 'always' },
  } as SpellEffect;

  return [{
    id: `cs09-${choices.hazardBoundary}-hazard`,
    spellId: 'cs09-boundary-hazard',
    casterId: FORCED_MOVEMENT_CASTER_ID,
    position,
    areaOfEffect: { shape: 'cube', size: 5 },
    // A cube zone needs a direction (ruling Q4, 2026-09-22, face anchor). This
    // cube is one tile, thus the direction does not change the covered tile.
    direction: { x: 1, y: 0 },
    effects: [boundaryEffect],
    triggeredThisTurn: new Set(),
    triggeredEver: new Set(),
  }];
}

function prepareBoard(
  application: PreviewCombatScenarioControlApplication,
  choices: ForcedMovementChoices,
): PreviewCombatScenarioControlPatch {
  const starts = actorStarts(choices);
  const obstructionLabel = choices.obstruction.replace('_', ' ');

  return {
    mapData: prepareMap(application.snapshot.mapData, choices),
    characters: prepareCharacters(application.snapshot.characters, choices),
    spellZones: createBoundaryZone(choices, starts.target),
    logMessage: `CS09 prepared ${choices.direction} ${choices.distance} ft; ${obstructionLabel}; hazard ${choices.hazardBoundary}. Source Action/L1 slot and target movement reset exactly.`,
  };
}

// ============================================================================
// Canonical Transaction And OA Comparison Requests
// ============================================================================
// Resolve and Replay return the same stable ability event. useAbilitySystem owns
// the once-only claim, source payment, and MovementCommand execution. The OA
// comparison calls the production detector but deliberately does not fabricate
// a second voluntary movement transaction in this force-effect adapter.
// ============================================================================

function resolveForcedMovement(
  application: PreviewCombatScenarioControlApplication,
  choices: ForcedMovementChoices,
): PreviewCombatScenarioControlPatch {
  const caster = application.snapshot.characters.find(character => character.id === FORCED_MOVEMENT_CASTER_ID);
  const target = application.snapshot.characters.find(character => character.id === FORCED_MOVEMENT_TARGET_ID);
  const guard = application.snapshot.characters.find(character => character.id === FORCED_MOVEMENT_GUARD_ID);

  if (!caster || !target || !guard) {
    return { logMessage: 'CS09 resolve rejected atomically: caster, target, or Boundary Guard is missing.' };
  }

  const destination = intendedDestination(choices, target.position);
  const forcedWindows = new OpportunityAttackSystem().checkOpportunityAttacks(
    target,
    target.position,
    destination,
    [guard],
    application.snapshot.mapData,
    { movementKind: 'forced' },
  );

  return {
    abilityExecution: {
      ability: createForcedMovementAbility(choices.direction, choices.distance),
      casterId: caster.id,
      targetId: target.id,
      executionEventId: FORCED_MOVEMENT_EVENT_ID,
      executionDecision: 'accept',
    },
    logMessage: `CS09 delivers ${FORCED_MOVEMENT_EVENT_ID}: forced Opportunity Attack windows ${forcedWindows.length}; source payment and position resolve in the normal ability transaction.`,
  };
}

function compareVoluntaryOpportunityAttack(
  application: PreviewCombatScenarioControlApplication,
  choices: ForcedMovementChoices,
): PreviewCombatScenarioControlPatch {
  const target = application.snapshot.characters.find(character => character.id === FORCED_MOVEMENT_TARGET_ID);
  const guard = application.snapshot.characters.find(character => character.id === FORCED_MOVEMENT_GUARD_ID);

  if (!target || !guard) {
    return { logMessage: 'CS09 voluntary comparison rejected: target or Boundary Guard is missing.' };
  }

  const destination = intendedDestination(choices, target.position);
  const voluntaryWindows = new OpportunityAttackSystem().checkOpportunityAttacks(
    target,
    target.position,
    destination,
    [guard],
    application.snapshot.mapData,
    { movementKind: 'voluntary' },
  );

  return {
    logMessage: `Voluntary comparison over ${target.position.x},${target.position.y} -> ${destination.x},${destination.y}: Opportunity Attack windows ${voluntaryWindows.length}. Comparison spends no movement or Reaction.`,
  };
}

// ============================================================================
// Control Dispatch And Registry Export
// ============================================================================
// Selectors always rearm their authored facts. Resolve uses one stable delivery;
// Replay repeats that delivery; the shared Reset Board reapplies every default
// and clears the hook's processed-event epoch for an exact fresh fixture.
// ============================================================================

function applyForcedMovementControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const choices = readChoices(
    application.snapshot.controlValues,
    application.controlId,
    application.value,
  );

  if (
    application.controlId === 'force-direction'
    || application.controlId === 'force-distance'
    || application.controlId === 'obstruction-case'
    || application.controlId === 'hazard-boundary'
  ) {
    return prepareBoard(application, choices);
  }

  if (application.controlId === 'resolve-force') {
    return application.value === true
      ? resolveForcedMovement(application, choices)
      : { logMessage: '' };
  }

  if (application.controlId === 'voluntary-oa-comparison') {
    return application.value === true
      ? compareVoluntaryOpportunityAttack(application, choices)
      : { logMessage: '' };
  }

  if (application.controlId === 'replay-force-event') {
    return application.value === true
      ? resolveForcedMovement(application, choices)
      : { logMessage: '' };
  }

  return { logMessage: `CS09 ignored unknown control ${application.controlId}.` };
}

const forcedMovementScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'forced_movement',
  controls: [
    {
      id: 'force-direction',
      label: 'Forced direction',
      description: 'Switch the real movement effect between away-from-source push and toward-source pull.',
      kind: 'select',
      defaultValue: 'push',
      options: [
        { value: 'push', label: 'Push away' },
        { value: 'pull', label: 'Pull toward' },
      ],
    },
    {
      id: 'force-distance',
      label: 'Authored distance',
      description: 'Request exactly one or two five-foot squares without spending target movement.',
      kind: 'select',
      defaultValue: '10',
      options: [
        { value: '5', label: '5 feet' },
        { value: '10', label: '10 feet' },
      ],
    },
    {
      id: 'obstruction-case',
      label: 'Destination case',
      description: 'Choose clear, wall, occupied, map-edge, or invalid-vector resolution.',
      kind: 'select',
      defaultValue: 'clear',
      options: [
        { value: 'clear', label: 'Clear full path' },
        { value: 'blocked', label: 'Wall blocks first square' },
        { value: 'occupied', label: 'Occupied final square' },
        { value: 'off_board', label: 'Push crosses map edge' },
        { value: 'invalid_vector', label: 'Source overlaps target' },
      ],
    },
    {
      id: 'hazard-boundary',
      label: 'Hazard boundary',
      description: 'Place an authored once-per-creature spell-zone entry or exit on the accepted path.',
      kind: 'select',
      defaultValue: 'none',
      options: [
        { value: 'none', label: 'No boundary hazard' },
        { value: 'entry', label: 'Enter 1 Force hazard' },
        { value: 'exit', label: 'Exit 1 Force hazard' },
      ],
    },
    {
      id: 'resolve-force',
      label: 'Resolve forced movement',
      description: 'Spend the source Action and level-1 slot once, then run the canonical push/pull command.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'voluntary-oa-comparison',
      label: 'Compare voluntary OA',
      description: 'Ask the production OA detector about the same boundary as voluntary movement; no state is spent.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay-force-event',
      label: 'Replay stable force event',
      description: 'Redeliver the same event id; the mounted ability gate must make it a complete no-op.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyForcedMovementControl,
};

export default forcedMovementScenarioControls;
