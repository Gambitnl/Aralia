/**
 * This file proves that canonical blueprints become honest preview scenes.
 * It covers floor peeling, occupancy, lighting, and chronological damage so
 * the design workbench cannot drift from the pure building and history plans.
 */

import { describe, it, expect } from 'vitest';
import { buildingSceneModel, DOT_RADIUS_FT, DOT_LIFT_FT } from '../buildingSceneModel';
import { BLUEPRINT_STOREY_FT } from '../buildingModels';
import { generateBuilding } from '../../worldforge/interior/generateBuilding';
import { rootSeedPath } from '../../worldforge/seedPath';
import { generateHousehold } from '../../worldforge/town/household';
import { briefFromHousehold } from '../../worldforge/town/householdBrief';
import { computeOccupancy, HEARTH_KINDS } from '../../worldforge/interior/occupancy';

/** Smith-family bundle — the same matched (plan, household, occupancy)
 *  pattern the design-preview page builds for its occupancy overlay. */
function smithBundle(seed = 759381890) {
  const town = rootSeedPath(seed);
  const household = generateHousehold(town, 'preset-smith', 5, 'smithy', {
    role: 'proprietor', workplaceType: 'smithy',
  });
  const brief = briefFromHousehold(household, { wealth: 'common', worksAtHome: true });
  const plan = generateBuilding({
    buildingId: 1, type: 'smithy', seedPath: town, storeys: 2, basement: true,
    household: brief,
  });
  const occupancy = computeOccupancy(plan, household, { worksAtHome: true });
  return { plan, household, brief, occupancy };
}

/** Bare tavern (no household) for the un-occupied cases. */
const barePlan = (seed = 759381890) =>
  generateBuilding({
    buildingId: 1, type: 'tavern', seedPath: rootSeedPath(seed), storeys: 2, basement: true,
  });

/** Styled tavern — carries plan.roof + plan.styleResolved (BGv2 Task 5). */
const styledPlan = (seed = 1) =>
  generateBuilding({
    buildingId: 1, type: 'tavern', seedPath: rootSeedPath(seed), storeys: 1, basement: false,
    style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
  });

/** Current row receipts clip solved roof skin before the preview consumes it. */
const styledRowPlan = () =>
  generateBuilding({
    buildingId: 19,
    type: 'townhouse',
    seedPath: rootSeedPath(1919),
    storeys: 2,
    basement: false,
    style: { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'new' },
    ensemble: {
      blockKey: 'ward:3:edge:2',
      kind: 'row',
      partyWallLeft: true,
      partyWallRight: true,
      partyWallOwner: 'later-frontage-member',
      eaveStoreys: 2,
      ensembleSignature: 'preview-row-roof-boundary-proof',
    },
  });

describe('buildingSceneModel — solved roof (BGv2 Task 5)', () => {
  it('"all" mode raises the solved roof group + chimney/dormer boxes', () => {
    const plan = styledPlan();
    expect(plan.roof).toBeDefined();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    expect(m.roof).toBeDefined();
    expect(m.roof!.positions.length).toBeGreaterThan(0);
    expect(m.roof!.positions.length % 3).toBe(0);
    expect(m.roof!.color).toBe(plan.styleResolved!.roofColor);
    // Roof planes sit on the wall top; the ONLY honest exception is the eave
    // overhang, which drops below the plate by at most eaveOverhang × pitch
    // slope. Bound Y from below by wallTop − that eave drop (computed from the
    // plan, per the Task-5 brief), never an arbitrary slack.
    const wallTop = plan.floors.filter((f) => f.level >= 0).length * BLUEPRINT_STOREY_FT;
    // Pitch slope = rise / (shorter main half-extent); eaveDrop = overhang×slope.
    const mainMass = plan.masses.find((m2) => m2.kind === 'main') ?? plan.masses[0];
    const shorterFt = Math.min(mainMass.w, mainMass.h) * 5; // cells → feet
    const slope = shorterFt > 0 ? plan.roof!.pitchRiseFt / (shorterFt / 2) : 0;
    const eaveDrop = plan.roof!.eaveOverhangFt * slope;
    for (let i = 1; i < m.roof!.positions.length; i += 3) {
      expect(m.roof!.positions[i]).toBeGreaterThanOrEqual(wallTop - eaveDrop - 1e-4);
    }
    // Chimney flues appear as boxes (this tavern has ≥1 hearth chimney).
    expect(m.boxes.some((b) => b.kind === 'chimney')).toBe(true);
  });

  it('floor-peel hides the roof so the interior stays visible', () => {
    const plan = styledPlan();
    const m = buildingSceneModel(plan, { upToLevel: 0, hour: 12 });
    expect(m.roof).toBeUndefined();
    expect(m.boxes.some((b) => b.kind === 'chimney' || b.kind === 'dormer')).toBe(false);
  });

  it('a roofless (bare) plan yields no roof group', () => {
    const m = buildingSceneModel(barePlan(), { upToLevel: 'all', hour: 12 });
    expect(m.roof).toBeUndefined();
  });

  it('keeps an attached preview roof inside its two party-wall lot lines', () => {
    const plan = styledRowPlan();
    const model = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    const xs = Array.from(model.roof!.positions).filter((_, index) => index % 3 === 0);
    const zs = Array.from(model.roof!.positions).filter((_, index) => index % 3 === 2);

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(plan.widthFt + 1e-6);
    expect(Math.min(...zs) < 0 || Math.max(...zs) > plan.depthFt).toBe(true);
  });
});

describe('buildingSceneModel — floor peel', () => {
  it('"all" shows every level closed (top ceiling present)', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    const levels = new Set(m.boxes.map((b) => b.level));
    for (const f of plan.floors) expect(levels.has(f.level)).toBe(true);
    expect(m.boxes.some((b) => b.kind === 'ceiling')).toBe(true);
  });

  it('peeling to ground hides upper floors AND leaves the ground open-topped', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 0, hour: 12 });
    expect(m.boxes.every((b) => b.level <= 0)).toBe(true);
    // No lid over the selected floor: neither an upper slab nor a ceiling box.
    expect(m.boxes.some((b) => b.kind === 'ceiling' && b.level === 0)).toBe(false);
    expect(m.boxes.some((b) => b.level > 0)).toBe(false);
  });

  it('peeling to the basement shows ONLY basement boxes', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: -1, hour: 12 });
    expect(m.boxes.length).toBeGreaterThan(0);
    expect(m.boxes.every((b) => b.level === -1)).toBe(true);
    expect(m.boxes.some((b) => b.kind === 'ceiling')).toBe(false);
  });

  it('peeling to the TOP level drops its ceiling but keeps lower floors', () => {
    const plan = barePlan();
    const top = Math.max(...plan.floors.map((f) => f.level));
    const m = buildingSceneModel(plan, { upToLevel: top, hour: 12 });
    expect(m.boxes.some((b) => b.level === 0)).toBe(true);
    expect(m.boxes.some((b) => b.kind === 'ceiling')).toBe(false);
  });

  it('every box stays inside the plan footprint bbox (plus wall thickness slack)', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    const slack = 2; // outer walls grow outward from the grid line
    for (const b of m.boxes) {
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(-slack);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(plan.widthFt + slack);
      expect(b.y - b.d / 2).toBeGreaterThanOrEqual(-slack);
      expect(b.y + b.d / 2).toBeLessThanOrEqual(plan.depthFt + slack);
    }
  });
});

describe('buildingSceneModel — window glow', () => {
  it('window panes glow at 19h when occupied', () => {
    const { plan, occupancy } = smithBundle();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 19, occupancy });
    const panes = m.boxes.filter((b) => b.kind === 'window-pane');
    expect(panes.length).toBeGreaterThan(0);
    expect(panes.every((p) => p.emissive !== undefined)).toBe(true);
  });

  it('window panes are dark at noon even when occupied', () => {
    const { plan, occupancy } = smithBundle();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12, occupancy });
    const panes = m.boxes.filter((b) => b.kind === 'window-pane');
    expect(panes.every((p) => p.emissive === undefined)).toBe(true);
  });

  it('window panes are dark at 19h with NO occupancy', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 19 });
    const panes = m.boxes.filter((b) => b.kind === 'window-pane');
    expect(panes.every((p) => p.emissive === undefined)).toBe(true);
  });
});

describe('buildingSceneModel - chronological history', () => {
  it('shows replayed damage in 3D and treats abandoned occupancy as inactive', () => {
    const { household, brief } = smithBundle(6161);
    const plan = generateBuilding({
      buildingId: 1,
      type: 'smithy',
      seedPath: rootSeedPath(6161),
      storeys: 2,
      basement: true,
      household: brief,
      style: {
        cultureType: 'Highland',
        climate: 'cold',
        wealth: 'common',
        ageBand: 'old',
      },
      eventLog: [
        {
          day: 4,
          kind: 'fire-damage',
          payload: { incidentId: 'scene-fire', severity: 3 },
        },
        { day: 8, kind: 'abandonment', payload: { boardedFraction: 1 } },
      ],
    });
    const occupancy = computeOccupancy(plan, household, { worksAtHome: true });
    const all = buildingSceneModel(plan, { upToLevel: 'all', hour: 19, occupancy });
    const peeled = buildingSceneModel(plan, { upToLevel: 0, hour: 19, occupancy });

    expect(all.boxes.some((box) => box.kind === 'history-scorch')).toBe(true);
    expect(all.boxes.some((box) => box.kind === 'history-board')).toBe(true);
    // Roof damage now lives in the triangle surface itself; the old dark slab
    // overlay must not return in either closed or peeled preview modes.
    expect(all.boxes.some((box) => box.kind === 'history-roof-hole')).toBe(false);
    expect(peeled.boxes.some((box) => box.kind === 'history-roof-hole')).toBe(false);
    const roofHole = plan.liveHistory!.features.find((feature) => feature.kind === 'roof-hole');
    expect(roofHole).toBeDefined();
    expect(all.roof).toBeDefined();
    for (let i = 0; i < all.roof!.positions.length; i += 9) {
      const centerX = (
        all.roof!.positions[i] + all.roof!.positions[i + 3] + all.roof!.positions[i + 6]
      ) / 3;
      const centerY = (
        all.roof!.positions[i + 2] + all.roof!.positions[i + 5] + all.roof!.positions[i + 8]
      ) / 3;
      expect(Math.hypot(centerX - roofHole!.x, centerY - roofHole!.y))
        .toBeGreaterThanOrEqual(roofHole!.radiusFt - 1e-6);
    }
    expect(all.windowsLit).toBe(false);
    expect(all.dots).toEqual([]);
  });

  it('replays ruin sag into the solved ridge instead of additive cap boxes', () => {
    const plan = generateBuilding({
      buildingId: 2,
      type: 'manor',
      seedPath: rootSeedPath(7171),
      storeys: 2,
      basement: false,
      style: {
        cultureType: 'River',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'old',
      },
      eventLog: [{
        day: 80,
        kind: 'ruin',
        payload: { cause: 'neglect', severity: 3 },
      }],
    });
    const sag = plan.liveHistory!.features.find((feature) => feature.kind === 'ruin-sag');
    expect(sag).toBeDefined();
    const ridge = plan.roof!.ridges[sag!.ridgeIndex];
    const centerX = (ridge.x1 + ridge.x2) / 2;
    const centerY = (ridge.y1 + ridge.y2) / 2;
    const model = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });

    expect(model.boxes.some((box) => box.kind === 'history-ruin-sag')).toBe(false);
    const centerHeights: number[] = [];
    for (let i = 0; i < model.roof!.positions.length; i += 3) {
      if (
        Math.abs(model.roof!.positions[i] - centerX) < 1e-6 &&
        Math.abs(model.roof!.positions[i + 2] - centerY) < 1e-6
      ) {
        centerHeights.push(model.roof!.positions[i + 1]);
      }
    }
    expect(centerHeights.length).toBeGreaterThan(0);
    const wallTopFt = plan.floors.filter((floor) => floor.level >= 0).length
      * BLUEPRINT_STOREY_FT;
    expect(Math.min(...centerHeights))
      .toBeCloseTo(wallTopFt + ridge.zFt - sag!.deflectionFt, 5);
  });
});

describe('buildingSceneModel — hearths', () => {
  it('emits one hearth box per hearth furnishing on visible floors', () => {
    const { plan, occupancy } = smithBundle();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12, occupancy });
    const hearthCount = plan.floors
      .flatMap((f) => f.furnishings)
      .filter((f) => HEARTH_KINDS.has(f.kind)).length;
    expect(hearthCount).toBeGreaterThan(0); // a smithy has a forge-hearth
    expect(m.boxes.filter((b) => b.kind === 'hearth').length).toBe(hearthCount);
  });

  it('hearth glows exactly when occupancy says the hearth is lit', () => {
    const { plan, occupancy } = smithBundle();
    const litHour = occupancy.flags.hearthLitHours.findIndex(Boolean);
    const coldHour = occupancy.flags.hearthLitHours.findIndex((v) => !v);
    expect(litHour).toBeGreaterThanOrEqual(0);
    const lit = buildingSceneModel(plan, { upToLevel: 'all', hour: litHour, occupancy });
    const cold = buildingSceneModel(plan, { upToLevel: 'all', hour: coldHour, occupancy });
    expect(lit.boxes.filter((b) => b.kind === 'hearth').every((b) => b.emissive)).toBe(true);
    expect(cold.boxes.filter((b) => b.kind === 'hearth').every((b) => !b.emissive)).toBe(true);
  });
});

describe('buildingSceneModel — occupant dots', () => {
  it('one dot per at-home member at 19h, inside the footprint, at storey height', () => {
    const { plan, occupancy } = smithBundle();
    const hour = 19;
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour, occupancy });
    const home = occupancy.stationsByHour[hour].filter((s) => s.where === 'home');
    expect(m.dots.length).toBe(home.length);
    expect(m.dots.length).toBeGreaterThan(0);
    for (const dot of m.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(plan.widthFt);
      expect(dot.y).toBeGreaterThanOrEqual(0);
      expect(dot.y).toBeLessThanOrEqual(plan.depthFt);
      const station = home.find((s) => s.memberIndex === dot.memberIndex)!;
      expect(dot.zFt).toBeCloseTo((station.level ?? 0) * BLUEPRINT_STOREY_FT + DOT_LIFT_FT, 5);
      expect(dot.color).toMatch(/^#/);
    }
    expect(DOT_RADIUS_FT).toBeGreaterThan(0);
  });

  it('members sharing one station spread out (no two dots coincide)', () => {
    const { plan, occupancy } = smithBundle();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 19, occupancy });
    expect(m.dots.length).toBeGreaterThan(1); // family ringed around the hearth
    const keys = new Set(m.dots.map((d) => `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.zFt}`));
    expect(keys.size).toBe(m.dots.length);
  });

  it('peel hides dots on hidden floors', () => {
    const { plan, occupancy } = smithBundle();
    // Find an hour where somebody is home on an UPPER floor (sleeping upstairs).
    let hour = -1;
    for (let h = 0; h < 24; h++) {
      if (occupancy.stationsByHour[h].some((s) => s.where === 'home' && (s.level ?? 0) > 0)) { hour = h; break; }
    }
    expect(hour).toBeGreaterThanOrEqual(0);
    const all = buildingSceneModel(plan, { upToLevel: 'all', hour, occupancy });
    const peeled = buildingSceneModel(plan, { upToLevel: 0, hour, occupancy });
    expect(peeled.dots.length).toBeLessThan(all.dots.length);
    expect(peeled.dots.every((d) => d.level <= 0)).toBe(true);
  });

  it('no occupancy → no dots', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 19 });
    expect(m.dots).toEqual([]);
  });
});

describe('buildingSceneModel — invariants', () => {
  it('is deterministic for the same inputs', () => {
    const { plan, occupancy } = smithBundle();
    const a = buildingSceneModel(plan, { upToLevel: 0, hour: 19, occupancy });
    const b = buildingSceneModel(plan, { upToLevel: 0, hour: 19, occupancy });
    expect(a).toEqual(b);
  });

  it('every box carries a resolved color and finite geometry', () => {
    const { plan, occupancy } = smithBundle();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 19, occupancy });
    for (const b of m.boxes) {
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
      for (const v of [b.x, b.y, b.z0, b.w, b.d, b.h]) expect(Number.isFinite(v)).toBe(true);
      expect(b.w).toBeGreaterThan(0);
      expect(b.d).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
    expect(m.storeyHeightFt).toBe(BLUEPRINT_STOREY_FT);
    expect(m.widthFt).toBe(plan.widthFt);
    expect(m.depthFt).toBe(plan.depthFt);
  });
});

describe('buildingSceneModel — identity and dressing (BGv2 Phase 1B)', () => {
  it('wall color equals styleResolved.wallColor when present; equals legacy constant when absent', () => {
    // Present case:
    const planStyled = styledPlan();
    expect(planStyled.styleResolved).toBeDefined();
    const mStyled = buildingSceneModel(planStyled, { upToLevel: 'all', hour: 12 });
    const wallsStyled = mStyled.boxes.filter((b) => b.kind === 'wall');
    expect(wallsStyled.length).toBeGreaterThan(0);
    for (const w of wallsStyled) {
      expect(w.color).toBe(planStyled.styleResolved!.wallColor);
    }

    // Absent case (legacy / bare plan):
    const planBare = barePlan();
    expect(planBare.styleResolved).toBeUndefined();
    const mBare = buildingSceneModel(planBare, { upToLevel: 'all', hour: 12 });
    const wallsBare = mBare.boxes.filter((b) => b.kind === 'wall');
    expect(wallsBare.length).toBeGreaterThan(0);
    for (const w of wallsBare) {
      expect(w.color).toBe('#8a7663'); // legacy BOX_COLOR.wall constant
    }
  });

  it('canonical box set (walls/floors/stairs) and roof geometry byte-identical with dressing on vs off', () => {
    const plan = styledPlan();
    
    // Dressing ON:
    const mOn = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    
    // Dressing OFF (by cloning the plan and removing styleResolved):
    const planOff = { ...plan, styleResolved: undefined };
    const mOff = buildingSceneModel(planOff, { upToLevel: 'all', hour: 12 });

    const canonicalKinds = ['wall', 'floor', 'ceiling', 'stair', 'jamb', 'door-lintel', 'sill', 'window-head', 'window-pane'];

    const canonicalBoxesOn = mOn.boxes
      .filter((b) => canonicalKinds.includes(b.kind))
      .map((b) => ({ kind: b.kind, level: b.level, x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, h: b.h }));

    const canonicalBoxesOff = mOff.boxes
      .filter((b) => canonicalKinds.includes(b.kind))
      .map((b) => ({ kind: b.kind, level: b.level, x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, h: b.h }));

    expect(canonicalBoxesOn).toEqual(canonicalBoxesOff);

    // Roof geometry remains identical:
    expect(mOn.roof).toBeDefined();
    expect(mOff.roof).toBeDefined();
    expect(mOn.roof!.positions).toEqual(mOff.roof!.positions);
    expect(mOn.roof!.indices).toEqual(mOff.roof!.indices);
  });

  it('dressing part count is deterministic for a fixed plan (two builds, deep-equal)', () => {
    const plan = styledPlan();
    const m1 = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    const m2 = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });

    const dressingKinds = ['construction-material', 'facade-trim', 'motif', 'weathering', 'permanent-history'];
    const d1 = m1.boxes.filter((b) => dressingKinds.includes(b.kind));
    const d2 = m2.boxes.filter((b) => dressingKinds.includes(b.kind));

    expect(d1.length).toBeGreaterThan(0);
    expect(d1).toEqual(d2);
  });

  it('a legacy plan (no styleResolved) produces zero dressing parts', () => {
    const plan = barePlan();
    const m = buildingSceneModel(plan, { upToLevel: 'all', hour: 12 });
    const dressingKinds = ['construction-material', 'facade-trim', 'motif', 'weathering', 'permanent-history'];
    const dressingBoxes = m.boxes.filter((b) => dressingKinds.includes(b.kind));
    expect(dressingBoxes.length).toBe(0);
  });
});

