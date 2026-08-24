/**
 * This file proves that the rich town plan becomes the flat, durable artifact
 * consumed by the 3D ground world without changing plot identity.
 *
 * It covers role mapping, street tiers, style stamps, and the architectural
 * cohesion rule: plots in one spatial district use a small repeated color,
 * form, facade, and construction vocabulary while stable plot ids still
 * permit bounded building-level differences.
 */
import { describe, it, expect } from 'vitest';
import { toArtifactPlan, storeysForRole, STREET_TIERS } from '../townPlanAdapter';

const { plaza: PLAZA, avenue: AVENUE, street: STREET, lane: LANE } = STREET_TIERS;
import { STYLE_FAMILIES } from '../architectureStyle';
import { constructionKitsForFamily } from '../buildingMaterials';
import type { TownPlan as EngineTownPlan } from '../townEngine';

const sq = (x: number, y: number, s: number): [number, number][] =>
  [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];

/** Synthetic engine plan: two ward plots (a shop + a home), a temple, one street, a wall ring.
 *  Plots are >= MIN_PLOT_SIDE_FT so the adapter keeps them. */
function makeEnginePlan(): EngineTownPlan {
  const shop = { polygon: sq(0, 0, 16), frontageEdge: 0, buildingType: 'shop' as const };
  const home = { polygon: sq(30, 0, 16), frontageEdge: 0, buildingType: 'cottage' as const };
  return {
    footprint: sq(-5, -5, 80),
    core: sq(0, 0, 70),
    wards: [{ polygon: sq(0, 0, 70), block: sq(1, 1, 68), plots: [shop, home], civic: undefined }],
    plots: [shop, home],
    outskirts: [],
    openLand: [],
    walls: { ring: sq(0, 0, 70), gatehouses: [[35, 0]] },
    civic: [{ kind: 'temple', polygon: sq(40, 40, 18), wardIndex: 0 }],
    streets: [[[0, 0], [25, 25], [50, 50]]],
    // The generator's network. The adapter TRANSLATES this (tier → tint, width →
    // widthFt); it no longer decides tiers itself, so the fixture states them.
    streetNetwork: [
      { centerline: [[0, 0], [70, 0]], tier: 'lane', role: 'ward', width: LANE.widthFt },
      { centerline: [[70, 0], [70, 70]], tier: 'lane', role: 'ward', width: LANE.widthFt },
      { centerline: [[70, 70], [0, 70]], tier: 'lane', role: 'ward', width: LANE.widthFt },
      { centerline: [[0, 70], [0, 0]], tier: 'lane', role: 'ward', width: LANE.widthFt },
      { centerline: [[0, 0], [25, 25], [50, 50]], tier: 'avenue', role: 'approach', width: AVENUE.widthFt },
    ],
    courtyards: [{
      id: 'ward:0:court',
      wardIndex: 0,
      blockKey: 'ward:0:courtyard',
      center: [35, 35],
      radius: 8,
      districtKey: 'wealth:common',
      wealth: 'common',
      amenity: 'well',
      courtyardSignature: 'court-fixture',
    }],
    farmsteads: [],
  } as EngineTownPlan;
}

describe('toArtifactPlan', () => {
  const { plan, walls } = toArtifactPlan(makeEnginePlan(), 7);

  it('carries the burgId', () => {
    expect(plan.burgId).toBe(7);
  });

  it('carries shared courts as open-space receipts without consuming plot ids', () => {
    expect(plan.courtyards).toEqual([{
      id: 'ward:0:court',
      blockKey: 'ward:0:courtyard',
      center: [35, 35],
      radiusFt: 8,
      districtKey: 'wealth:common',
      wealth: 'common',
      amenity: 'well',
      courtyardSignature: 'court-fixture',
    }]);
    expect(plan.plots.map((plot) => plot.id)).toEqual([0, 1, 2]);
  });

  it('maps building types into the 3D role buckets', () => {
    const roles = plan.plots.map((p) => p.role).sort();
    // shop → market, cottage → house, temple civic → temple
    expect(roles).toContain('market');
    expect(roles).toContain('house');
    expect(roles).toContain('temple');
  });

  it('emits 4-corner footprints for every plot (3D oriented-box contract)', () => {
    for (const p of plan.plots) expect(p.footprint.length).toBe(4);
  });

  it('gives every plot >= 1 storey; civic/commercial taller than rim houses', () => {
    for (const p of plan.plots) expect(p.storeys).toBeGreaterThanOrEqual(1);
    const temple = plan.plots.find((p) => p.role === 'temple')!;
    expect(temple.storeys).toBe(3);
  });

  it('surfaces the wall ring and gatehouses', () => {
    expect(walls.ring.length).toBe(4);
    expect(walls.gatehouses.length).toBe(1);
  });

  it('translates every network street, tier tint and generated width intact', () => {
    // WHO DECIDES (roads slice, 2026-08-23): the tiering rules moved into the
    // generator (`townStreetNetwork`, tested there). What the adapter owes is a
    // faithful translation — one artifact street per network street, the tier's
    // tint as the wire identity, and the GENERATED width rather than the tier's
    // nominal one. Taking the nominal width back was the old drift: a ribbon
    // wider than the gap the ward blocks were inset to leave.
    expect(plan.streets.length).toBe(5);
    expect(plan.streets.filter((s) => s.colorHex === LANE.colorHex).length).toBe(4);
    expect(plan.streets.filter((s) => s.colorHex === AVENUE.colorHex).length).toBe(1);
    for (const s of plan.streets) expect(s.widthFt).toBeGreaterThan(0);
  });

  it('keeps an approach road centerline untouched apart from densification', () => {
    const avenue = plan.streets.find((s) => s.colorHex === AVENUE.colorHex)!;
    expect(avenue.centerline[0]).toEqual([0, 0]);
    expect(avenue.centerline.at(-1)).toEqual([50, 50]);
  });

  it('carries the GENERATED width, not the tier default', () => {
    const engine = makeEnginePlan();
    // A lane the generator squeezed to 3 ft because its ward is tight.
    engine.streetNetwork = [{ centerline: [[0, 0], [70, 0]], tier: 'lane', role: 'ward', width: 3 }];
    const { plan: p } = toArtifactPlan(engine, 9);
    expect(p.streets[0].widthFt).toBe(3);
    expect(p.streets[0].colorHex).toBe(LANE.colorHex);
  });

  it('densifies a long street so the ground bake can drape it', () => {
    const engine = makeEnginePlan();
    engine.streetNetwork = [{ centerline: [[0, 0], [400, 0]], tier: 'avenue', role: 'spine', width: 22 }];
    const { plan: p } = toArtifactPlan(engine, 9);
    // 400 ft at <= 24 ft spacing.
    expect(p.streets[0].centerline.length).toBeGreaterThanOrEqual(18);
    expect(p.streets[0].centerline[0]).toEqual([0, 0]);
    expect(p.streets[0].centerline.at(-1)).toEqual([400, 0]);
  });

  it('drops a degenerate one-point street rather than emitting a zero-length ribbon', () => {
    const engine = makeEnginePlan();
    engine.streetNetwork = [
      { centerline: [[5, 5]], tier: 'lane', role: 'ward', width: 10 },
      { centerline: [[0, 0], [70, 0]], tier: 'lane', role: 'ward', width: 10 },
    ];
    const { plan: p } = toArtifactPlan(engine, 9);
    expect(p.streets.length).toBe(1);
  });

  it('orders tier widths strictly plaza > avenue > street > lane', () => {
    expect(PLAZA.widthFt).toBeGreaterThan(AVENUE.widthFt);
    expect(AVENUE.widthFt).toBeGreaterThan(STREET.widthFt);
    expect(STREET.widthFt).toBeGreaterThan(LANE.widthFt);
  });

  it('emits no style fields when no family is given (legacy shape)', () => {
    for (const p of plan.plots) {
      expect(p.wallColorHex).toBeUndefined();
      expect(p.roofColorHex).toBeUndefined();
      expect(p.roofForm).toBeUndefined();
      expect(p.architecture).toBeUndefined();
    }
  });

  it('preserves row metadata, shared eaves, and exact party-wall boundaries', () => {
    const shared = {
      blockKey: 'ward:0:edge:0',
      kind: 'row' as const,
      eaveStoreys: 3 as const,
      ensembleSignature: 'row-shared',
    };
    const left = {
      polygon: sq(0, 0, 16),
      frontageEdge: 0,
      buildingType: 'cottage' as const,
      ensemble: { ...shared, partyWallLeft: false, partyWallRight: true },
    };
    const right = {
      polygon: sq(16, 0, 16),
      frontageEdge: 0,
      buildingType: 'shop' as const,
      ensemble: { ...shared, partyWallLeft: true, partyWallRight: false },
    };
    const engine = {
      ...makeEnginePlan(),
      wards: [{ polygon: sq(0, 0, 70), block: sq(1, 1, 68), plots: [left, right] }],
      plots: [left, right],
      civic: [],
    } as EngineTownPlan;
    const { plan: adapted } = toArtifactPlan(engine, 31, STYLE_FAMILIES.temperateFrame);

    expect(adapted.plots).toHaveLength(2);
    expect(adapted.plots.every((plot) => plot.storeys === 3)).toBe(true);
    expect(adapted.plots.map((plot) => plot.ensemble?.ensembleSignature))
      .toEqual(['row-shared', 'row-shared']);
    expect(adapted.plots[0].footprint[1]).toEqual(adapted.plots[1].footprint[0]);
    expect(adapted.plots[0].footprint[2]).toEqual(adapted.plots[1].footprint[3]);
    expect(new Set(adapted.plots.map((plot) => plot.roofForm)).size).toBe(1);
    expect(new Set(adapted.plots.map((plot) => plot.architecture?.pitchScale)).size).toBe(1);
    expect(new Set(adapted.plots.map((plot) => plot.architecture?.eaveOffsetFt)).size).toBe(1);
    expect(new Set(adapted.plots.map((plot) => plot.architecture?.buildingVariant)).size).toBe(2);
  });

  it('preserves the full cell-aligned envelope for negotiated lots', () => {
    const lot = {
      polygon: sq(0, 0, 15),
      frontageEdge: 0,
      buildingType: 'cottage' as const,
      ensemble: {
        blockKey: 'ward:0:edge:0',
        kind: 'row' as const,
        partyWallLeft: false,
        partyWallRight: false,
        eaveStoreys: 2 as const,
        lotProfile: 'right-return' as const,
        lotSignature: 'adapter-negotiated-lot',
        ensembleSignature: 'adapter-negotiated-row',
      },
    };
    const engine = {
      ...makeEnginePlan(),
      wards: [{ polygon: sq(0, 0, 40), block: sq(1, 1, 38), plots: [lot] }],
      plots: [lot],
      civic: [],
    } as EngineTownPlan;
    const { plan: adapted } = toArtifactPlan(engine, 32);
    const [frontLeft, frontRight, , backLeft] = adapted.plots[0].footprint;

    expect(Math.hypot(frontRight[0] - frontLeft[0], frontRight[1] - frontLeft[1]))
      .toBeCloseTo(15, 8);
    expect(Math.hypot(backLeft[0] - frontLeft[0], backLeft[1] - frontLeft[1]))
      .toBeCloseTo(15, 8);
    expect(adapted.plots[0].ensemble?.lotSignature).toBe('adapter-negotiated-lot');
  });

  it('applies an explicit detached parcel setback before building generation', () => {
    const lot = {
      polygon: sq(0, 0, 20),
      frontageEdge: 0,
      buildingType: 'cottage' as const,
      ensemble: {
        blockKey: 'ward:0:edge:0',
        kind: 'detached' as const,
        partyWallLeft: false,
        partyWallRight: false,
        eaveStoreys: 1 as const,
        parcelProfile: 'lane-setback' as const,
        parcelSignature: 'adapter-detached-parcel',
        ensembleSignature: 'adapter-detached-block',
      },
    };
    const engine = {
      ...makeEnginePlan(),
      wards: [{ polygon: sq(0, 0, 40), block: sq(1, 1, 38), plots: [lot] }],
      plots: [lot],
      civic: [],
    } as EngineTownPlan;
    const { plan: adapted } = toArtifactPlan(engine, 33);

    expect(adapted.plots[0].footprint).toEqual([
      [1.6, 1.6],
      [18.4, 1.6],
      [18.4, 17.6],
      [1.6, 17.6],
    ]);
    expect(adapted.plots[0].ensemble?.parcelSignature)
      .toBe('adapter-detached-parcel');
  });

  it('stamps deterministic style fields when a family is provided', () => {
    const fam = STYLE_FAMILIES.highlandStone;
    const a = toArtifactPlan(makeEnginePlan(), 42, fam);
    const b = toArtifactPlan(makeEnginePlan(), 42, fam);
    expect(a.plan.plots.length).toBeGreaterThan(0);
    for (const [i, plot] of a.plan.plots.entries()) {
      expect(plot.wallColorHex).toBeTruthy();
      expect(fam.wallPalette).toContain(plot.wallColorHex!);
      expect(plot.roofColorHex).toBeTruthy();
      expect(fam.roofPalette).toContain(plot.roofColorHex!);
      expect(plot.roofForm && fam.roofForms.includes(plot.roofForm)).toBe(true);
      expect(plot.architecture?.districtSignature).toBeTruthy();
      expect(plot.architecture?.buildingVariant).toBeTruthy();
      expect(plot.architecture?.pitchScale).toBeGreaterThanOrEqual(0.88);
      expect(plot.architecture?.pitchScale).toBeLessThanOrEqual(1.12);
      expect(Math.abs(plot.architecture?.eaveOffsetFt ?? 1)).toBeLessThanOrEqual(0.25);
      expect(['new', 'aged', 'old', 'ancient'])
        .toContain(plot.architecture?.ageBand);
      expect(fam.facadePatterns).toContain(plot.architecture?.facadePattern);
      expect(constructionKitsForFamily(fam.id).map((kit) => kit.id))
        .toContain(plot.architecture?.construction.kitId);
      expect(plot.architecture?.construction.constructionSignature).toBeTruthy();
      expect(plot.wallColorHex).toBe(b.plan.plots[i].wallColorHex);
      expect(plot.roofColorHex).toBe(b.plan.plots[i].roofColorHex);
      expect(plot.roofForm).toBe(b.plan.plots[i].roofForm);
      expect(plot.architecture).toEqual(b.plan.plots[i].architecture);
    }
  });

  it('preserves explicit spatial district and pre-filter building identities', () => {
    const engine = makeEnginePlan();
    engine.wards[0].architectureDistrict = {
      index: 3,
      key: 'district:3',
      label: 'Harbor District',
    };
    engine.wards[0].plots[0].architectureKey = 'plot:canonical-shop';
    engine.wards[0].plots[1].architectureKey = 'plot:canonical-home';

    const { plan: styled } = toArtifactPlan(engine, 12, STYLE_FAMILIES.coastalTimber);
    const shop = styled.plots.find((plot) => plot.role === 'market')!;
    const home = styled.plots.find((plot) => plot.role === 'house')!;

    expect(shop.architecture?.districtKey).toBe('district:3');
    expect(shop.architecture?.districtLabel).toBe('Harbor District');
    expect(shop.architecture?.buildingKey).toBe('plot:canonical-shop');
    expect(shop.architecture?.wealth).toBe('common');
    expect(home.architecture?.districtKey).toBe('district:3');
    expect(home.architecture?.buildingKey).toBe('plot:canonical-home');
    expect(shop.architecture?.districtSignature)
      .toBe(home.architecture?.districtSignature);
  });

  it('keeps a district to a dominant plus one related choice per visible style trait', () => {
    // A long synthetic ward provides enough buildings for both the dominant
    // branch and its minority exceptions to appear deterministically.
    const districtPlots = Array.from({ length: 48 }, (_, index) => ({
      polygon: sq(index * 20, 0, 16),
      frontageEdge: 0,
      buildingType: 'cottage' as const,
    }));
    const districtPlan = {
      ...makeEnginePlan(),
      footprint: sq(-10, -10, 1000),
      core: sq(0, 0, 980),
      wards: [{
        polygon: sq(0, 0, 980),
        block: sq(1, 1, 978),
        plots: districtPlots,
        civic: undefined,
        wealth: 'common' as const,
      }],
      plots: districtPlots,
      civic: [],
      streets: [],
    } as EngineTownPlan;
    const family = STYLE_FAMILIES.temperateFrame;
    const { plan: styled } = toArtifactPlan(districtPlan, 17, family);

    for (const values of [
      styled.plots.map((plot) => plot.wallColorHex),
      styled.plots.map((plot) => plot.roofColorHex),
      styled.plots.map((plot) => plot.roofForm),
      styled.plots.map((plot) => plot.architecture?.construction.kitId),
      styled.plots.map((plot) => plot.architecture?.construction.shutters),
    ]) {
      expect(new Set(values).size).toBeGreaterThanOrEqual(2);
      expect(new Set(values).size).toBeLessThanOrEqual(2);
    }

    expect(styled.plots.every((plot) => plot.architecture?.ageBand)).toBe(true);
  });

  it('carries multiple radial growth-ring ages through the artifact contract', () => {
    const agePlots = [
      sq(490, 490, 16),
      sq(490, 340, 16),
      sq(490, 190, 16),
      sq(490, 20, 16),
    ].map((polygon) => ({
      polygon,
      frontageEdge: 0,
      buildingType: 'cottage' as const,
    }));
    const radialPlan = {
      ...makeEnginePlan(),
      footprint: sq(0, 0, 1000),
      core: sq(0, 0, 1000),
      wards: [{
        polygon: sq(0, 0, 1000),
        block: sq(1, 1, 998),
        plots: agePlots,
        civic: undefined,
        wealth: 'common' as const,
      }],
      plots: agePlots,
      civic: [],
      streets: [],
    } as EngineTownPlan;
    const { plan: styled } = toArtifactPlan(
      radialPlan,
      17,
      STYLE_FAMILIES.temperateFrame,
    );
    const ageBands = styled.plots.map((plot) => plot.architecture!.ageBand);

    expect(new Set(ageBands).size).toBeGreaterThanOrEqual(3);
    expect(ageBands[0]).toBe('ancient');
    expect(ageBands.at(-1)).toBe('new');
  });

  it('lets two same-culture towns choose different district recipes', () => {
    const family = STYLE_FAMILIES.temperateFrame;
    const first = toArtifactPlan(makeEnginePlan(), 17, family).plan.plots;
    const second = toArtifactPlan(makeEnginePlan(), 18, family).plan.plots;
    const visibleStyle = (plots: typeof first) => plots.map((plot) => [
      plot.wallColorHex,
      plot.roofColorHex,
      plot.roofForm,
    ]);
    expect(visibleStyle(first)).not.toEqual(visibleStyle(second));
  });

  it('plot IDs are unchanged by styling (business-binding invariant)', () => {
    const plain = toArtifactPlan(makeEnginePlan(), 42);
    const styled = toArtifactPlan(makeEnginePlan(), 42, STYLE_FAMILIES.coastalTimber);
    expect(styled.plan.plots.map((p) => p.id)).toEqual(plain.plan.plots.map((p) => p.id));
    expect(styled.plan.plots.map((p) => p.footprint)).toEqual(plain.plan.plots.map((p) => p.footprint));
    expect(styled.plan.plots.map((p) => p.role)).toEqual(plain.plan.plots.map((p) => p.role));
  });
});

describe('storeysForRole', () => {
  it('keeps civic/commercial tall and houses low', () => {
    const poly = sq(0, 0, 10);
    expect(storeysForRole('keep', poly)).toBe(3);
    expect(storeysForRole('market', poly)).toBe(2);
    expect(storeysForRole('house', poly)).toBeGreaterThanOrEqual(1);
    expect(storeysForRole('house', poly)).toBeLessThanOrEqual(2);
  });
});
