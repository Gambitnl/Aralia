/**
 * NPC lives (2026-11-02): mood and recent life are derived from the chronicle.
 */
import { describe, it, expect } from 'vitest';
import { DAYS_PER_YEAR } from '../constants';
import { GRIEF_DAYS, JOY_DAYS, villagerMood, villagerRecentLife, WORRY_DAYS } from '../villagerMood';
import type { LifeEvent, LivingVillager, TownSimState } from '../types';

function villager(p: Partial<LivingVillager> & { occupantId: number }): LivingVillager {
  return {
    name: `V${p.occupantId}`,
    race: 'Human',
    bornDay: -30 * DAYS_PER_YEAR,
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 50,
    ...p,
  };
}

/** Villager 1 (Tam) is married to 2 (Ana), child of 3 (Old Reed), parent of 4 (Pip). */
function town(events: Omit<LifeEvent, 'id'>[]): TownSimState {
  const vs = [
    villager({ occupantId: 1, name: 'Tam Reed', spouseId: 2, parentIds: [3], childIds: [4] }),
    villager({ occupantId: 2, name: 'Ana Reed', spouseId: 1, childIds: [4] }),
    villager({ occupantId: 3, name: 'Old Reed', childIds: [1], bornDay: -80 * DAYS_PER_YEAR }),
    villager({ occupantId: 4, name: 'Pip Reed', parentIds: [1, 2], bornDay: 900 }),
    villager({ occupantId: 5, name: 'Stranger' }),
  ];
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId: 7,
    villagers,
    chronicle: { burgId: 7, events: events.map((e, i) => ({ ...e, id: i + 1 })), nextEventId: events.length + 1 },
    lastSimDay: 1000,
    nextVillagerId: 6,
  };
}

const ev = (day: number, kind: LifeEvent['kind'], subjectId: number, relatedIds: number[], summary: string) =>
  ({ day, kind, subjectId, relatedIds, summary });

describe('villagerMood', () => {
  it('is content with no recent events', () => {
    expect(villagerMood(town([]), 1, 1000)).toEqual({ mood: 'content', reasons: [] });
  });

  it('grieves a parent death inside the grief window, then returns to content', () => {
    const t = town([ev(990, 'death', 3, [], 'Old Reed died at age 80.')]);
    t.villagers[3].diedDay = 990;
    expect(villagerMood(t, 1, 1000)).toEqual({ mood: 'grieving', reasons: ['Their parent Old Reed died 10 days ago.'] });
    expect(villagerMood(t, 1, 990 + GRIEF_DAYS + 1)?.mood).toBe('content');
    // A stranger does not grieve.
    expect(villagerMood(t, 5, 1000)?.mood).toBe('content');
  });

  it('is joyful after a new child or a marriage, inside the joy window', () => {
    const t = town([ev(990, 'birth', 4, [1, 2], 'Pip Reed was born to Tam Reed and Ana Reed.')]);
    expect(villagerMood(t, 2, 1000)).toEqual({ mood: 'joyful', reasons: ['Their child Pip Reed was born 10 days ago.'] });
    expect(villagerMood(t, 2, 990 + JOY_DAYS + 1)?.mood).toBe('content');
    const wed = town([ev(999, 'marriage', 1, [2], 'Tam Reed married Ana Reed.')]);
    expect(villagerMood(wed, 2, 1000)?.reasons).toEqual(['They married Tam Reed yesterday.']);
  });

  it('worries after hard times, a family shop closing, or a town disaster', () => {
    expect(villagerMood(town([ev(980, 'fortune_fell', 1, [], 'Tam Reed has fallen on hard times.')]), 1, 1000))
      .toEqual({ mood: 'worried', reasons: ['They fell on hard times 20 days ago.'] });
    const fire = town([ev(1000, 'disaster', 0, [], 'A fire swept through the town.')]);
    expect(villagerMood(fire, 5, 1000)).toEqual({ mood: 'worried', reasons: ['A fire swept through the town today.'] });
    expect(villagerMood(fire, 5, 1000 + WORRY_DAYS + 1)?.mood).toBe('content');
    const closed = town([ev(995, 'shop_closed', 3, [1], 'The smithy closed after Old Reed died with no heir to keep it.')]);
    expect(villagerMood(closed, 1, 1000)?.mood).toBe('worried');
  });

  it('turns bitter after repeated losses once grief is no longer fresh', () => {
    const t = town([
      ev(700, 'death', 3, [], 'Old Reed died at age 80.'),
      ev(800, 'fortune_fell', 1, [], 'Tam Reed has fallen on hard times.'),
    ]);
    t.villagers[3].diedDay = 700;
    const mood = villagerMood(t, 1, 1000)!;
    expect(mood.mood).toBe('bitter');
    expect(mood.reasons).toEqual(['They fell on hard times 200 days ago.', 'Their parent Old Reed died 300 days ago.']);
    // Fresh grief wins over bitterness.
    t.chronicle.events.push({ id: 3, day: 990, kind: 'death', subjectId: 2, relatedIds: [], summary: 'Ana Reed died.' });
    t.villagers[2].diedDay = 990;
    expect(villagerMood(t, 1, 1000)?.mood).toBe('grieving');
  });

  it('has no mood for the dead, the unborn or an unknown id', () => {
    const t = town([]);
    t.villagers[3].diedDay = 500;
    expect(villagerMood(t, 3, 1000)).toBeUndefined();
    expect(villagerMood(t, 4, 800)).toBeUndefined();
    expect(villagerMood(t, 99, 1000)).toBeUndefined();
  });

  it('ignores events after the asked day', () => {
    expect(villagerMood(town([ev(1001, 'fortune_fell', 1, [], 'x.')]), 1, 1000)?.mood).toBe('content');
  });
});

describe('villagerRecentLife', () => {
  it('lists own events and kin deaths newest first, capped, without town-wide lines', () => {
    const t = town([
      ev(600, 'marriage', 1, [2], 'Tam Reed married Ana Reed.'),
      ev(900, 'birth', 4, [1, 2], 'Pip Reed was born to Tam Reed and Ana Reed.'),
      ev(950, 'disaster', 0, [], 'A plague struck the town.'),
      ev(970, 'death', 3, [], 'Old Reed died at age 80.'),
      ev(999, 'shop_succession', 1, [3], 'Tam Reed took over the smithy after the death of their parent Old Reed.'),
      ev(999, 'birth', 9, [5, 6], 'Someone else had a child.'),
    ]);
    t.villagers[3].diedDay = 970;
    expect(villagerRecentLife(t, 1, 1000, 3)).toEqual([
      'Yesterday: Tam Reed took over the smithy after the death of their parent Old Reed.',
      '30 days ago: Old Reed died at age 80.',
      '100 days ago: Pip Reed was born to Tam Reed and Ana Reed.',
    ]);
    // The marriage is outside the default 365-day span.
    expect(villagerRecentLife(t, 1, 1000, 10)).toHaveLength(3);
    expect(villagerRecentLife(t, 1, 1000, 10, 500)).toContain('400 days ago: Tam Reed married Ana Reed.');
    expect(villagerRecentLife(t, 3, 1000)).toEqual([]);
  });
});
