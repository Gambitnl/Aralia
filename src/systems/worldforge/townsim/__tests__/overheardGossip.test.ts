import { pickOverheardGossip, frameOverheardGossip, type TownNewsItem } from '../townNews';
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

// Kinds that must NEVER surface as public gossip (they belong to crier/boards).
const NON_GOSSIP_KINDS: LifeEvent['kind'][] = ['disaster', 'role_succession', 'marriage', 'economy'];

describe('pickOverheardGossip', () => {
  const currentDay = 1010;

  it('returns the most recent gossip-tier item, never a headline/notice-tier event', () => {
    const town = townWith([
      // headline-tier
      ev({ id: 1, kind: 'disaster', day: 1009, summary: 'A fire swept the town.' }),
      ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
      // notice-tier
      ev({ id: 3, kind: 'marriage', day: 1008, summary: 'A married B.' }),
      ev({ id: 4, kind: 'economy', day: 1007, summary: 'The market boomed.' }),
      // gossip-tier
      ev({ id: 5, kind: 'birth', day: 1005, summary: 'C was born.' }),
      ev({ id: 6, kind: 'festival', day: 1006, summary: 'Harvest festival.' }),
      ev({ id: 7, kind: 'came_of_age', day: 1004, summary: 'D came of age.' }),
      ev({ id: 8, kind: 'courtship', day: 1003, summary: 'E is courting F.' }),
      ev({ id: 9, kind: 'death', day: 1002, summary: 'G passed away.' }),
    ]);

    const first = pickOverheardGossip(town, currentDay);
    expect(first).not.toBeNull();
    expect(first!.kind).toBe('festival'); // most recent gossip-tier item (day 1006)
    expect(NON_GOSSIP_KINDS).not.toContain(first!.kind);
  });

  it('only ever returns gossip-tier kinds across repeated picks', () => {
    const town = townWith([
      ev({ id: 1, kind: 'disaster', day: 1009, summary: 'A fire swept the town.' }),
      ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
      ev({ id: 3, kind: 'marriage', day: 1008, summary: 'A married B.' }),
      ev({ id: 4, kind: 'economy', day: 1007, summary: 'The market boomed.' }),
      ev({ id: 5, kind: 'birth', day: 1005, summary: 'C was born.' }),
      ev({ id: 6, kind: 'festival', day: 1006, summary: 'Harvest festival.' }),
    ]);

    let lastId: number | undefined;
    for (let i = 0; i < 5; i++) {
      const item = pickOverheardGossip(town, currentDay, lastId);
      expect(item).not.toBeNull();
      expect(NON_GOSSIP_KINDS).not.toContain(item!.kind);
      lastId = item!.id;
    }
  });

  it('skips the immediately-previous item to avoid back-to-back repeats', () => {
    const town = townWith([
      ev({ id: 5, kind: 'birth', day: 1005, summary: 'C was born.' }),
      ev({ id: 6, kind: 'festival', day: 1006, summary: 'Harvest festival.' }),
    ]);

    const first = pickOverheardGossip(town, currentDay);
    expect(first).not.toBeNull();
    expect(first!.id).toBe(6); // most recent gossip item

    const second = pickOverheardGossip(town, currentDay, first!.id);
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id); // no immediate repeat
    expect(second!.id).toBe(5);
  });

  it('returns the only gossip item even when it equals lastAnnouncedId', () => {
    const town = townWith([
      ev({ id: 1, kind: 'disaster', day: 1000, summary: 'A fire swept the town.' }),
      ev({ id: 8, kind: 'birth', day: 1008, summary: 'C was born.' }),
    ]);
    const item = pickOverheardGossip(town, currentDay, 8);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(8);
  });

  it('returns null when the town has no gossip-tier events', () => {
    const town = townWith([
      ev({ id: 1, kind: 'disaster', day: 1009, summary: 'A fire swept the town.' }),
      ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
      ev({ id: 3, kind: 'marriage', day: 1008, summary: 'A married B.' }),
      ev({ id: 4, kind: 'economy', day: 1007, summary: 'The market boomed.' }),
    ]);
    expect(pickOverheardGossip(town, currentDay)).toBeNull();
  });
});

describe('frameOverheardGossip', () => {
  const item = (id: number): TownNewsItem => ({ id, day: 1, kind: 'birth', prominence: 'gossip', text: 'Ada was born.' });

  it('always includes the news text and is deterministic per id', () => {
    const a = frameOverheardGossip(item(3));
    expect(a).toContain('Ada was born.');
    expect(frameOverheardGossip(item(3))).toBe(a); // deterministic
  });

  it('varies the framing across different ids', () => {
    const framings = new Set([0, 1, 2, 3, 4].map((id) => frameOverheardGossip(item(id))));
    expect(framings.size).toBeGreaterThan(1);
  });
});
