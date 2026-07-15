/**
 * These tests prove raw town chronicle entries reach the correct public-news
 * tier. Property changes stay visible to boards without drowning out disasters
 * and institutional succession in the headline channel.
 */
import { selectTownNews } from '../townNews';
import type { TownSimState, LifeEvent } from '../types';
import { DAYS_PER_YEAR } from '../constants';

function ev(p: Partial<LifeEvent> & { id: number; kind: LifeEvent['kind']; day: number }): LifeEvent {
  return { subjectId: 0, relatedIds: [], summary: `event ${p.id}`, ...p };
}

function townWith(events: LifeEvent[]): TownSimState {
  return {
    burgId: 1,
    villagers: {},
    chronicle: { burgId: 1, events, nextEventId: events.length + 1 },
    lastSimDay: events.reduce((m, e) => Math.max(m, e.day), 0),
    nextVillagerId: 1,
  };
}

describe('selectTownNews', () => {
  const town = townWith([
    ev({ id: 1, kind: 'disaster', day: 1000, summary: 'A fire swept the town.' }),
    ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
    ev({ id: 3, kind: 'marriage', day: 1005, summary: 'A married B.' }),
    ev({ id: 4, kind: 'birth', day: 1008, summary: 'C was born.' }),
    ev({ id: 5, kind: 'festival', day: 1009, summary: 'Harvest festival.' }),
    ev({ id: 6, kind: 'building', day: 1007, summary: 'A home was rebuilt.' }),
  ]);
  const currentDay = 1010;

  it('classifies prominence tiers correctly', () => {
    const all = selectTownNews(town, currentDay);
    const byId = new Map(all.map((i) => [i.id, i.prominence]));
    expect(byId.get(1)).toBe('headline'); // disaster
    expect(byId.get(2)).toBe('headline'); // succession
    expect(byId.get(3)).toBe('notice'); // marriage
    expect(byId.get(4)).toBe('gossip'); // birth
    expect(byId.get(5)).toBe('gossip'); // festival
    expect(byId.get(6)).toBe('notice'); // property lifecycle
  });

  it('returns most-recent first', () => {
    const all = selectTownNews(town, currentDay);
    const days = all.map((i) => i.day);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it('filters by minimum prominence (headlines only for a crier)', () => {
    const headlines = selectTownNews(town, currentDay, { minProminence: 'headline' });
    expect(headlines.every((i) => i.prominence === 'headline')).toBe(true);
    expect(headlines.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it('honors max and the recency window', () => {
    expect(selectTownNews(town, currentDay, { max: 2 }).length).toBe(2);
    // an old event outside the 2-year window is excluded
    const withOld = townWith([
      ...town.chronicle.events,
      ev({ id: 9, kind: 'marriage', day: 1010 - 3 * DAYS_PER_YEAR, summary: 'ancient wedding' }),
    ]);
    expect(selectTownNews(withOld, currentDay).some((i) => i.id === 9)).toBe(false);
  });
});
