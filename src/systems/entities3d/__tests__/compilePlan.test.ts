/**
 * @file compilePlan.test.ts — CreaturePlan → EntityBlueprint compilation.
 * Spec: docs/superpowers/specs/2026-07-15-text-to-creature-design.md.
 */
import { describe, it, expect } from 'vitest';
import { validateCreaturePlan } from '../textPlan/planSchema';
import { compilePlan } from '../textPlan/compilePlan';
import { spineRadiusAt } from '../textPlan/spineProfile';
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
    // round 10 (creature-anatomy): the fixture slimmed to 3 stubs (one pair +
    // the rear smear) — five stubs read as turtle flippers on the gel mound.
    expect(out.planSpec!.chains.filter((c) => c.kind === 'tentacle').length).toBeGreaterThanOrEqual(3);
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

describe('compilePlan v1.2 — tauric, box, opacity', () => {
  const centaurish: Parameters<typeof compilePlan>[0] = {
    name: 'Test Centaur',
    frame: { heightFt: 6, lengthFt: 8, bulk: 0.7, stance: 'horizontal' },
    spine: { segments: 4, taper: 0.75, arch: 0.05 },
    appendages: [
      { kind: 'leg', attach: 0.2, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
      { kind: 'leg', attach: 0.8, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
      { kind: 'torso', attach: 0.08, count: 1, chain: [{ lenFt: 1.5, r: 0.55 }, { lenFt: 1.3, r: 0.45 }] },
      { kind: 'arm', attach: 0.08, parent: 2, perSide: true, count: 1, tips: 'hand', chain: [{ lenFt: 1.4, r: 0.12 }, { lenFt: 1.2, r: 0.09 }] },
    ],
    heads: [{ neckIndex: 2, sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }],
    palette: { bodyHex: '#7a5236', accentHex: '#caa06b', eyeHex: '#2e2418' },
  };

  it('centaur: torso chain compiled; arms carry parentId; head binds to the torso chain', () => {
    const out = compilePlan(centaurish);
    const torso = out.planSpec!.chains.find((c) => c.kind === 'torso')!;
    expect(torso, 'torso chain missing').toBeTruthy();
    const arms = out.planSpec!.chains.filter((c) => c.kind === 'arm');
    expect(arms).toHaveLength(2);
    for (const arm of arms) expect(arm.parentId).toBe(torso.id);
    expect(out.planSpec!.heads[0].chainId).toBe(torso.id);
  });

  it('box + opacity flow into the planSpec', () => {
    const out = compilePlan({
      name: 'Test Cube',
      frame: { heightFt: 10, lengthFt: 10, bulk: 1, stance: 'horizontal' },
      spine: { segments: 2, taper: 1, arch: 0, shape: 'box' },
      appendages: [],
      heads: [{ sizeScale: 0.6, eyes: { count: 1, sizeScale: 1 } }],
      palette: { bodyHex: '#7fae72', eyeHex: '#333333', opacity: 0.35 },
    });
    expect(out.planSpec!.spine.shape).toBe('box');
    expect(out.planSpec!.opacity).toBe(0.35);
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

describe('junction blend resolution (blendM)', () => {
  it('applies per-kind defaults: dragon legs get 0.35 against the smaller junction radius', () => {
    const out = compilePlan(PLAN_FIXTURES.dragon);
    const s = out.planSpec!;
    const leg = s.chains.find((c) => c.kind === 'leg')!;
    // round 4 (creature-anatomy): the dragon fixture now carries spine.mass,
    // so the expected hull radius comes from THE shared profile instead of
    // re-deriving the legacy taper+bulge formula by hand (which mass bypasses).
    const hullR = spineRadiusAt(
      { bodyRadM: s.bodyRadM, spine: { taper: s.spine.taper, bulge: s.spine.bulge, mass: s.spine.mass } },
      leg.attach,
    );
    // creature-anatomy round 1: leg roots carry a 1.25 collar boost so the
    // junction skirt reads as muscle (ROOT_COLLAR_BOOST in compilePlan)
    const expected = 0.35 * Math.min(leg.links[0].rM, hullR) * 2 * 1.25;
    expect(leg.blendM).toBeCloseTo(expected, 6);
  });

  it('creature-level skin.blend beats per-kind defaults', () => {
    const plan = JSON.parse(JSON.stringify(PLAN_FIXTURES.dragon));
    plan.skin = { blend: 1 };
    const a = compilePlan(plan).planSpec!;
    const b = compilePlan(PLAN_FIXTURES.dragon).planSpec!;
    const legA = a.chains.find((c) => c.kind === 'leg')!;
    const legB = b.chains.find((c) => c.kind === 'leg')!;
    expect(legA.blendM).toBeCloseTo((legB.blendM / 0.35) * 1, 6);
    expect(a.skinBlend).toBe(1);
  });

  it('appendage blend override beats skin.blend, and 0 kills the collar', () => {
    const plan = JSON.parse(JSON.stringify(PLAN_FIXTURES.dragon));
    plan.skin = { blend: 1 };
    plan.appendages[0].blend = 0;
    const s = compilePlan(plan).planSpec!;
    // appendages[0] is the FRONT leg pair only — its collars die, the rear
    // pair still gets the creature-level skin.blend
    const frontIds = new Set(['leg0L', 'leg0R']);
    for (const c of s.chains) {
      if (c.kind !== 'leg') continue;
      expect(frontIds.has(c.id) ? c.blendM === 0 : c.blendM > 0).toBe(true);
    }
  });

  it('is deterministic', () => {
    const a = compilePlan(PLAN_FIXTURES.tentacledOoze).planSpec!;
    const b = compilePlan(PLAN_FIXTURES.tentacledOoze).planSpec!;
    expect(a.chains.map((c) => c.blendM)).toEqual(b.chains.map((c) => c.blendM));
  });
});
