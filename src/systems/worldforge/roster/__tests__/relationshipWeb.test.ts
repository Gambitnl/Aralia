/**
 * Proves the NPC relationship web: it generates deterministically from existing
 * roster/household data, every edge is a legal typed tie, the player's actions
 * propagate along it with the right SIGN (a victim's friends turn, a victim's
 * rival warms), and the gossip/quest/combat consumers actually read it.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_DEGREE,
  RELATIONSHIP_STRENGTH_MAX,
  RELATIONSHIP_STRENGTH_MIN,
  adjustEdge,
  applyPlayerAction,
  buildTownRelationshipWeb,
  describeEdge,
  edgesFor,
  gossipSpreadFrom,
  otherEnd,
  questOfferDisposition,
  standingOf,
  willAssistInCombat,
  type RelationshipEdgeType,
  type TownRelationshipWeb,
} from '../relationshipWeb';
import { rootSeedPath } from '../../seedPath';
import type { Occupant, TownRoster } from '../types';

const SEED = rootSeedPath(42);

const occ = (
  id: number,
  ageBand: Occupant['ageBand'],
  homePlotId: number,
  over: Partial<Occupant> = {},
): Occupant => ({ id, name: `P${id}`, ageBand, homePlotId, occupation: 'resident', ...over });

/** A small town: three households, a market and a workshop trade pair. */
const smallTown = (): TownRoster => ({
  burgId: 7,
  occupants: [
    // Household A: couple + two children.
    occ(1, 'adult', 10),
    occ(2, 'adult', 10),
    occ(3, 'child', 10),
    occ(4, 'child', 10),
    // Household B: couple, one of them keeps the market stall.
    occ(5, 'adult', 11, { occupation: 'shopkeeper', workPlotId: 50 }),
    occ(6, 'adult', 11),
    // Household C: an elder and an unrelated lodger who both work trades.
    occ(7, 'elder', 12, { occupation: 'artisan', workPlotId: 51 }),
    occ(8, 'adult', 12, { occupation: 'shopkeeper', workPlotId: 52 }),
  ],
});

const EDGE_TYPES: RelationshipEdgeType[] = ['family', 'friend', 'rival', 'employer', 'romantic'];

describe('buildTownRelationshipWeb', () => {
  it('is deterministic for the same roster and seed', () => {
    const a = buildTownRelationshipWeb(smallTown(), SEED);
    const b = buildTownRelationshipWeb(smallTown(), SEED);
    expect(a).toEqual(b);
    // A different seed produces a different town's social texture.
    const c = buildTownRelationshipWeb(smallTown(), rootSeedPath(43));
    expect(c.edges).not.toEqual(a.edges);
  });

  it('emits only legal typed edges inside the strength band', () => {
    const web = buildTownRelationshipWeb(smallTown(), SEED);
    expect(web.edges.length).toBeGreaterThan(0);
    for (const edge of web.edges) {
      expect(EDGE_TYPES).toContain(edge.type);
      expect(edge.strength).toBeGreaterThanOrEqual(RELATIONSHIP_STRENGTH_MIN);
      expect(edge.strength).toBeLessThanOrEqual(RELATIONSHIP_STRENGTH_MAX);
      expect(Number.isInteger(edge.strength)).toBe(true);
      expect(edge.label.length).toBeGreaterThan(0);
      expect(edge.fromId).not.toBe(edge.toId);
    }
    // No pair is stored twice in either direction.
    const keys = web.edges.map((e) => (e.fromId < e.toId ? `${e.fromId}:${e.toId}` : `${e.toId}:${e.fromId}`));
    expect(new Set(keys).size).toBe(keys.length);
    // Fresh web: nobody has an opinion of the player and nobody is dead.
    expect(web.standing).toEqual({});
    expect(web.deceased).toEqual([]);
    expect(web.burgId).toBe(7);
  });

  it('derives family and romantic ties from the household data', () => {
    const web = buildTownRelationshipWeb(smallTown(), SEED);
    // Household A's two adults marry and their children hang off them.
    expect(web.edges.some((e) => e.type === 'romantic')).toBe(true);
    const parentChild = web.edges.filter((e) => e.type === 'family' && e.label === 'parent and child');
    expect(parentChild.length).toBeGreaterThanOrEqual(2);
    for (const edge of parentChild) {
      expect([3, 4]).toContain(edge.toId);
      expect([1, 2]).toContain(edge.fromId);
    }
  });

  it('makes same-trade workers in different shops into rivals', () => {
    // Occupants 5 and 8 are both shopkeepers at different work plots.
    const web = buildTownRelationshipWeb(smallTown(), rootSeedPath(1));
    const rivalry = web.edges.find((e) => e.type === 'rival' && e.label === 'tradesman rivalry');
    expect(rivalry).toBeDefined();
    expect(rivalry!.strength).toBeLessThan(0);
    expect([rivalry!.fromId, rivalry!.toId].sort()).toEqual([5, 8]);
  });

  it('respects the degree cap on a dense roster', () => {
    // 24 adults in one house would be a complete graph without the cap.
    const crowd: TownRoster = {
      burgId: 1,
      occupants: Array.from({ length: 24 }, (_, i) => occ(i + 1, 'adult', 10)),
    };
    const web = buildTownRelationshipWeb(crowd, SEED);
    for (const person of crowd.occupants) {
      expect(edgesFor(web, person.id).length).toBeLessThanOrEqual(MAX_DEGREE);
    }
    const tight = buildTownRelationshipWeb(crowd, SEED, { maxDegree: 2 });
    for (const person of crowd.occupants) {
      expect(edgesFor(web, person.id).length).toBeGreaterThanOrEqual(edgesFor(tight, person.id).length);
      expect(edgesFor(tight, person.id).length).toBeLessThanOrEqual(2);
    }
  });
});

// A hand-built web keeps the propagation assertions independent of generator rolls.
const handWeb = (): TownRelationshipWeb => ({
  burgId: 1,
  edges: [
    { fromId: 1, toId: 2, type: 'friend', strength: 80, label: 'old war buddy' },
    { fromId: 1, toId: 3, type: 'rival', strength: -70, label: 'tradesman rivalry' },
    { fromId: 2, toId: 4, type: 'family', strength: 50, label: 'sibling' },
    { fromId: 5, toId: 6, type: 'employer', strength: 30, label: 'employs at the workshop' },
  ],
  standing: {},
  deceased: [],
});

describe('applyPlayerAction', () => {
  it('shifts the victim, sours their friend, and pleases their rival', () => {
    const before = handWeb();
    const after = applyPlayerAction(before, { targetId: 1, kind: 'killed' });

    expect(standingOf(after, 1)).toBe(-80); // the victim themselves
    expect(standingOf(after, 2)).toBeLessThan(0); // devoted friend turns on you
    expect(standingOf(after, 3)).toBeGreaterThan(0); // the rival is quietly pleased
    expect(standingOf(after, 4)).toBeLessThan(0); // the friend's sibling hears at 2 hops
    expect(Math.abs(standingOf(after, 4))).toBeLessThan(Math.abs(standingOf(after, 2)));
    expect(standingOf(after, 5)).toBe(0); // unconnected: no opinion

    expect(after.deceased).toEqual([1]);
    // Pure: the input web is untouched.
    expect(before).toEqual(handWeb());
  });

  it('carries a good deed the same way and clamps to the legal band', () => {
    const helped = applyPlayerAction(handWeb(), { targetId: 1, kind: 'saved' });
    expect(standingOf(helped, 1)).toBe(45);
    expect(standingOf(helped, 2)).toBeGreaterThan(0);
    expect(standingOf(helped, 3)).toBeLessThan(0); // the rival resents it
    expect(helped.deceased).toEqual([]);

    let piled = handWeb();
    for (let i = 0; i < 10; i++) piled = applyPlayerAction(piled, { targetId: 1, kind: 'saved', magnitude: 3 });
    expect(standingOf(piled, 1)).toBe(RELATIONSHIP_STRENGTH_MAX);
  });

  it('honours the hop limit', () => {
    const direct = applyPlayerAction(handWeb(), { targetId: 1, kind: 'robbed', hops: 0 });
    expect(standingOf(direct, 1)).toBe(-35);
    expect(standingOf(direct, 2)).toBe(0);
    const oneHop = applyPlayerAction(handWeb(), { targetId: 1, kind: 'robbed', hops: 1 });
    expect(standingOf(oneHop, 2)).toBeLessThan(0);
    expect(standingOf(oneHop, 4)).toBe(0);
  });
});

describe('adjustEdge', () => {
  it('shifts an existing tie and no-ops on a missing one', () => {
    const web = handWeb();
    const soured = adjustEdge(web, 2, 1, -200, 'a friendship broken');
    const edge = soured.edges.find((e) => e.fromId === 1 && e.toId === 2)!;
    expect(edge.strength).toBe(RELATIONSHIP_STRENGTH_MIN);
    expect(edge.label).toBe('a friendship broken');
    expect(web.edges[0].strength).toBe(80); // input untouched
    expect(adjustEdge(web, 1, 99, 10)).toBe(web); // no such edge
  });
});

describe('gossip, quests, and combat read the web', () => {
  it('spreads news along warm ties only, and never through the dead', () => {
    const web = handWeb();
    const hearers = gossipSpreadFrom(web, 1);
    const ids = hearers.map((h) => h.occupantId);
    expect(ids).toContain(2); // warm friend hears it first-hand
    expect(ids).toContain(4); // and repeats it to their sibling
    expect(ids).not.toContain(3); // the rivalry is too cold to talk over
    const first = hearers.find((h) => h.occupantId === 2)!;
    const second = hearers.find((h) => h.occupantId === 4)!;
    expect(first.hops).toBe(1);
    expect(second.hops).toBe(2);
    expect(second.fidelity).toBeLessThan(first.fidelity); // garbled in the retelling
    expect(otherEnd(first.via, 2)).toBe(1);

    // Kill the only carrier and the news stops with them.
    const afterDeath = applyPlayerAction(web, { targetId: 2, kind: 'killed' });
    expect(gossipSpreadFrom(afterDeath, 1).map((h) => h.occupantId)).not.toContain(4);
  });

  it('refuses combat aid from a rival and from someone grieving your kill', () => {
    const killed = applyPlayerAction(handWeb(), { targetId: 1, kind: 'killed' });
    expect(willAssistInCombat(killed, 2).assists).toBe(false);
    expect(willAssistInCombat(killed, 1).reason).toBe('is dead');

    // Even after buying the grieving friend off, the web remembers the death.
    let bribed = killed;
    for (let i = 0; i < 6; i++) bribed = applyPlayerAction(bribed, { targetId: 2, kind: 'saved', hops: 0 });
    expect(standingOf(bribed, 2)).toBeGreaterThan(25);
    const verdict = willAssistInCombat(bribed, 2);
    expect(verdict.assists).toBe(false);
    expect(verdict.reason).toContain('death');

    // An unrelated townsperson the player has helped will stand with them.
    const friendly = applyPlayerAction(handWeb(), { targetId: 5, kind: 'saved', hops: 0 });
    expect(willAssistInCombat(friendly, 5).assists).toBe(true);
    expect(willAssistInCombat(handWeb(), 5).assists).toBe(false); // neutral is not an ally
  });

  it('grades quest offers by standing and by grief', () => {
    const web = handWeb();
    expect(questOfferDisposition(web, 5)).toBe('willing');
    expect(questOfferDisposition(applyPlayerAction(web, { targetId: 5, kind: 'saved', hops: 0 }), 5)).toBe('eager');
    expect(questOfferDisposition(applyPlayerAction(web, { targetId: 5, kind: 'insulted', hops: 0 }), 5)).toBe('reluctant');
    expect(questOfferDisposition(applyPlayerAction(web, { targetId: 5, kind: 'killed', hops: 0 }), 5)).toBe('refuses');
    // The murdered man's friend will not deal with the player at all.
    expect(questOfferDisposition(applyPlayerAction(web, { targetId: 1, kind: 'killed' }), 2)).toBe('refuses');
  });
});

describe('describeEdge', () => {
  it('renders a readable line for the UI', () => {
    const line = describeEdge(handWeb().edges[0], (id) => `Villager ${id}`);
    expect(line).toBe('Villager 1 → Villager 2: friend (old war buddy), close +80');
    expect(describeEdge(handWeb().edges[1], (id) => `V${id}`)).toContain('hostile -70');
  });
});
