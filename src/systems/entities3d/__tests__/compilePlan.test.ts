/**
 * @file compilePlan.test.ts — CreaturePlan → EntityBlueprint compilation.
 * Spec: docs/superpowers/specs/2026-07-15-text-to-creature-design.md.
 */
import { describe, it, expect } from 'vitest';
import { validateCreaturePlan } from '../textPlan/planSchema';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { allParts } from '../registry';

registerAllParts();

const knownIds = new Set(allParts().map((p) => p.id));

describe('plan fixtures', () => {
  it('every fixture validates cleanly — fixtures are the language\'s living examples', () => {
    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      expect(validateCreaturePlan(plan, knownIds), `fixture ${key}`).toEqual([]);
    }
  });
});

describe('compilePlan', () => {
  it('dragon: gait plan; 4 legs (2 mirrored pairs), 1 tail, membrane wing garnish; feet→meters exact', () => {
    const out = compilePlan(PLAN_FIXTURES.dragon);
    expect(out.gait).toBe('plan');
    const chains = out.planSpec!.chains;
    const byKind = (k: string) => chains.filter((c) => c.kind === k);
    expect(byKind('leg')).toHaveLength(4);
    expect(out.parts.some((p) => p.partId === 'wingsMembrane')).toBe(true);
    expect(byKind('tail')).toHaveLength(1);
    // the dragon's first leg link is exactly 4 ft in the fixture
    const leg = byKind('leg')[0];
    expect(leg.links[0].lenM).toBeCloseTo(1.2192, 6);
    // mirrored pairs carry opposite sides
    const legSides = byKind('leg').map((c) => c.side).sort();
    expect(legSides).toEqual([-1, -1, 1, 1]);
    // legs get distributed stride phases, not all identical
    const phases = new Set(byKind('leg').map((c) => c.phaseOffset));
    expect(phases.size).toBeGreaterThan(1);
    expect(out.label).toBe('Emberwing Dragon');
  });

  it('serpent: no legs; 3 neck chains; 3 heads bound to distinct chains', () => {
    const out = compilePlan(PLAN_FIXTURES.threeHeadedSerpent);
    const chains = out.planSpec!.chains;
    expect(chains.filter((c) => c.kind === 'leg')).toHaveLength(0);
    const necks = chains.filter((c) => c.kind === 'neck');
    expect(necks).toHaveLength(3);
    const heads = out.planSpec!.heads;
    expect(heads).toHaveLength(3);
    const bound = heads.map((h) => h.chainId).sort();
    expect(bound).toEqual(necks.map((n) => n.id).sort());
    expect(out.planSpec!.stance).toBe('serpentine');
  });

  it('ooze: horizontal stance with tentacle chains', () => {
    const out = compilePlan(PLAN_FIXTURES.tentacledOoze);
    expect(out.planSpec!.stance).toBe('horizontal');
    expect(out.planSpec!.chains.filter((c) => c.kind === 'tentacle').length).toBeGreaterThanOrEqual(4);
  });

  it('floating eye: floating stance, no chains, one single big eye', () => {
    const out = compilePlan(PLAN_FIXTURES.floatingEye);
    expect(out.planSpec!.stance).toBe('floating');
    expect(out.planSpec!.chains).toHaveLength(0);
    expect(out.planSpec!.heads).toHaveLength(1);
    expect(out.planSpec!.heads[0].eyes.count).toBe(1);
  });

  it('garnish resolves anchors from the part registry', () => {
    const out = compilePlan(PLAN_FIXTURES.dragon);
    const horns = out.parts.find((p) => p.partId === 'hornsCurved');
    expect(horns, 'dragon garnish hornsCurved missing').toBeTruthy();
    expect(horns!.anchor).toBeTruthy();
  });

  it('compiling is pure — same plan, identical output', () => {
    const a = compilePlan(PLAN_FIXTURES.dragon);
    const b = compilePlan(PLAN_FIXTURES.dragon);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('generateEntityBlueprint kind planned', () => {
  it('returns the compiled blueprint with the plan name as label', () => {
    const bp = generateEntityBlueprint({ kind: 'planned', plan: PLAN_FIXTURES.dragon, seed: 't' });
    expect(bp.gait).toBe('plan');
    expect(bp.label).toBe('Emberwing Dragon');
    expect(bp.planSpec).toBeTruthy();
    expect(bp.frame.heightFt).toBe(PLAN_FIXTURES.dragon.frame.heightFt);
  });
});
