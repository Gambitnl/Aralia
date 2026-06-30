import { pickCrierHeadline } from '../townNews';
import type { TownSimState, LifeEvent } from '../types';

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

describe('pickCrierHeadline', () => {
  const currentDay = 1010;

  it('returns the most recent headline, then a different (older) one to avoid immediate repeats', () => {
    // disaster + role_succession are headline-tier; birth + festival are not.
    const town = townWith([
      ev({ id: 1, kind: 'disaster', day: 1000, summary: 'A fire swept the town.' }),
      ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
      ev({ id: 3, kind: 'birth', day: 1008, summary: 'C was born.' }),
      ev({ id: 4, kind: 'festival', day: 1009, summary: 'Harvest festival.' }),
    ]);

    const first = pickCrierHeadline(town, currentDay);
    expect(first).not.toBeNull();
    expect(first!.id).toBe(2); // most recent headline

    const second = pickCrierHeadline(town, currentDay, first!.id);
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id); // no immediate repeat
    expect(second!.id).toBe(1); // the older headline
  });

  it('returns null when the town has no headline-tier events', () => {
    const town = townWith([
      ev({ id: 1, kind: 'birth', day: 1008, summary: 'C was born.' }),
      ev({ id: 2, kind: 'festival', day: 1009, summary: 'Harvest festival.' }),
      ev({ id: 3, kind: 'marriage', day: 1005, summary: 'A married B.' }),
    ]);
    expect(pickCrierHeadline(town, currentDay)).toBeNull();
  });

  it('returns the only headline even when it equals lastAnnouncedId', () => {
    const town = townWith([
      ev({ id: 7, kind: 'disaster', day: 1000, summary: 'A fire swept the town.' }),
      ev({ id: 8, kind: 'birth', day: 1008, summary: 'C was born.' }),
    ]);
    const item = pickCrierHeadline(town, currentDay, 7);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(7);
  });
});
