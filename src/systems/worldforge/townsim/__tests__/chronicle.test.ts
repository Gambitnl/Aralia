import { summarizeChronicle } from '../chronicle';
import { villagerDiary } from '../townSim';
import type { TownSimState, LifeEvent } from '../types';
import { DAYS_PER_YEAR } from '../constants';

function ev(p: Partial<LifeEvent> & { id: number; kind: LifeEvent['kind'] }): LifeEvent {
  return { day: 0, subjectId: 1, relatedIds: [], summary: '', ...p };
}

function stateWith(events: LifeEvent[]): TownSimState {
  return {
    burgId: 1,
    villagers: {},
    chronicle: { burgId: 1, events, nextEventId: events.length + 1 },
    lastSimDay: events.reduce((m, e) => Math.max(m, e.day), 0),
    nextVillagerId: 100,
  };
}

describe('summarizeChronicle', () => {
  it('groups by year with named headlines and aggregate counts', () => {
    const s = stateWith([
      ev({ id: 1, kind: 'death', day: 10, subjectId: 1, summary: 'Bedwyr died at age 81.' }),
      ev({ id: 2, kind: 'role_succession', day: 10, subjectId: 2, relatedIds: [1], summary: 'Mara succeeded Bedwyr as innkeeper.' }),
      ev({ id: 3, kind: 'birth', day: 40, subjectId: 50, relatedIds: [3, 4], summary: 'Ada was born to A and B.' }),
      ev({ id: 4, kind: 'birth', day: 200, subjectId: 51, relatedIds: [3, 4], summary: 'Bryn was born to A and B.' }),
      ev({ id: 5, kind: 'came_of_age', day: 300, subjectId: 9, summary: 'Cael came of age.' }),
    ]);
    const lines = summarizeChronicle(s);
    expect(lines.length).toBe(1); // all within year 0
    expect(lines[0]).toContain('Year 0');
    expect(lines[0]).toContain('Bedwyr died');
    expect(lines[0]).toContain('succeeded');
    expect(lines[0]).toContain('2 births');
    expect(lines[0]).toContain('1 came of age');
  });

  it('separates events into distinct year lines', () => {
    const s = stateWith([
      ev({ id: 1, kind: 'birth', day: 5, subjectId: 50, summary: 'x' }),
      ev({ id: 2, kind: 'death', day: DAYS_PER_YEAR * 2 + 3, subjectId: 1, summary: 'Old one died.' }),
    ]);
    const lines = summarizeChronicle(s);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('Year 0');
    expect(lines[1]).toContain('Year 2');
  });

  it('respects a day range filter', () => {
    const s = stateWith([
      ev({ id: 1, kind: 'birth', day: 5, subjectId: 50, summary: 'x' }),
      ev({ id: 2, kind: 'birth', day: DAYS_PER_YEAR * 5, subjectId: 51, summary: 'y' }),
    ]);
    const lines = summarizeChronicle(s, { fromDay: DAYS_PER_YEAR * 4 });
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('Year 5');
  });
});

describe('villagerDiary', () => {
  it('returns events where the villager is subject or related', () => {
    const s = stateWith([
      ev({ id: 1, kind: 'death', day: 1, subjectId: 7, summary: 'a' }),
      ev({ id: 2, kind: 'role_succession', day: 1, subjectId: 8, relatedIds: [7], summary: 'b' }),
      ev({ id: 3, kind: 'birth', day: 2, subjectId: 9, relatedIds: [1, 2], summary: 'c' }),
    ]);
    const diary = villagerDiary(s, 7);
    expect(diary.map((e) => e.id).sort()).toEqual([1, 2]);
  });
});
