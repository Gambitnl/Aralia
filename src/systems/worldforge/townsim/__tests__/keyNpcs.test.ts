import { SeededRandom } from '../../../../utils/random/seededRandom';
import { assignKeyNpcs } from '../keyNpcs';
import { generateTownRoster } from '../../roster/generateTownRoster';
import { makeSeedPath } from '../../seedPath';
import { buildDemoTownPlan } from '../../town/demoTownPlan';
import type { TownRoster } from '../../roster/types';
import type { TownPlan } from '../../artifacts';

function build(worldSeed: number, population: number): { plan: TownPlan; roster: TownRoster } {
  const demo = buildDemoTownPlan(worldSeed, { burgId: 1, population });
  const roster = generateTownRoster(demo.plan, makeSeedPath(worldSeed, 'burg:1', 's:roster'), {
    nameFor: (rng) => `N${Math.floor(rng.next() * 1e6)}`,
  });
  return { plan: demo.plan, roster };
}

describe('assignKeyNpcs', () => {
  it('assigns lord/priest/marketmaster in a city that has keep+temple+market', () => {
    const { plan, roster } = build(6000, 6000);
    const roles = assignKeyNpcs(plan, roster, { rng: new SeededRandom(1) });
    const values = [...roles.values()];
    expect(values.filter((r) => r === 'lord').length).toBe(1);
    expect(values.filter((r) => r === 'priest').length).toBe(1);
    expect(values.filter((r) => r === 'marketmaster').length).toBe(1);
  });

  it('a village with no keep gets no lord, but still a priest', () => {
    const { plan, roster } = build(200, 200);
    const hasKeep = plan.plots.some((p) => p.role === 'keep');
    expect(hasKeep).toBe(false); // sanity: this demo village has no keep
    const roles = assignKeyNpcs(plan, roster, { rng: new SeededRandom(2) });
    const values = [...roles.values()];
    expect(values.includes('lord')).toBe(false);
    expect(values.filter((r) => r === 'priest').length).toBe(1);
  });

  it('all key NPCs are adults and nobody holds two roles', () => {
    const { plan, roster } = build(6000, 6000);
    const roles = assignKeyNpcs(plan, roster, { rng: new SeededRandom(3) });
    const byId = new Map(roster.occupants.map((o) => [o.id, o]));
    for (const id of roles.keys()) {
      expect(byId.get(id)?.ageBand).not.toBe('child');
    }
    // map keys are unique by construction → one role per occupant
    expect(new Set(roles.keys()).size).toBe(roles.size);
  });

  it('wildcard count scales with town size and is deterministic', () => {
    const { plan, roster } = build(6000, 6000);
    const a = assignKeyNpcs(plan, roster, { rng: new SeededRandom(9) });
    const b = assignKeyNpcs(plan, roster, { rng: new SeededRandom(9) });
    expect([...a.entries()]).toEqual([...b.entries()]); // deterministic
    const wildcards = [...a.values()].filter((r) => r === 'wildcard').length;
    expect(wildcards).toBeGreaterThanOrEqual(1);
    expect(wildcards).toBeLessThanOrEqual(3);
  });

  it('respects an explicit wildcard override', () => {
    const { plan, roster } = build(6000, 6000);
    const roles = assignKeyNpcs(plan, roster, { rng: new SeededRandom(4), wildcards: 0 });
    expect([...roles.values()].includes('wildcard')).toBe(false);
  });
});
