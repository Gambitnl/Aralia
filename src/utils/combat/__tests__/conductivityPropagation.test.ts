/**
 * @file conductivityPropagation.test.ts
 * @created 2026-09-20 (agora-2fb1)
 *
 * Covers the wet + electrified elemental interaction: a lightning strike into standing water
 * spreads outward through everything soaked, weaker at every step.
 *
 * The interesting cases are the boundaries, so they get most of the file: a dry creature must
 * not relay the charge, a creature reachable two ways must be billed once at the shorter
 * distance, and the creature the strike already hit must conduct without being charged twice.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveConductivityPropagation,
  type ConductiveNode,
} from '../aoeCalculations';
import {
  CONDUCTIVITY_RULES,
  StateTag,
  getConductivityRule,
  getConductivityRuleForDamageType,
} from '../../../types/elemental';

const WET_LIGHTNING = CONDUCTIVITY_RULES['electrified+wet'];

function wet(id: string, x: number, y: number): ConductiveNode {
  return { id, position: { x, y }, stateTags: [StateTag.Wet] };
}

function dry(id: string, x: number, y: number): ConductiveNode {
  return { id, position: { x, y }, stateTags: [StateTag.Burning] };
}

describe('conductivity rule lookup', () => {
  it('resolves wet + electrified in either order', () => {
    expect(getConductivityRule(StateTag.Wet, StateTag.Electrified)).toBe(WET_LIGHTNING);
    expect(getConductivityRule(StateTag.Electrified, StateTag.Wet)).toBe(WET_LIGHTNING);
  });

  it('resolves the rule from a raw damage type', () => {
    expect(getConductivityRuleForDamageType('lightning', StateTag.Wet)).toBe(WET_LIGHTNING);
    expect(getConductivityRuleForDamageType('Lightning', StateTag.Wet)).toBe(WET_LIGHTNING);
  });

  it('returns undefined for pairs that do not conduct', () => {
    // Fire into water is already a StateInteractions row (it makes steam). It is not conduction.
    expect(getConductivityRuleForDamageType('fire', StateTag.Wet)).toBeUndefined();
    expect(getConductivityRuleForDamageType('slashing', StateTag.Wet)).toBeUndefined();
    expect(getConductivityRule(StateTag.Wet, StateTag.Oiled)).toBeUndefined();
  });

  it('describes the charge it applies and the medium that carries it', () => {
    expect(WET_LIGHTNING.conductor).toBe(StateTag.Wet);
    expect(WET_LIGHTNING.charge).toBe(StateTag.Electrified);
  });
});

describe('resolveConductivityPropagation', () => {
  it('reaches a soaked neighbour of the strike at half damage', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('a', 1, 0)],
      rule: WET_LIGHTNING,
    });

    expect(hits).toEqual([
      { id: 'a', position: { x: 1, y: 0 }, hop: 1, damageFraction: 0.5, appliedState: StateTag.Electrified },
    ]);
  });

  it('halves again at every further step', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('a', 1, 0), wet('b', 2, 0), wet('c', 3, 0)],
      rule: WET_LIGHTNING,
    });

    expect(hits.map(hit => [hit.id, hit.hop, hit.damageFraction])).toEqual([
      ['a', 1, 0.5],
      ['b', 2, 0.25],
      ['c', 3, 0.125],
    ]);
  });

  it('stops when the rule runs out of hops', () => {
    const chain = [wet('a', 1, 0), wet('b', 2, 0), wet('c', 3, 0), wet('d', 4, 0)];
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: chain,
      rule: WET_LIGHTNING,
    });

    expect(WET_LIGHTNING.maxHops).toBe(3);
    expect(hits).toHaveLength(3);
    expect(hits.map(hit => hit.id)).not.toContain('d');
  });

  it('does not pass the charge through a dry creature', () => {
    // 'far' is soaked but the only thing between it and the strike is dry, so the puddle is
    // broken and the charge dies at the gap.
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [dry('gap', 1, 0), wet('far', 2, 0)],
      rule: WET_LIGHTNING,
    });

    expect(hits).toEqual([]);
  });

  it('ignores a creature carrying no elemental state at all', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [{ id: 'bare', position: { x: 1, y: 0 } }],
      rule: WET_LIGHTNING,
    });

    expect(hits).toEqual([]);
  });

  it('conducts diagonally, matching the 5-5-5 grid rule the rest of the module uses', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('corner', 1, 1)],
      rule: WET_LIGHTNING,
    });

    expect(hits.map(hit => hit.id)).toEqual(['corner']);
  });

  it('bills a creature once, at the shortest number of hops', () => {
    // 'shared' sits one step from the strike AND one step from another relay. It must be a hop-1
    // hit exactly once, not a hop-1 hit plus a hop-2 hit.
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('relay', 1, 0), wet('shared', 0, 1)],
      rule: WET_LIGHTNING,
    });

    expect(hits).toHaveLength(2);
    expect(hits.every(hit => hit.hop === 1)).toBe(true);
    expect(new Set(hits.map(hit => hit.id)).size).toBe(2);
  });

  it('lets the directly struck creature relay the charge without being billed twice', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 10, y: 10 },
      nodes: [wet('struck', 0, 0), wet('neighbour', 1, 0)],
      rule: WET_LIGHTNING,
      alreadyDamagedIds: ['struck'],
    });

    expect(hits.map(hit => hit.id)).toEqual(['neighbour']);
    expect(hits[0].hop).toBe(1);
  });

  it('returns nothing when the strike lands nowhere near the puddle', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 20, y: 20 },
      nodes: [wet('a', 0, 0), wet('b', 1, 0)],
      rule: WET_LIGHTNING,
    });

    expect(hits).toEqual([]);
  });

  it('returns nothing when a rule allows no hops', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('a', 1, 0)],
      rule: { ...WET_LIGHTNING, maxHops: 0 },
    });

    expect(hits).toEqual([]);
  });

  it('reaches further when the rule says the hop is longer', () => {
    const hits = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [wet('a', 2, 0)],
      rule: { ...WET_LIGHTNING, hopRangeFeet: 10 },
    });

    expect(hits.map(hit => hit.id)).toEqual(['a']);
  });

  it('produces the same result whatever order the caller lists its creatures in', () => {
    const nodes = [wet('a', 1, 0), wet('b', 2, 0), wet('c', 3, 0)];
    const forward = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes,
      rule: WET_LIGHTNING,
    });
    const reversed = resolveConductivityPropagation({
      origin: { x: 0, y: 0 },
      nodes: [...nodes].reverse(),
      rule: WET_LIGHTNING,
    });

    expect([...reversed].sort((l, r) => l.id.localeCompare(r.id)))
      .toEqual([...forward].sort((l, r) => l.id.localeCompare(r.id)));
  });

  it('does not mutate the creatures it was given', () => {
    const nodes = [wet('a', 1, 0)];
    const before = JSON.stringify(nodes);

    resolveConductivityPropagation({ origin: { x: 0, y: 0 }, nodes, rule: WET_LIGHTNING });

    expect(JSON.stringify(nodes)).toBe(before);
  });
});
