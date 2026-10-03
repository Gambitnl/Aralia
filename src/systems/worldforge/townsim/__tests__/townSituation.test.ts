/**
 * @file townSituation.test.ts — Pure transaction proof for One Unbroken Day.
 *
 * These tests protect the causal contract: derive from the latest real concern,
 * append exactly one immutable outcome, apply visible resources together, and
 * fail closed when a choice is stale, replayed, or unaffordable.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveTownSituation,
  resolveTownSituation,
  townSituationKey,
} from '../townSituation';
import { DAYS_PER_YEAR } from '../constants';
import type { LifeEvent, TownSimState } from '../types';

function concern(id: number, day: number, summary = 'A fire damaged the granary.'): LifeEvent {
  return {
    id,
    day,
    kind: 'disaster',
    subjectId: 0,
    relatedIds: [],
    summary,
  };
}

function townWith(events: LifeEvent[]): TownSimState {
  return {
    burgId: 7,
    villagers: {},
    chronicle: { burgId: 7, events, nextEventId: 20 },
    prosperity: 50,
    lastSimDay: 12,
    nextVillagerId: 1,
  };
}

describe('deriveTownSituation', () => {
  it('uses the newest civic concern and ignores later gossip', () => {
    const town = townWith([
      concern(4, 10),
      { ...concern(5, 11, 'The market recovered.'), kind: 'economy' },
      { ...concern(6, 12, 'A child was born.'), kind: 'birth' },
    ]);

    expect(deriveTownSituation(town, 12)).toMatchObject({
      key: townSituationKey(7, 5),
      sourceEventId: 5,
      sourceText: 'The market recovered.',
      resolved: false,
    });
  });

  it('does not turn an event outside the shared news window into a current choice', () => {
    const eventDay = 12;
    const town = townWith([concern(9, eventDay)]);

    expect(deriveTownSituation(town, eventDay + 2 * DAYS_PER_YEAR + 1)).toBeNull();
  });
});
describe('resolveTownSituation', () => {
  it('appends one immutable response and applies purse and prosperity together', () => {
    const town = townWith([concern(9, 12)]);
    const result = resolveTownSituation(town, {
      sourceEventId: 9,
      resolutionId: 'fund_response',
      currentDay: 13,
      currentGold: 40,
      actorName: 'Aria',
    });

    expect(result.status).toBe('resolved');
    expect(result.gold).toBe(15);
    expect(result.town.prosperity).toBe(55);
    expect(result.town).not.toBe(town);
    expect(town.chronicle.events).toHaveLength(1);
    expect(result.town.chronicle.events).toHaveLength(2);
    expect(result.outcome).toMatchObject({
      id: 20,
      day: 13,
      kind: 'player_intervention',
      provenance: {
        sourceKey: townSituationKey(7, 9),
        sourceEventId: 9,
        resolutionId: 'fund_response',
        actorName: 'Aria',
      },
    });

    // The chronicle receipt uses plain save-compatible data. A JSON round-trip
    // must still derive the same resolved situation on reload.
    const restored = JSON.parse(JSON.stringify(result.town)) as TownSimState;
    expect(deriveTownSituation(restored, 13)).toMatchObject({
      sourceEventId: 9,
      resolved: true,
      outcome: { provenance: { resolutionId: 'fund_response' } },
    });
  });

  it('is idempotent when the same source is resolved again', () => {
    const input = {
      sourceEventId: 9,
      resolutionId: 'organize_response' as const,
      currentDay: 13,
      currentGold: 10,
      actorName: 'Aria',
    };
    const first = resolveTownSituation(townWith([concern(9, 12)]), input);
    const replay = resolveTownSituation(first.town, { ...input, currentGold: first.gold });

    expect(replay.status).toBe('already_resolved');
    expect(replay.town).toBe(first.town);
    expect(replay.town.chronicle.events).toHaveLength(2);
    expect(replay.gold).toBe(first.gold);
  });

  it('rejects an unaffordable choice without any partial mutation', () => {
    const town = townWith([concern(9, 12)]);
    const result = resolveTownSituation(town, {
      sourceEventId: 9,
      resolutionId: 'fund_response',
      currentDay: 13,
      currentGold: 10,
      actorName: 'Aria',
    });

    expect(result.status).toBe('insufficient_gold');
    expect(result.town).toBe(town);
    expect(result.gold).toBe(10);
    expect(town.chronicle.events).toHaveLength(1);
  });

  it('rejects a stale source and clamps prosperity at the domain boundary', () => {
    const staleTown = townWith([concern(9, 12)]);
    const stale = resolveTownSituation(staleTown, {
      sourceEventId: 9,
      resolutionId: 'organize_response',
      currentDay: 12 + 2 * DAYS_PER_YEAR + 1,
      currentGold: 10,
      actorName: 'Aria',
    });
    expect(stale.status).toBe('not_found');
    expect(stale.town).toBe(staleTown);

    const prosperousTown = { ...townWith([concern(10, 12)]), prosperity: 99 };
    const prosperous = resolveTownSituation(prosperousTown, {
      sourceEventId: 10,
      resolutionId: 'organize_response',
      currentDay: 13,
      currentGold: 10,
      actorName: 'Aria',
    });
    expect(prosperous.status).toBe('resolved');
    expect(prosperous.town.prosperity).toBe(100);
  });
});
