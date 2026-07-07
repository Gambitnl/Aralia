/**
 * @file roofStyle.golden.test.ts — the STYLE-IDENTITY golden (BGv2 Phase 1B).
 *
 * The showpiece invariant of the Roofscapes phase, promoted from Task 4's
 * behavioural check to a DURABLE PINNED GOLDEN: one fixed (seed, type) dressed
 * in three different StyleContexts must keep BYTE-IDENTICAL geometry bones
 * (floors / footprintCells / stairs / rooms / doors / walls) while the roof and
 * the resolved dress (styleResolved) DIFFER.
 *
 * "Bones" = every geometry field below the wall-top. The style layer
 * (resolveStyle + solveRoof) is purely additive: it never touches partition,
 * doors, walls, furnishings, or stairs. This test is the guard that keeps that
 * true — if a future edit lets a style seep into the plan geometry, exactly one
 * of these three plans will drift and the snapshot / cross-equality breaks.
 *
 * Why manor·seed 7: genFootprint gives it main + wing + tower, so the roof is
 * the richest available shape (multiple planes, wing valleys, a tower cap) —
 * the strongest exercise of the roof solver behind the identity guarantee.
 *
 * Durability model: the bones of the FIRST context are snapshotted ONCE
 * (toMatchSnapshot). All three contexts are then asserted equal to that same
 * string. A geometry regression in ANY context fails the cross-equality; a
 * geometry regression that somehow moves ALL three identically still fails the
 * pinned snapshot. The snapshot is the anchor; the cross-equality is the invariant.
 */
import { describe, it, expect } from 'vitest';
import { generateBuilding } from '../generateBuilding';
import { rootSeedPath } from '../../seedPath';
import type { BlueprintPlan, BuildingType, StyleContext } from '../blueprintTypes';

// Three deliberately-spread contexts: different culture FAMILY (→ different
// palettes + offered roof forms), different climate (→ different pitch / eave /
// forced form), different wealth (→ different palette slice + ornament).
const HIGHLAND_COLD_POOR: StyleContext =
  { cultureType: 'Highland', climate: 'cold', wealth: 'poor', ageBand: 'new' };
const RIVER_TEMPERATE_COMMON: StyleContext =
  { cultureType: 'River', climate: 'temperate', wealth: 'common', ageBand: 'aged' };
const NAVAL_TEMPERATE_WEALTHY: StyleContext =
  { cultureType: 'Naval', climate: 'temperate', wealth: 'wealthy', ageBand: 'old' };

const CONTEXTS: Array<{ name: string; style: StyleContext }> = [
  { name: 'Highland·cold·poor', style: HIGHLAND_COLD_POOR },
  { name: 'River·temperate·common', style: RIVER_TEMPERATE_COMMON },
  { name: 'Naval·temperate·wealthy', style: NAVAL_TEMPERATE_WEALTHY },
];

/** Every geometry field BELOW the wall-top. Excludes roof + styleResolved (the
 *  dress, which is EXPECTED to differ) and `style`/`masses` echoes. If any of
 *  these move under a re-dress, the identity invariant is broken. */
const bones = (p: BlueprintPlan): string =>
  JSON.stringify({
    buildingId: p.buildingId,
    type: p.type,
    footprintCells: p.footprintCells,
    widthFt: p.widthFt,
    depthFt: p.depthFt,
    stairs: p.stairs,
    frontage: p.frontage,
    // Full per-floor geometry: rooms, doors, windows, furnishings, walls, runs.
    floors: p.floors,
  });

const genManor = (style: StyleContext): BlueprintPlan =>
  generateBuilding({
    buildingId: 1, type: 'manor', seedPath: rootSeedPath(7),
    storeys: 2, basement: true, style,
  });

describe('style-identity golden (manor·seed 7 under three styles)', () => {
  const plans = CONTEXTS.map((c) => ({ ...c, plan: genManor(c.style) }));

  it('the geometry bones are PINNED (durable snapshot of the first context)', () => {
    // The anchor. Regenerate with -u ONLY when a deliberate geometry change to
    // the base building generator lands (never for a roof/style change — those
    // must leave the bones untouched, which the cross-equality below proves).
    expect(bones(plans[0].plan)).toMatchSnapshot('manor-seed7-bones');
  });

  it('all three styles share byte-identical bones (the style-identity invariant)', () => {
    const anchor = bones(plans[0].plan);
    for (const { name, plan } of plans) {
      expect(`${name}: ${bones(plan)}`).toBe(`${name}: ${anchor}`);
    }
  });

  it('the roof DIFFERS across all three styles (all-distinct)', () => {
    const roofs = plans.map((p) => JSON.stringify(p.plan.roof));
    for (const r of roofs) expect(r).not.toBe('undefined'); // every context solved a roof
    expect(new Set(roofs).size).toBe(3);
  });

  it('the resolved dress DIFFERS across all three styles (all-distinct)', () => {
    const dress = plans.map((p) => JSON.stringify(p.plan.styleResolved));
    for (const d of dress) expect(d).not.toBe('undefined');
    expect(new Set(dress).size).toBe(3);
  });

  it('each roof is a real solved shape (planes + a tower cap for this footprint)', () => {
    for (const { name, plan } of plans) {
      expect(plan.roof, name).toBeDefined();
      expect(plan.roof!.planes.length, `${name} planes`).toBeGreaterThan(0);
      // manor·seed 7 has a corner tower → exactly one cap.
      expect(plan.roof!.towerCaps.length, `${name} towerCaps`).toBe(1);
    }
  });

  it('the dress mirrors each context wealth tier + culture family', () => {
    const byName = Object.fromEntries(plans.map((p) => [p.name, p.plan.styleResolved!]));
    expect(byName['Highland·cold·poor'].finishTier).toBe('poor');
    expect(byName['Highland·cold·poor'].familyId).toBe('highlandStone');
    expect(byName['River·temperate·common'].finishTier).toBe('common');
    expect(byName['River·temperate·common'].familyId).toBe('riverHalfTimber');
    expect(byName['Naval·temperate·wealthy'].finishTier).toBe('wealthy');
    expect(byName['Naval·temperate·wealthy'].familyId).toBe('coastalTimber');
    // wealthy ⇒ ornament on; poor ⇒ off.
    expect(byName['Naval·temperate·wealthy'].ornament).toBe(true);
    expect(byName['Highland·cold·poor'].ornament).toBe(false);
  });
});

// The invariant must not be a manor-only fluke: two more roof-bearing types
// (temple, keep — both get a tower/wing from genFootprint) keep bones identical
// across the same three contexts while their dress diverges.
describe('style-identity holds for other roof-bearing types', () => {
  const TYPES: BuildingType[] = ['temple', 'keep'];
  for (const type of TYPES) {
    it(`${type}·seed 7: identical bones, distinct roof + dress across 3 styles`, () => {
      const plans = CONTEXTS.map((c) =>
        generateBuilding({
          buildingId: 1, type, seedPath: rootSeedPath(7),
          storeys: 2, basement: true, style: c.style,
        }),
      );
      const anchor = bones(plans[0]);
      for (const p of plans) expect(bones(p)).toBe(anchor);
      expect(new Set(plans.map((p) => JSON.stringify(p.roof))).size).toBe(3);
      expect(new Set(plans.map((p) => JSON.stringify(p.styleResolved))).size).toBe(3);
    });
  }
});
