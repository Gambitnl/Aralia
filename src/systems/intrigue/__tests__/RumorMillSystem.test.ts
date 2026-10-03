/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/__tests__/RumorMillSystem.test.ts
 * Proof-of-concept coverage for the Town Rumor Mill: generation, the three
 * required spread tests (social-graph spread, proximity fallback, and the
 * 1-3 day dialogue window), decay, and reputation.
 */

import { describe, it, expect } from 'vitest';
import {
  RUMOR_LIFESPAN_DAYS,
  advanceRumors,
  buildProximityGraph,
  buildRumorDialogueContext,
  buildSocialGraphFromBonds,
  generateRumor,
  generateRumors,
  getRumorsForNpc,
  isRumorStale,
  pruneStaleRumors,
  rumorFreshness,
  spreadRumorsOneDay,
  summarizeRumorReputation,
  townRumorToWorldRumor,
  type RumorSocialGraph,
  type TownRumor,
} from '../RumorMillSystem';
import type { AgentRelationshipBond } from '../../worldforge/townsim/types';

/** A small town: a tight core of five, plus one hermit nobody talks to. */
function townBonds(): Record<string, AgentRelationshipBond> {
  const bonds: Record<string, AgentRelationshipBond> = {};
  const core = [1, 2, 3, 4, 5];
  for (let i = 0; i < core.length; i += 1) {
    for (let j = i + 1; j < core.length; j += 1) {
      bonds[`${core[i]}:${core[j]}`] = {
        leftId: core[i],
        rightId: core[j],
        affinity: 70,
        contactDays: 50,
        status: 'friend',
        lastContactDay: 0,
      };
    }
  }
  return bonds;
}

/** Fully connected graph over the given ids at a fixed tie strength. */
function cliqueGraph(ids: string[], strength = 1): RumorSocialGraph {
  const edges: Record<string, Array<{ npcId: string; strength: number }>> = {};
  for (const a of ids) {
    edges[a] = ids.filter((b) => b !== a).map((b) => ({ npcId: b, strength }));
  }
  return { edges };
}

describe('RumorMillSystem - generation', () => {
  it('turns a notable deed into a rumor entry with the required shape', () => {
    const rumor = generateRumor({
      kind: 'combat_victory',
      day: 10,
      sourceNpc: 'npc_barkeep',
      subject: 'Vaelin',
      detail: 'the bandit captain',
    });

    expect(rumor.text).toContain('Vaelin');
    expect(rumor.text).toContain('the bandit captain');
    expect(rumor.sourceNpc).toBe('npc_barkeep');
    expect(rumor.spreadDay).toBe(10);
    // The witness is the first person who knows it.
    expect(rumor.reachedNpcs).toEqual(['npc_barkeep']);
    expect(rumor.tone).toBe('positive');
  });

  it('is deterministic and tones deeds by kind', () => {
    const deed = {
      kind: 'crime' as const,
      day: 3,
      sourceNpc: 'npc_watch',
      subject: 'Vaelin',
      detail: 'the warehouse fire',
    };
    expect(generateRumor(deed)).toEqual(generateRumor(deed));

    const [crime, donation] = generateRumors([
      deed,
      { kind: 'donation', day: 3, sourceNpc: 'npc_priest', subject: 'Vaelin' },
    ]);
    expect(crime.tone).toBe('negative');
    expect(crime.virality).toBeGreaterThan(donation.virality);
    expect(donation.tone).toBe('positive');
    // Batch ids stay distinct even for same-day deeds.
    expect(crime.id).not.toBe(donation.id);
  });

  it('honors an explicit tone and magnitude override', () => {
    const rumor = generateRumor({
      kind: 'combat_victory',
      day: 1,
      sourceNpc: 'npc_a',
      tone: 'negative',
      magnitude: 1,
      detail: 'an unarmed man',
    });
    expect(rumor.tone).toBe('negative');
    expect(rumor.weight).toBe(1);
  });
});

describe('RumorMillSystem - spread (proof of concept)', () => {
  // SPREAD TEST 1: the relationship web carries talk across the whole town,
  // and stops at people with no ties.
  it('spreads through the social graph and never reaches an unconnected NPC', () => {
    const graph = buildSocialGraphFromBonds(townBonds(), { idPrefix: 'npc_' });
    const rumor = generateRumor({
      kind: 'crime',
      day: 0,
      sourceNpc: 'npc_1',
      subject: 'Vaelin',
      detail: 'the warehouse fire',
    });

    const after = advanceRumors([rumor], graph, 1, 3)[0];

    expect(after.reachedNpcs.length).toBeGreaterThan(rumor.reachedNpcs.length);
    // The whole connected core hears it within the 1-3 day window.
    for (const id of ['npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5']) {
      expect(after.reachedNpcs).toContain(id);
    }
    // The hermit has no bond, so no path exists.
    expect(after.reachedNpcs).not.toContain('npc_hermit');
    // Nobody hears it twice.
    expect(new Set(after.reachedNpcs).size).toBe(after.reachedNpcs.length);
  });

  // SPREAD TEST 2: with no relationship web, proximity is the fallback graph,
  // and talk does not jump between towns.
  it('falls back to proximity and does not cross locations', () => {
    const graph = buildProximityGraph(
      [
        { id: 'npc_a', locationId: 'tavern' },
        { id: 'npc_b', locationId: 'tavern' },
        { id: 'npc_c', locationId: 'tavern' },
        { id: 'npc_far', locationId: 'other_town' },
      ],
      1,
    );

    const rumor = generateRumor({
      kind: 'quest_completed',
      day: 0,
      sourceNpc: 'npc_a',
      detail: 'the missing miller',
    });
    const after = advanceRumors([rumor], graph, 1, 3)[0];

    expect(after.reachedNpcs).toContain('npc_b');
    expect(after.reachedNpcs).toContain('npc_c');
    expect(after.reachedNpcs).not.toContain('npc_far');
  });

  // SPREAD TEST 3: spread is monotonic, day-scoped, and records the day it
  // last moved — the property a day-tick depends on.
  it('adds listeners one day at a time and never loses one', () => {
    const graph = cliqueGraph(['npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6'], 0.5);
    let rumor = generateRumor({
      kind: 'crime',
      day: 0,
      sourceNpc: 'npc_1',
      detail: 'the warehouse fire',
    });

    let previous = rumor.reachedNpcs.length;
    for (let day = 1; day <= 4; day += 1) {
      const stepped = spreadRumorsOneDay([rumor], graph, day);
      const next = stepped.rumors[0];
      // Monotonic: every earlier listener is still a listener.
      for (const id of rumor.reachedNpcs) expect(next.reachedNpcs).toContain(id);
      expect(next.reachedNpcs.length).toBeGreaterThanOrEqual(previous);
      if (next.reachedNpcs.length > previous) {
        expect(next.lastSpreadDay).toBe(day);
        expect(stepped.newReaches[rumor.id].length).toBe(next.reachedNpcs.length - previous);
      }
      previous = next.reachedNpcs.length;
      rumor = next;
    }
    expect(rumor.reachedNpcs.length).toBeGreaterThan(1);
  });

  it('does not mutate the rumors handed to it', () => {
    const graph = cliqueGraph(['npc_1', 'npc_2', 'npc_3'], 1);
    const rumor = generateRumor({ kind: 'crime', day: 0, sourceNpc: 'npc_1' });
    const before = JSON.stringify(rumor);
    spreadRumorsOneDay([rumor], graph, 1);
    expect(JSON.stringify(rumor)).toBe(before);
  });
});

describe('RumorMillSystem - dialogue window', () => {
  it('withholds a rumor on the day it broke, then offers it once it is a day old', () => {
    const graph = cliqueGraph(['npc_1', 'npc_2'], 1);
    const rumor = generateRumor({
      kind: 'quest_completed',
      day: 0,
      sourceNpc: 'npc_1',
      subject: 'Vaelin',
      detail: 'the missing miller',
    });
    const spread = advanceRumors([rumor], graph, 1, 1);

    // Same day: nobody brings it up yet.
    expect(getRumorsForNpc(spread, 'npc_1', 0)).toHaveLength(0);
    // Day 1-3: it is conversational for everyone who heard it.
    expect(getRumorsForNpc(spread, 'npc_1', 1)).toHaveLength(1);
    expect(getRumorsForNpc(spread, 'npc_2', 3)).toHaveLength(1);
    // An NPC who never heard it still has nothing to say.
    expect(getRumorsForNpc(spread, 'npc_stranger', 3)).toHaveLength(0);
  });

  it('builds capped, age-labelled dialogue context lines', () => {
    const rumors: TownRumor[] = [1, 2, 3, 4].map((n) =>
      generateRumor({
        kind: 'custom',
        day: n,
        sourceNpc: 'npc_1',
        detail: `deed ${n}`,
      }),
    );
    const heard = rumors.map((r) => ({ ...r, reachedNpcs: [...r.reachedNpcs, 'npc_2'] }));

    const lines = buildRumorDialogueContext(heard, 'npc_2', 5, 3);
    expect(lines).toHaveLength(3);
    // Freshest first: day 4 is one day old.
    expect(lines[0]).toContain('yesterday');
    expect(lines[0]).toContain('deed 4');
    expect(lines[1]).toContain('2 days ago');
  });
});

describe('RumorMillSystem - decay', () => {
  it('fades linearly and goes stale after the lifespan', () => {
    const rumor = generateRumor({ kind: 'crime', day: 0, sourceNpc: 'npc_1' });
    expect(rumorFreshness(rumor, 0)).toBe(1);
    expect(rumorFreshness(rumor, 3)).toBeCloseTo(1 - 3 / RUMOR_LIFESPAN_DAYS, 5);
    expect(rumorFreshness(rumor, RUMOR_LIFESPAN_DAYS)).toBe(0);

    expect(isRumorStale(rumor, RUMOR_LIFESPAN_DAYS - 1)).toBe(false);
    expect(isRumorStale(rumor, RUMOR_LIFESPAN_DAYS)).toBe(true);
  });

  it('prunes stale rumors and stops spreading or quoting them', () => {
    const graph = cliqueGraph(['npc_1', 'npc_2', 'npc_3'], 1);
    const old = generateRumor({ kind: 'crime', day: 0, sourceNpc: 'npc_1' });
    const fresh = generateRumor({ kind: 'donation', day: 8, sourceNpc: 'npc_1' });

    const day = 9;
    expect(pruneStaleRumors([old, fresh], day)).toEqual([fresh]);
    // A stale rumor gains no new listeners even if the graph is wide open.
    const stepped = spreadRumorsOneDay([old], graph, day).rumors[0];
    expect(stepped.reachedNpcs).toEqual(old.reachedNpcs);
    expect(getRumorsForNpc([old], 'npc_1', day)).toHaveLength(0);
  });
});

describe('RumorMillSystem - reputation', () => {
  it('raises notoriety for negative talk and disposition for positive talk', () => {
    const listeners = ['npc_2', 'npc_3', 'npc_4'];
    const bad: TownRumor = {
      ...generateRumor({ kind: 'crime', day: 0, sourceNpc: 'npc_1', magnitude: 1 }),
      reachedNpcs: ['npc_1', ...listeners],
    };
    const good: TownRumor = {
      ...generateRumor({ kind: 'donation', day: 0, sourceNpc: 'npc_9', magnitude: 1 }),
      reachedNpcs: ['npc_9', 'npc_5'],
    };

    const delta = summarizeRumorReputation([bad, good], 0);
    expect(delta.notorietyDelta).toBeGreaterThan(0);
    // Only the three who heard the crime are soured; the source is not a listener.
    for (const id of listeners) expect(delta.dispositionDeltas[id]).toBeLessThan(0);
    expect(delta.dispositionDeltas.npc_1).toBeUndefined();
    // The temple donation warms the one person who heard it.
    expect(delta.dispositionDeltas.npc_5).toBeGreaterThan(0);
  });

  it('weakens with age and ignores stale or neutral talk', () => {
    const base: TownRumor = {
      ...generateRumor({ kind: 'crime', day: 0, sourceNpc: 'npc_1', magnitude: 1 }),
      reachedNpcs: ['npc_1', 'npc_2'],
    };
    const fresh = summarizeRumorReputation([base], 0).notorietyDelta;
    const aged = summarizeRumorReputation([base], 5).notorietyDelta;
    expect(aged).toBeLessThan(fresh);
    expect(summarizeRumorReputation([base], RUMOR_LIFESPAN_DAYS).notorietyDelta).toBe(0);

    const neutral: TownRumor = {
      ...generateRumor({ kind: 'custom', day: 0, sourceNpc: 'npc_1' }),
      reachedNpcs: ['npc_1', 'npc_2'],
    };
    const delta = summarizeRumorReputation([neutral], 0);
    expect(delta.notorietyDelta).toBe(0);
    expect(delta.dispositionDeltas).toEqual({});
  });
});

describe('RumorMillSystem - WorldRumor interop', () => {
  it('projects a town rumor onto the canonical WorldRumor shape', () => {
    const rumor: TownRumor = {
      ...generateRumor({
        kind: 'crime',
        day: 4,
        sourceNpc: 'npc_1',
        locationId: 'burg_12',
        detail: 'the warehouse fire',
      }),
      reachedNpcs: ['npc_1', 'npc_2', 'npc_3'],
    };
    const world = townRumorToWorldRumor(rumor);

    expect(world.id).toBe(rumor.id);
    expect(world.text).toBe(rumor.text);
    expect(world.type).toBe('event');
    expect(world.timestamp).toBe(4);
    expect(world.expiration).toBe(4 + RUMOR_LIFESPAN_DAYS);
    expect(world.locationId).toBe('burg_12');
    expect(world.spreadDistance).toBe(2);
  });
});
