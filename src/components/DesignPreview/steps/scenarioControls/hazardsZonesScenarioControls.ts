/**
 * This file owns the interactive proof inputs for the Hazards & Zones Tactical Sandbox.
 *
 * It authors one real Burning Ground ActiveSpellZone and prepares deterministic
 * combatants around its boundary. Action buttons hand stable Move or End Turn
 * requests to the mounted turn manager, so movement payment, saves, defenses,
 * conditions, hit points, downing, logs, and replay receipts remain production-owned.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the shared scenario-control contract and production spell-zone types.
 */

import type { BattleMapData, CombatCharacter } from '../../../../types/combat';
import type { SpellEffect } from '../../../../types/spells';
import type { ActiveSpellZone } from '../../../../systems/spells/effects';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Authored Facts
// ============================================================================
// The map's x=6..10, y=3..7 square and this 25-foot cube are the same footprint.
// Stable source and movement ids let tests and humans distinguish a first
// delivery from a replay without inventing a second combat-event ledger.
// ============================================================================

const HAZARD_ZONE_ID = 'hazards-zones-burning-ground';
const HAZARD_SPELL_ID = 'sandbox-burning-ground';
const HAZARD_CASTER_ID = 'hazards_zones-tester';
const HAZARD_TARGET_ID = 'hazards_zones-target';
const HAZARD_EVENT_ID = 'cs13-hazard-trigger-event-001';
const HAZARD_ORIGIN = { x: 6, y: 3 } as const;
// Ruling Q4 (2026-09-22, face anchor): the zone point of origin is the center
// of the near (west) face of the painted 5 x 5 footprint. The caster stands at
// (3,5), west of it, thus the cube extends east over x 6..10, y 3..7, which is
// the same footprint as HAZARD_TILE_IDS.
const HAZARD_CUBE_ORIGIN = { x: 6, y: 5 } as const;
const HAZARD_SIDE_FEET = 25;
const HAZARD_DURATION_ROUNDS = 3;
const HAZARD_EXPIRES_AT_ROUND = 4;
const HAZARD_TILE_COST_FEET = 10;
const ORDINARY_TILE_COST_FEET = 5;

type HazardTriggerPhase = 'enter' | 'start' | 'end' | 'leave';
type HazardSaveOutcome = 'fail' | 'succeed';
type HazardDefense = 'none' | 'resistance' | 'immunity' | 'temporary_hp' | 'downing';

interface HazardChoices {
  active: boolean;
  phase: HazardTriggerPhase;
  saveOutcome: HazardSaveOutcome;
  defense: HazardDefense;
}

const HAZARD_TILE_IDS = Array.from(
  { length: HAZARD_SIDE_FEET / ORDINARY_TILE_COST_FEET },
  (_, xOffset) => Array.from(
    { length: HAZARD_SIDE_FEET / ORDINARY_TILE_COST_FEET },
    (_, yOffset) => `${HAZARD_ORIGIN.x + xOffset}-${HAZARD_ORIGIN.y + yOffset}`,
  ),
).flat();

// ============================================================================
// Control Choice Reading
// ============================================================================
// Scenario setup does not supply the complete value record during its first
// default pass. These fallbacks therefore mirror the declarations below, while
// live interactions read the host's complete next-value snapshot.
// ============================================================================

function readChoices(
  application: PreviewCombatScenarioControlApplication,
): HazardChoices {
  const values = application.snapshot.controlValues ?? {};
  const phaseValue = String(values['trigger-phase'] ?? 'enter');
  const saveValue = String(values['save-outcome'] ?? 'fail');
  const defenseValue = String(values.defenses ?? 'none');

  return {
    active: values['hazard-zone-active'] !== false,
    phase: ['enter', 'start', 'end', 'leave'].includes(phaseValue)
      ? phaseValue as HazardTriggerPhase
      : 'enter',
    saveOutcome: saveValue === 'succeed' ? 'succeed' : 'fail',
    defense: ['resistance', 'immunity', 'temporary_hp', 'downing'].includes(defenseValue)
      ? defenseValue as HazardDefense
      : 'none',
  };
}

// ============================================================================
// Production Spell-Zone Construction
// ============================================================================
// Every rebuild creates fresh frequency sets. Reset Board therefore begins a
// new event namespace, while repeated delivery within one encounter remains
// constrained by both the stable Move id and first-per-turn zone frequency.
// ============================================================================

function triggerTypeForPhase(phase: HazardTriggerPhase): NonNullable<SpellEffect['trigger']>['type'] {
  // Production spell data authors start timing as `turn_start`; the tracker
  // normalizes its emitted receipt to `on_start_turn_in_area` at the boundary.
  if (phase === 'start') return 'turn_start';
  if (phase === 'end') return 'on_end_turn_in_area';
  if (phase === 'leave') return 'on_exit_area';
  return 'on_enter_area';
}

function createZoneVisualEffect(): SpellEffect {
  return {
    type: 'TERRAIN',
    terrainType: 'damaging',
    areaOfEffect: { shape: 'Cube', size: HAZARD_SIDE_FEET },
    duration: { type: 'rounds', value: HAZARD_DURATION_ROUNDS },
    damage: { dice: '1d1', type: 'fire' },
    trigger: { type: 'immediate' },
    condition: { type: 'always' },
    description: 'Sandbox burning-ground visual identity.',
  };
}

function createTriggeredEffects(phase: HazardTriggerPhase): SpellEffect[] {
  const triggerType = triggerTypeForPhase(phase);
  const damage: SpellEffect = {
    type: 'DAMAGE',
    damage: { dice: '1d1', type: 'fire' },
    trigger: { type: triggerType, frequency: 'every_time' },
    condition: { type: 'save', saveType: 'Dexterity', saveEffect: 'half' },
    description: `Sandbox ${phase} burning-ground damage.`,
  };

  // Lingering conditions are boundary-crossing payloads. Turn-phase damage
  // remains a clean defense/downing proof, while enter and leave exercise the
  // movement executor's paired status-condition stores and duration rules.
  if (phase === 'start' || phase === 'end') {
    return [damage];
  }

  const lingeringIgnition: SpellEffect = {
    type: 'STATUS_CONDITION',
    statusCondition: {
      name: 'Ignited',
      duration: { type: 'rounds', value: 1 },
    },
    trigger: { type: triggerType, frequency: 'every_time' },
    condition: { type: 'save', saveType: 'Dexterity', saveEffect: 'negates_condition' },
    description: `Sandbox lingering ignition on ${phase}.`,
  };

  return [damage, lingeringIgnition];
}

function createHazardZone(choices: HazardChoices): ActiveSpellZone {
  return {
    id: HAZARD_ZONE_ID,
    spellId: HAZARD_SPELL_ID,
    casterId: HAZARD_CASTER_ID,
    position: { ...HAZARD_CUBE_ORIGIN },
    areaOfEffect: { shape: 'cube', size: HAZARD_SIDE_FEET },
    // Ruling Q4 (2026-09-22, face anchor): a cube zone extends away from the
    // caster. The caster stands at (3,5), west of the origin (6,5), thus the
    // axis is east. The zone covers x 6..10, y 3..7 (HAZARD_TILE_IDS).
    direction: { x: 1, y: 0 },
    saveDC: choices.saveOutcome === 'succeed' ? 5 : 30,
    effects: [createZoneVisualEffect(), ...createTriggeredEffects(choices.phase)],
    triggeredThisTurn: new Set(),
    triggeredEver: new Set(),
    expiresAtRound: HAZARD_EXPIRES_AT_ROUND,
  };
}

function replaceOwnedZone(
  spellZones: ActiveSpellZone[] | undefined,
  choices: HazardChoices,
): ActiveSpellZone[] {
  const preservedZones = (spellZones ?? []).filter(zone => zone.id !== HAZARD_ZONE_ID);
  return choices.active ? [...preservedZones, createHazardZone(choices)] : preservedZones;
}

// ============================================================================
// Deterministic Combatant Setup
// ============================================================================
// Extreme initiative and Dexterity modifiers remove random branch ambiguity
// without replacing production initiative or saving-throw rolls. The engine
// still rolls and records them; the authored totals simply guarantee the choice.
// ============================================================================

function withoutFire(values: string[] | undefined): string[] {
  return (values ?? []).filter(value => value.toLowerCase() !== 'fire');
}

function prepareCharacters(
  characters: CombatCharacter[],
  choices: HazardChoices,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id !== HAZARD_TARGET_ID && character.id !== HAZARD_CASTER_ID) {
      return character;
    }

    const targetActsFirst = choices.phase !== 'start';
    if (character.id === HAZARD_CASTER_ID) {
      return {
        ...character,
        position: { x: 3, y: 5 },
        stats: {
          ...character.stats,
          baseInitiative: targetActsFirst ? -100 : 100,
        },
      };
    }

    const startsInside = choices.phase === 'leave'
      || choices.phase === 'start'
      || choices.phase === 'end';
    const fireResistances = withoutFire(character.resistances);
    const fireImmunities = withoutFire(character.immunities);
    const conditionImmunities = (character.conditionImmunities ?? [])
      .filter(condition => condition.toLowerCase() !== 'ignited');

    return {
      ...character,
      position: startsInside ? { x: 6, y: 5 } : { x: 5, y: 5 },
      currentHP: choices.defense === 'downing' ? 1 : Math.max(6, character.currentHP),
      tempHP: choices.defense === 'temporary_hp' ? 1 : 0,
      resistances: choices.defense === 'resistance'
        ? [...fireResistances, 'fire']
        : fireResistances,
      immunities: choices.defense === 'immunity'
        ? [...fireImmunities, 'fire']
        : fireImmunities,
      conditionImmunities: choices.defense === 'immunity'
        ? [...conditionImmunities, 'Ignited']
        : conditionImmunities,
      stats: {
        ...character.stats,
        dexterity: choices.saveOutcome === 'succeed' ? 30 : 1,
        baseInitiative: targetActsFirst ? 100 : -100,
      },
    };
  });
}

function createTriggerAction(
  application: PreviewCombatScenarioControlApplication,
  choices: HazardChoices,
) {
  const actorId = choices.phase === 'start' ? HAZARD_CASTER_ID : HAZARD_TARGET_ID;
  const actor = application.snapshot.characters.find(character => character.id === actorId);
  if (!actor) return null;

  // Start and end timing advance through the mounted turn scheduler. Boundary
  // timing, member ownership, resource refresh, and phase logs remain in the
  // same End Turn transaction used by ordinary play.
  if (choices.phase === 'start' || choices.phase === 'end') {
    return {
      id: HAZARD_EVENT_ID,
      characterId: actor.id,
      type: 'end_turn' as const,
      cost: { type: 'free' as const },
      timestamp: 1,
    };
  }

  const destination = choices.phase === 'enter' ? { x: 6, y: 5 } : { x: 5, y: 5 };
  const destinationCost = application.snapshot.mapData?.tiles
    .get(`${destination.x}-${destination.y}`)?.movementCost ?? ORDINARY_TILE_COST_FEET;

  return {
    id: HAZARD_EVENT_ID,
    characterId: actor.id,
    type: 'move' as const,
    targetPosition: destination,
    movementPath: [{ ...actor.position }, destination],
    cost: { type: 'movement-only' as const, movementCost: destinationCost },
    timestamp: 1,
  };
}

// ============================================================================
// Difficult-Terrain Footprint
// ============================================================================
// The map's own terrain and movementCost fields are the only movement-cost
// authority. The control changes exactly the 25 authored cells and leaves every
// surrounding tile reference untouched.
// ============================================================================

function applyDifficultTerrainControl(
  mapData: BattleMapData | null,
  enabled: boolean,
): PreviewCombatScenarioControlPatch {
  if (!mapData) {
    return { logMessage: 'Hazards & Zones terrain setup skipped because no battle map is loaded.' };
  }

  if (HAZARD_TILE_IDS.some(tileId => !mapData.tiles.has(tileId))) {
    return { logMessage: 'Hazards & Zones terrain setup skipped because the 25-tile footprint is incomplete.' };
  }

  const tiles = new Map(mapData.tiles);
  for (const tileId of HAZARD_TILE_IDS) {
    const tile = mapData.tiles.get(tileId)!;
    tiles.set(tileId, {
      ...tile,
      terrain: enabled ? 'difficult' : 'floor',
      movementCost: enabled ? HAZARD_TILE_COST_FEET : ORDINARY_TILE_COST_FEET,
    });
  }

  return {
    mapData: { ...mapData, tiles },
    logMessage: enabled
      ? 'Setup: the 25-tile footprint is difficult terrain.'
      : 'Setup: the 25-tile footprint is ordinary floor.',
  };
}

// ============================================================================
// Shared Contract Application
// ============================================================================
// Setup controls rebuild only authored facts. Action controls return a normal
// combat envelope and an empty adapter log; the engine's own movement, save,
// damage, condition, turn, and downing receipts are the proof surface.
// ============================================================================

function applyHazardsZonesControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { controlId, value, snapshot } = application;
  const choices = readChoices(application);

  if (controlId === 'difficult-terrain') {
    if (typeof value !== 'boolean') {
      return { logMessage: 'Hazards & Zones difficult-terrain setup requires an on/off value.' };
    }
    return applyDifficultTerrainControl(snapshot.mapData, value);
  }

  if (controlId === 'resolve-trigger' || controlId === 'replay-trigger') {
    if (value !== true) return { logMessage: '' };

    // End Turn does not currently carry the movement executor's stable-id
    // receipt. Restrict replay proof to crossing events so redelivery is a true
    // production no-op instead of advancing a second actor's turn.
    if (controlId === 'replay-trigger' && (choices.phase === 'start' || choices.phase === 'end')) {
      return { logMessage: 'Replay setup: choose Enter or Leave to redeliver the stable Move event.' };
    }

    const action = createTriggerAction(application, choices);
    return action
      ? { combatActionExecution: action, logMessage: '' }
      : { logMessage: 'Hazards & Zones trigger rejected because its authored turn owner is unavailable.' };
  }

  if (controlId === 'hazard-zone-active') {
    if (typeof value !== 'boolean') {
      return { logMessage: 'Hazards & Zones source setup requires an on/off value.' };
    }
    const nextChoices = { ...choices, active: value };
    return {
      spellZones: replaceOwnedZone(snapshot.spellZones, nextChoices),
      logMessage: value
        ? 'Setup: Burning Ground is active through the Round 4 exclusive boundary.'
        : 'Setup: Burning Ground source removed; independent lingering conditions keep their own duration.',
    };
  }

  if (controlId === 'trigger-phase') {
    if (!['enter', 'start', 'end', 'leave'].includes(String(value))) {
      return { logMessage: `Hazards & Zones ignored invalid trigger phase ${String(value)}.` };
    }
  } else if (controlId === 'save-outcome') {
    if (!['fail', 'succeed'].includes(String(value))) {
      return { logMessage: `Hazards & Zones ignored invalid save outcome ${String(value)}.` };
    }
  } else if (controlId === 'defenses') {
    if (!['none', 'resistance', 'immunity', 'temporary_hp', 'downing'].includes(String(value))) {
      return { logMessage: `Hazards & Zones ignored invalid defense ${String(value)}.` };
    }
  } else {
    return { logMessage: `Unknown Hazards & Zones scenario control: ${controlId}.` };
  }

  return {
    characters: prepareCharacters(snapshot.characters, choices),
    spellZones: replaceOwnedZone(snapshot.spellZones, choices),
    reinitializeCombat: true,
    logMessage: `Setup: ${choices.phase} trigger, ${choices.saveOutcome} save, ${choices.defense} defense.`,
  };
}

// ============================================================================
// Hazards & Zones Control Module
// ============================================================================
// Reset Board reapplies these defaults and the host then reinitializes combat,
// clearing stable Move receipts and rebuilding fresh zone frequency sets.
// ============================================================================

const hazardsZonesScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'hazards_zones',
  controls: [
    {
      id: 'hazard-zone-active',
      label: 'Hazard source active',
      description: 'Add or remove the real 25-tile Burning Ground source without erasing lingering conditions.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'difficult-terrain',
      label: 'Difficult terrain',
      description: 'Switch the footprint between 10-foot difficult tiles and 5-foot ordinary floor.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: 'trigger-phase',
      label: 'Trigger phase',
      description: 'Choose the authored enter, start-turn, end-turn, or leave boundary.',
      kind: 'select',
      defaultValue: 'enter',
      options: [
        { value: 'enter', label: 'Enter area' },
        { value: 'start', label: 'Start turn in area' },
        { value: 'end', label: 'End turn in area' },
        { value: 'leave', label: 'Leave area' },
      ],
    },
    {
      id: 'save-outcome',
      label: 'Dexterity save',
      description: 'Guarantee a production save success or failure by changing authored DC and Dexterity facts.',
      kind: 'select',
      defaultValue: 'fail',
      options: [
        { value: 'fail', label: 'Fail' },
        { value: 'succeed', label: 'Succeed' },
      ],
    },
    {
      id: 'defenses',
      label: 'Target defenses',
      description: 'Compare normal damage, resistance, immunity, temporary HP absorption, or canonical downing.',
      kind: 'select',
      defaultValue: 'none',
      options: [
        { value: 'none', label: 'None' },
        { value: 'resistance', label: 'Fire resistance' },
        { value: 'immunity', label: 'Fire and Ignited immunity' },
        { value: 'temporary_hp', label: '1 temporary HP' },
        { value: 'downing', label: '1 HP (downing)' },
      ],
    },
    {
      id: 'resolve-trigger',
      label: 'Resolve trigger',
      description: 'Run the authored Move or End Turn through the mounted production transaction.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay-trigger',
      label: 'Replay stable crossing',
      description: 'Redeliver the same Enter or Leave Move id to prove position, movement, HP, conditions, and logs stay once-only.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyHazardsZonesControl,
};

// The registry consumes one default export per scenario. Keeping one public
// module prevents callers from bypassing the shared control transaction.
export default hazardsZonesScenarioControls;
