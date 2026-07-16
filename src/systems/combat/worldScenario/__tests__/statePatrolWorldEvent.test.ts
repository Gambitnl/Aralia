/**
 * This file proves the generated-state patrol event is deterministic, tied to
 * real settlement/military facts, and safely suppressed by saved receipts.
 *
 * The fixture is intentionally small: these tests audit event policy while the
 * live settlement projection suite covers the expensive WorldForge generation
 * and regiment-to-combat conversion.
 */
import { describe, expect, it } from 'vitest';
import type { PlayerFactionStanding } from '@/types/factions';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import { worldforgeStateFactionId } from '../settlementEncounterHostility';
import {
  findStatePatrolWorldEvent,
  statePatrolWorldEventId,
} from '../statePatrolWorldEvent';

// ============================================================================
// Minimal Source Facts
// ============================================================================

function defense(overrides: Partial<GroundSettlementDefense> = {}): GroundSettlementDefense {
  return {
    burgId: 14,
    burgName: 'Legium',
    sourceCellId: 829,
    stateId: 7,
    stateName: 'Turino',
    stateFullName: 'The Kingdom of Turino',
    stateForm: 'Kingdom',
    stateAlert: 1.1,
    capital: false,
    walled: true,
    citadel: false,
    stationedRegiments: [{
      sourceIndex: 0,
      name: '1st (Legium) Regiment',
      totalTroops: 120,
      sourceCellId: 829,
      sourceAtlasPoint: { x: 1, y: 1 },
      naval: false,
      units: [{ unitType: 'infantry', count: 120 }],
    }],
    ...overrides,
  };
}

function groundWith(defenses: GroundSettlementDefense[]): GroundWorld {
  return {
    towns: defenses.map((candidate, index) => ({
      burgId: candidate.burgId,
      name: candidate.burgName,
      xM: index * 120,
      zM: 0,
      halfM: 40,
    })),
    settlementDefenses: defenses,
  } as GroundWorld;
}

function standing(stateId: number, publicStanding: number): PlayerFactionStanding {
  const factionId = worldforgeStateFactionId(stateId);
  return {
    factionId,
    publicStanding,
    secretStanding: publicStanding,
    rankId: 'enemy',
    favorsOwed: 0,
    renown: 0,
    history: [],
  };
}

function scan(
  ground: GroundWorld,
  playerFactionStandings: Record<string, PlayerFactionStanding>,
  overrides: Partial<Parameters<typeof findStatePatrolWorldEvent>[1]> = {},
) {
  return findStatePatrolWorldEvent(ground, {
    worldSeed: 42,
    gameDay: 12,
    gameTimeMs: 123_456,
    playerGroundMeters: { x: 0, z: 0 },
    playerFactionStandings,
    ...overrides,
  });
}

// ============================================================================
// Event Eligibility And Persistence
// ============================================================================

describe('generated-state patrol world event', () => {
  it('emits one deterministic state confrontation inside a defended hostile settlement', () => {
    const sourceDefense = defense();
    const hostileStanding = standing(sourceDefense.stateId, -55);
    const result = scan(groundWith([sourceDefense]), {
      [hostileStanding.factionId]: hostileStanding,
    });

    expect(result).toMatchObject({
      id: statePatrolWorldEventId(42, sourceDefense, 12),
      trigger: {
        kind: 'state-confrontation',
        source: 'world-event',
        factionId: hostileStanding.factionId,
      },
      receipt: {
        kind: 'state-patrol-interception',
        worldSeed: 42,
        gameDay: 12,
        sourceCellId: 829,
        burgId: 14,
        stateId: 7,
        playerGroundMeters: { x: 0, z: 0 },
      },
    });
  });

  it('withholds the event for neutral standing or a player outside the town envelope', () => {
    const sourceDefense = defense();
    const neutralStanding = standing(sourceDefense.stateId, -20);
    const standings = { [neutralStanding.factionId]: neutralStanding };

    expect(scan(groundWith([sourceDefense]), standings)).toBeNull();
    const hostileStanding = standing(sourceDefense.stateId, -55);
    expect(scan(groundWith([sourceDefense]), {
      [hostileStanding.factionId]: hostileStanding,
    }, {
      playerGroundMeters: { x: 80, z: 0 },
    })).toBeNull();
  });

  it('requires a real stationed land force instead of inventing generic guards', () => {
    const sourceDefense = defense({ stationedRegiments: [] });
    const hostileStanding = standing(sourceDefense.stateId, -55);

    expect(scan(groundWith([sourceDefense]), {
      [hostileStanding.factionId]: hostileStanding,
    })).toBeNull();
  });

  it('suppresses a consumed event for that day but permits a new daily patrol event', () => {
    const sourceDefense = defense();
    const hostileStanding = standing(sourceDefense.stateId, -55);
    const standings = { [hostileStanding.factionId]: hostileStanding };
    const first = scan(groundWith([sourceDefense]), standings)!;

    expect(scan(groundWith([sourceDefense]), standings, {
      receipts: [first.receipt],
    })).toBeNull();
    expect(scan(groundWith([sourceDefense]), standings, {
      gameDay: 13,
      receipts: [first.receipt],
    })?.id).toBe(statePatrolWorldEventId(42, sourceDefense, 13));
  });

  it('chooses the nearest qualifying settlement deterministically when envelopes overlap', () => {
    const firstDefense = defense();
    const secondDefense = defense({
      burgId: 15,
      burgName: 'Nearwatch',
      sourceCellId: 830,
      stateId: 8,
      stationedRegiments: [{
        ...defense().stationedRegiments[0],
        sourceCellId: 830,
        name: 'Nearwatch Regiment',
      }],
    });
    const firstStanding = standing(firstDefense.stateId, -55);
    const secondStanding = standing(secondDefense.stateId, -55);

    const result = scan(groundWith([firstDefense, secondDefense]), {
      [firstStanding.factionId]: firstStanding,
      [secondStanding.factionId]: secondStanding,
    }, {
      playerGroundMeters: { x: 100, z: 0 },
    });

    expect(result?.defense.burgId).toBe(15);
  });
});
