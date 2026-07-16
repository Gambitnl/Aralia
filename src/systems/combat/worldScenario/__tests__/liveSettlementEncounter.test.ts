/**
 * This file proves that production-style settlement confrontations use live
 * player evidence and real WorldForge defense facts.
 *
 * One generated Legium GroundWorld is shared across the cases so the tests
 * exercise the actual World -> Ground -> Tactical bridge without repeatedly
 * paying its generation cost. The visual-harness hostility fixture is never
 * enabled here; crime and standing records are supplied through the same input
 * contract used by gameplay.
 */
// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { CrimeType, type Crime } from '@/types/crime';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { WorldBattleScenario } from '../worldBattleScenario';
import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import {
  WORLD_BATTLE_SCENARIO_PRESETS,
  createWorldBattleScenarioFromGround,
} from '../worldBattleScenario';
import {
  settlementDefenseLocationId,
  worldforgeStateFactionId,
} from '../settlementEncounterHostility';
import { projectLiveSettlementEncounter } from '../liveSettlementEncounter';

// ============================================================================
// Real Generated Location Fixture
// ============================================================================

let ground: GroundWorld;
let scenario: WorldBattleScenario;

beforeAll(() => {
  const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => (
    candidate.id === 'legium-settlement-edge'
  ))!;
  const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
    centerPx: preset.centerPx,
  });
  ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
    hour: preset.hour ?? 12,
    anchorCellId: preset.entryCellId,
  });
  scenario = createWorldBattleScenarioFromGround(preset, ground);
}, 30_000);

function localCrime(id = 'live-crime'): Crime {
  const defense = ground.settlementDefenses![0];
  return {
    id,
    type: CrimeType.Assault,
    locationId: settlementDefenseLocationId(defense),
    timestamp: 100,
    severity: 60,
    witnessed: true,
  };
}

function playerAnchor(): { x: number; z: number } {
  return scenario.mapData.provenance!.anchorWorldMeters;
}

// ============================================================================
// Live Evidence Projection
// ============================================================================

describe('live settlement encounter projection', () => {
  it('turns a matching witnessed crime into a source-regiment watch interception', () => {
    const crime = localCrime();
    const result = projectLiveSettlementEncounter(ground, scenario.mapData, playerAnchor(), {
      trigger: {
        kind: 'watch-confrontation',
        source: 'player-interaction',
        sourceId: 'talk:legium-watch',
        locationId: crime.locationId,
        summary: 'A live watch NPC recognizes the wanted party.',
      },
      knownCrimes: [crime],
    });

    expect(result.status).toBe('ready');
    expect(result.mapData.encounterContext).toMatchObject({
      kind: 'settlement-watch',
      sourceBurgId: 14,
      sourceConfrontationId: 'talk:legium-watch',
      anchorTile: { x: 40, y: 30 },
      deployment: {
        player: 'current-position',
        enemy: 'watch-interception',
      },
      defendingForce: {
        source: {
          stateName: 'Turino',
          regimentName: '1st (Legium) Regiment',
        },
        projection: {
          hostility: {
            verdict: 'hostile',
            trigger: { source: 'player-interaction' },
            relation: { kind: 'wanted-in-location' },
          },
        },
      },
    });
  });

  it('selects a matching generated-state standing for a state confrontation', () => {
    const defense = ground.settlementDefenses![0];
    const factionId = worldforgeStateFactionId(defense.stateId);
    const result = projectLiveSettlementEncounter(ground, scenario.mapData, playerAnchor(), {
      trigger: {
        kind: 'state-confrontation',
        source: 'world-event',
        sourceId: 'state-patrol:hostile-standing',
        factionId,
        summary: 'A state patrol intercepts a publicly hostile party.',
      },
      playerStanding: { factionId, publicStanding: -55 },
    });

    expect(result.status).toBe('ready');
    expect(result.mapData.encounterContext).toMatchObject({
      kind: 'settlement-state-patrol',
      sourceBurgId: defense.burgId,
      sourceFactionId: factionId,
      sourceConfrontationId: 'state-patrol:hostile-standing',
      deployment: {
        player: 'current-position',
        enemy: 'state-patrol-interception',
      },
    });
    expect(result.defendingForce?.projection.hostility).toMatchObject({
      verdict: 'hostile',
      relation: {
        kind: 'state-standing',
        factionId,
        publicStanding: -55,
        qualifiesAsHostile: true,
      },
    });
  });

  it('retains the source context but withholds actors when local evidence does not match', () => {
    const crime = { ...localCrime('wrong-cell'), locationId: 'cell_1' };
    const expectedLocation = settlementDefenseLocationId(ground.settlementDefenses![0]);
    const result = projectLiveSettlementEncounter(ground, scenario.mapData, playerAnchor(), {
      trigger: {
        kind: 'watch-confrontation',
        source: 'player-interaction',
        sourceId: 'talk:legium-watch',
        locationId: expectedLocation,
        summary: 'A watch confrontation is requested without matching wanted evidence.',
      },
      knownCrimes: [crime],
    });

    expect(result.status).toBe('withheld');
    expect(result.mapData.encounterContext?.kind).toBe('settlement-watch');
    expect(result.defendingForce?.projection.hostility.verdict).toBe('withhold-combat');
  });

  it('distinguishes wilderness from a generated settlement missing its defense bridge', () => {
    const crime = localCrime();
    const input = {
      trigger: {
        kind: 'watch-confrontation' as const,
        source: 'player-interaction' as const,
        sourceId: 'talk:watch',
        locationId: crime.locationId,
        summary: 'A watch confrontation requests a source defense.',
      },
      knownCrimes: [crime],
    };

    expect(projectLiveSettlementEncounter(
      { ...ground, towns: [], settlementDefenses: [] },
      scenario.mapData,
      playerAnchor(),
      input,
    ).status).toBe('not-applicable');
    expect(projectLiveSettlementEncounter(
      { ...ground, settlementDefenses: [] },
      scenario.mapData,
      playerAnchor(),
      input,
    ).status).toBe('source-gap');
  });
});
