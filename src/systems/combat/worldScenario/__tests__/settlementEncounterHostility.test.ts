/**
 * This file proves that generated military presence never becomes hostility by
 * itself. Every hostile verdict requires an explicit confrontation trigger and
 * player-state evidence matching the generated settlement or controlling state.
 *
 * Covers: resolveSettlementEncounterHostility and its deterministic lab fixture
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CrimeType, type Crime } from '@/types/crime';
import {
  settlementDefenseForBurg,
  type GroundSettlementDefense,
} from '@/systems/worldforge/bridge/settlementDefense';
import {
  createVisualHarnessWantedWatchInput,
  resolveSettlementEncounterHostility,
  settlementDefenseLocationId,
  worldforgeStateFactionId,
} from '../settlementEncounterHostility';

let legium: GroundSettlementDefense;

beforeAll(() => {
  const defense = settlementDefenseForBurg(42, 14);
  if (!defense) throw new Error('Seed 42 Legium defense fixture is missing.');
  legium = defense;
});

function witnessedAssault(locationId: string, id = 'crime:witnessed-assault'): Crime {
  return {
    id,
    type: CrimeType.Assault,
    locationId,
    timestamp: 0,
    severity: 60,
    witnessed: true,
  };
}

describe('settlement encounter hostility', () => {
  it('withholds combat when relations exist but no confrontation was triggered', () => {
    const verdict = resolveSettlementEncounterHostility(legium, {
      knownCrimes: [witnessedAssault(settlementDefenseLocationId(legium))],
      playerStanding: {
        factionId: worldforgeStateFactionId(legium.stateId),
        publicStanding: -100,
      },
    });

    expect(verdict.verdict).toBe('withhold-combat');
    expect(verdict.trigger.kind).toBe('none');
    expect(verdict.relation.kind).toBe('none');
  });

  it('withholds combat when a wanted confrontation belongs to another atlas cell', () => {
    const verdict = resolveSettlementEncounterHostility(legium, {
      trigger: {
        kind: 'watch-confrontation',
        source: 'player-interaction',
        sourceId: 'talk-to-foreign-watch',
        locationId: 'cell_828',
        summary: 'A different settlement watch attempts an arrest.',
      },
      knownCrimes: [witnessedAssault('cell_828')],
    });

    expect(verdict.verdict).toBe('withhold-combat');
    expect(verdict.relation.kind).toBe('wanted-in-location');
    expect(verdict.detail).toContain('cell_829');
  });

  it('authorizes a watch confrontation only from a matching witnessed local crime', () => {
    const locationId = settlementDefenseLocationId(legium);
    const verdict = resolveSettlementEncounterHostility(legium, {
      trigger: {
        kind: 'watch-confrontation',
        source: 'player-interaction',
        sourceId: 'talk-to-legium-watch',
        locationId,
        summary: 'Legium watch attempts to arrest the wanted party.',
      },
      knownCrimes: [
        { ...witnessedAssault(locationId, 'crime:unseen'), witnessed: false },
        witnessedAssault(locationId, 'crime:legium-assault'),
      ],
    });

    expect(verdict.verdict).toBe('hostile');
    expect(verdict.relation).toMatchObject({
      kind: 'wanted-in-location',
      locationId: 'cell_829',
      witnessedCrimeIds: ['crime:legium-assault'],
    });
  });

  it('requires both the matching generated state and a hostile standing tier', () => {
    const factionId = worldforgeStateFactionId(legium.stateId);
    const trigger = {
      kind: 'state-confrontation' as const,
      source: 'world-event' as const,
      sourceId: 'turino-border-order',
      factionId,
      summary: 'Turino orders the patrol to detain the party.',
    };

    expect(resolveSettlementEncounterHostility(legium, {
      trigger,
      playerStanding: { factionId, publicStanding: -40 },
    })).toMatchObject({
      verdict: 'hostile',
      relation: { kind: 'state-standing', tier: 'HOSTILE', qualifiesAsHostile: true },
    });

    expect(resolveSettlementEncounterHostility(legium, {
      trigger,
      playerStanding: { factionId, publicStanding: -39 },
    })).toMatchObject({
      verdict: 'withhold-combat',
      relation: { kind: 'state-standing', tier: 'UNFRIENDLY', qualifiesAsHostile: false },
    });

    expect(resolveSettlementEncounterHostility(legium, {
      trigger: { ...trigger, factionId: 'worldforge-state:999' },
      playerStanding: { factionId: 'worldforge-state:999', publicStanding: -100 },
    }).verdict).toBe('withhold-combat');
  });

  it('labels the deterministic visual fixture instead of presenting it as world data', () => {
    const input = createVisualHarnessWantedWatchInput(legium, 'visual-harness:test');
    const verdict = resolveSettlementEncounterHostility(legium, input);

    expect(verdict.verdict).toBe('hostile');
    expect(verdict.trigger).toMatchObject({
      source: 'visual-harness',
      sourceId: 'visual-harness:test',
      locationId: 'cell_829',
    });
  });
});
