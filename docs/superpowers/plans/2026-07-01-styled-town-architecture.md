# Styled Procedural Town Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give towns regional architectural identity — culture-keyed style families drive procedurally modeled buildings (varied roof shapes, palettes, chimneys), gatehouses at real road-gate openings in the town wall, and detailed docks/bridges (pilings, piers, railings) — with the 2D town map sharing the same palettes.

**Architecture:** A new shared data module (`architectureStyle.ts`) resolves a burg's culture TYPE (from the FMG atlas) to a `StyleFamily`. The town-plan adapter stamps per-plot style fields (wall/roof color, roof form) onto the artifact plan using a deterministic polygon-centroid hash, so 2D and 3D pick identical colors from identical inputs. The ground loader threads style data through `GroundWorld` → `ChunkData` → mesh builders; new/extended geometry builders (`gateGeometry.ts`, `deckGeometry.ts`, `buildingModels.ts`) turn the data into multi-part models. The wall ring now splits at road gatehouses (reusing the water-gate splitter) and each gate gets a styled gatehouse model.

**Spec:** `docs/superpowers/specs/2026-07-01-styled-town-architecture-design.md`

**Tech Stack:** TypeScript, three.js/R3F (render only), vitest. Geometry is plain `positions/indices/normals/colors` arrays (worker-transferable), matching `wallGeometry.ts`/`deckGeometry.ts`.

**Project rules that override skill defaults:**
- **NO commits** — leave all work in the tree (2am auto-snapshot). Plan steps therefore have no commit steps.
- **Master only** — no branches, no worktrees.
- **No fallbacks** — unresolvable culture type THROWS; demo paths pass an explicit family.
- **Guardrails:** 2D↔3D identity must hold (re-run `.agent/scratch/townIdentityProof.mjs`); do not touch plot-ID assignment (business binding — `groundChunkLoader.test.ts` regression must stay green).

**Verification suite used throughout** (same set the last program used, 385 green as of 2026-06-27):
```
npx vitest run src/systems/worldforge/town src/systems/worldforge/bridge src/systems/world3d src/components/Worldforge src/components/__tests__/MapPane.test.tsx src/systems/worldforge/roster/__tests__/generateTownRoster.test.ts
```

---

## Key existing code (read before starting)

| What | Where |
|---|---|
| Style tables shared 2D/3D (pattern to follow) | `src/systems/worldforge/town/buildingStyle.ts` |
| Plan adapter (plot ids, roles, `centroidHash01`) | `src/systems/worldforge/town/townPlanAdapter.ts` |
| Culture lookup precedent (`getBurgNamer`, throws on unresolvable) | `src/systems/worldforge/bridge/legacySubmapBridge.ts:81-114` |
| Wall ring → runs, water-gate split | `src/systems/worldforge/bridge/groundChunkLoader.ts:952-979`, `splitWallRingAtGates` at `:640` |
| GroundWorld → ChunkData clipping | `groundChunkLoader.ts:1315-1330` (walls/decks), sites at `:1362` |
| Wall/deck mesh builders (pattern for gate builder) | `src/systems/world3d/wallGeometry.ts`, `src/systems/world3d/deckGeometry.ts` |
| Chunk types | `src/systems/world3d/types.ts` (`ChunkData`, `ChunkSite`, `ChunkMeshBundle`) |
| Mesh bundle assembly | `src/systems/world3d/chunkBundle.ts` |
| 3D building render (box+cone roof, color-sniffed role) | `src/components/World3D/World3DScene.tsx:214-378` |
| 2D town map fills | `src/components/Worldforge/TownPlanView.tsx:334` |

---

### Task 1: `architectureStyle.ts` — style families + culture-type resolution

**Files:**
- Create: `src/systems/worldforge/town/architectureStyle.ts`
- Test: `src/systems/worldforge/town/__tests__/architectureStyle.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/systems/worldforge/town/__tests__/architectureStyle.test.ts
import { describe, it, expect } from 'vitest';
import {
  styleFamilyForCultureType, styledWallColor, styledRoof, hash01,
  STYLE_FAMILIES,
} from '../architectureStyle';

describe('architectureStyle', () => {
  it('maps every FMG culture type to a family', () => {
    for (const t of ['Generic', 'River', 'Lake', 'Naval', 'Nomadic', 'Hunting', 'Highland']) {
      expect(styleFamilyForCultureType(t).id).toBeTruthy();
    }
    expect(styleFamilyForCultureType('Highland').id).toBe('highlandStone');
    expect(styleFamilyForCultureType('Naval').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('Lake').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('River').id).toBe('riverHalfTimber');
    expect(styleFamilyForCultureType('Hunting').id).toBe('roughLog');
    expect(styleFamilyForCultureType('Generic').id).toBe('temperateFrame');
  });

  it('THROWS on an unknown culture type (no-fallback directive)', () => {
    expect(() => styleFamilyForCultureType('Astral')).toThrow(/no architecture style/i);
  });

  it('every family is fully populated', () => {
    for (const fam of Object.values(STYLE_FAMILIES)) {
      expect(fam.wallPalette.length).toBeGreaterThanOrEqual(2);
      expect(fam.roofPalette.length).toBeGreaterThanOrEqual(1);
      expect(fam.roofForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.gatehouseForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.deckDetail.pilingSpacingM).toBeGreaterThan(0);
    }
  });

  it('per-plot picks are deterministic from the polygon', () => {
    const poly: Array<[number, number]> = [[10, 10], [40, 10], [40, 30], [10, 30]];
    const fam = styleFamilyForCultureType('River');
    expect(styledWallColor(fam, poly)).toBe(styledWallColor(fam, poly));
    expect(styledRoof(fam, poly)).toEqual(styledRoof(fam, poly));
    expect(fam.wallPalette).toContain(styledWallColor(fam, poly));
  });

  it('hash01 stays in [0,1) and differs across inputs', () => {
    const a = hash01(3, 7), b = hash01(4, 7);
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(1);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/systems/worldforge/town/__tests__/architectureStyle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/systems/worldforge/town/architectureStyle.ts
/**
 * @file architectureStyle.ts — regional architecture style families.
 *
 * Single source of truth for HOW a culture builds: palettes, roof shapes,
 * gatehouse forms, dock/bridge detailing. Shared by the 2D town map
 * (TownPlanView) and the 3D ground renderer, sibling of buildingStyle.ts.
 * A burg's family comes from its FMG culture TYPE — deterministic, and per
 * the no-fallback directive an unknown type is an ERROR, not a default.
 */
import type { Pt } from '../submap/submapEngine';

export type RoofForm = 'gable' | 'hip' | 'steep' | 'flat';
export type GatehouseForm = 'twinTowers' | 'tunnelBlock' | 'singleTower';

export interface DeckDetail {
  /** Support-post spacing along dock/bridge edges (meters). */
  pilingSpacingM: number;
  railing: boolean;
  /** Parabolic mid-span lift for bridges (meters). 0 = flat span. */
  archRiseM: number;
}

export interface StyleFamily {
  id: 'highlandStone' | 'coastalTimber' | 'riverHalfTimber' | 'roughLog' | 'temperateFrame';
  wallPalette: string[];
  roofPalette: string[];
  roofForms: RoofForm[];
  gatehouseForms: GatehouseForm[];
  /** Town rampart tint. */
  wallTint: string;
  chimneys: boolean;
  deckDetail: DeckDetail;
}

export const STYLE_FAMILIES: Record<StyleFamily['id'], StyleFamily> = {
  highlandStone: {
    id: 'highlandStone',
    wallPalette: ['#8d8a83', '#7b786f', '#9a948a', '#6e6c66'],
    roofPalette: ['#4a5058', '#3f444b', '#565c63'],
    roofForms: ['steep', 'gable', 'hip'],
    gatehouseForms: ['twinTowers', 'singleTower'],
    wallTint: '#8a877f',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3.5, railing: false, archRiseM: 1.2 },
  },
  coastalTimber: {
    id: 'coastalTimber',
    wallPalette: ['#9a8a6e', '#a89478', '#8c7a5e', '#b3a184'],
    roofPalette: ['#5e4a38', '#6d5540', '#514031'],
    roofForms: ['gable', 'hip'],
    gatehouseForms: ['singleTower', 'twinTowers'],
    wallTint: '#93865f',
    chimneys: true,
    deckDetail: { pilingSpacingM: 2.5, railing: true, archRiseM: 0.6 },
  },
  riverHalfTimber: {
    id: 'riverHalfTimber',
    wallPalette: ['#cfc0a2', '#d8ccb2', '#c2b191', '#b8a686'],
    roofPalette: ['#7a4a32', '#6d4029', '#8a5238'],
    roofForms: ['gable', 'steep', 'hip'],
    gatehouseForms: ['tunnelBlock', 'twinTowers'],
    wallTint: '#a09680',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3, railing: true, archRiseM: 1.5 },
  },
  roughLog: {
    id: 'roughLog',
    wallPalette: ['#6f5a41', '#7c6549', '#5e4c37', '#87704f'],
    roofPalette: ['#7d6a3e', '#6e5d36', '#8c7845'],
    roofForms: ['gable', 'flat'],
    gatehouseForms: ['singleTower'],
    wallTint: '#6b5a43',
    chimneys: false,
    deckDetail: { pilingSpacingM: 4, railing: false, archRiseM: 0 },
  },
  temperateFrame: {
    id: 'temperateFrame',
    wallPalette: ['#9c7b54', '#a98a5f', '#8a6643', '#b89a72'],
    roofPalette: ['#7a4a32', '#7d6a3e', '#5e3a2c'],
    roofForms: ['hip', 'gable'],
    gatehouseForms: ['twinTowers', 'tunnelBlock', 'singleTower'],
    wallTint: '#9a9387',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3, railing: true, archRiseM: 0.8 },
  },
};

/** FMG culture types (Azgaar): the closed vocabulary this table must cover. */
const CULTURE_TYPE_TO_FAMILY: Record<string, StyleFamily['id']> = {
  Highland: 'highlandStone',
  Naval: 'coastalTimber',
  Lake: 'coastalTimber',
  River: 'riverHalfTimber',
  Hunting: 'roughLog',
  Nomadic: 'roughLog',
  Generic: 'temperateFrame',
};

export function styleFamilyForCultureType(cultureType: string): StyleFamily {
  const id = CULTURE_TYPE_TO_FAMILY[cultureType];
  if (!id) throw new Error(`No architecture style family for culture type "${cultureType}"`);
  return STYLE_FAMILIES[id];
}

/** Stable 0..1 hash of two ints (same recipe as townPlanAdapter.centroidHash01). */
export function hash01(a: number, b: number): number {
  let h = Math.imul((a | 0) + 374761393, 668265263) ^ Math.imul((b | 0) + 1, 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 0xffffffff;
}

function polyHash01(poly: Pt[], salt: number): number {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length || 1; cy /= poly.length || 1;
  return hash01((cx | 0) + salt, cy | 0);
}

const pick = <T,>(arr: T[], h: number): T => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

/**
 * Per-plot style picks, keyed on the plot POLYGON so the 2D map (engine plan)
 * and the 3D bake (artifact plan, same polygons pre-quad) derive identical
 * colors/forms from identical inputs — 2D↔3D identity by construction.
 */
export function styledWallColor(fam: StyleFamily, poly: Pt[]): string {
  return pick(fam.wallPalette, polyHash01(poly, 0));
}
export function styledRoof(fam: StyleFamily, poly: Pt[]): { form: RoofForm; color: string } {
  return { form: pick(fam.roofForms, polyHash01(poly, 101)), color: pick(fam.roofPalette, polyHash01(poly, 202)) };
}
export function styledGatehouseForm(fam: StyleFamily, gateIndex: number, burgId: number): GatehouseForm {
  return pick(fam.gatehouseForms, hash01(gateIndex + 11, burgId));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/systems/worldforge/town/__tests__/architectureStyle.test.ts`
Expected: PASS (5 tests).

---

### Task 2: `getBurgCultureType` — atlas accessor

**Files:**
- Modify: `src/systems/worldforge/bridge/legacySubmapBridge.ts` (add export next to `getBurgNamer`, which starts ~line 81 — mirror its atlas/burg/culture resolution)
- Test: `src/systems/worldforge/bridge/__tests__/legacySubmapBridge.cultureType.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/worldforge/bridge/__tests__/legacySubmapBridge.cultureType.test.ts
import { describe, it, expect } from 'vitest';
import { getBurgCultureType, getBridgeAtlas } from '../legacySubmapBridge';

const WORLD_SEED = 123456789; // seed used across bridge tests; reuse the suite's canonical seed

describe('getBurgCultureType', () => {
  it('returns the FMG culture type string for a real burg', () => {
    const atlas = getBridgeAtlas(WORLD_SEED);
    const burg = atlas.pack.burgs.find((b: any) => b && b.i && b.cell);
    const t = getBurgCultureType(WORLD_SEED, burg.i);
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });

  it('throws for an unknown burg (no fallback)', () => {
    expect(() => getBurgCultureType(WORLD_SEED, 999999)).toThrow();
  });
});
```

> If other bridge tests use a different canonical seed constant, reuse THAT seed — the atlas build is expensive and cached per seed.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/systems/worldforge/bridge/__tests__/legacySubmapBridge.cultureType.test.ts` → FAIL (`getBurgCultureType` not exported).

- [ ] **Step 3: Implement (mirror `getBurgNamer`'s resolution + throw style)**

```ts
/**
 * FMG culture TYPE for a burg ('Highland' | 'Naval' | ... ) — drives the
 * architecture style family. No-fallback: throws if the burg or its culture
 * can't be resolved (same posture as getBurgNamer).
 */
export function getBurgCultureType(worldSeed: number, burgId: number): string {
  const atlas = getBridgeAtlas(worldSeed);
  const burg = atlas.pack.burgs?.[burgId];
  if (!burg) throw new Error(`Cannot resolve burg ${burgId} in world ${worldSeed}`);
  const cultureId = burg.culture ?? 0;
  const culture = atlas.pack.cultures?.[cultureId];
  if (!culture) throw new Error(`Cannot resolve culture ${cultureId} for burg ${burgId} in world ${worldSeed}`);
  if (!culture.type) throw new Error(`Culture ${cultureId} has no type (burg ${burgId}, world ${worldSeed})`);
  return culture.type;
}
```

- [ ] **Step 4: Run tests** — expected PASS.

---

### Task 3: Style stamping in the plan adapter (per-plot color/roof on the artifact plan)

**Files:**
- Modify: `src/systems/worldforge/town/townPlanAdapter.ts` (`toArtifactPlan` gains an optional `family` param; stamps style fields)
- Modify: `src/systems/worldforge/artifacts.ts` (artifact `TownPlan` plot type gains optional `wallColorHex`, `roofColorHex`, `roofForm`, and `role` already exists)
- Modify: `src/systems/worldforge/town/voronoiTownAdapter.ts` (same stamping for the demo path — demo callers pass `STYLE_FAMILIES.temperateFrame` EXPLICITLY)
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` — `canonicalArtifactTownForSite` resolves the family via `styleFamilyForCultureType(getBurgCultureType(worldSeed, site.burgId))` and passes it to `toArtifactPlan`
- Modify: `src/systems/worldforge/town/demoTownPlan.ts` + its three preview consumers only if the adapter signature change requires it (keep demo family = `temperateFrame`, passed explicitly)
- Test: `src/systems/worldforge/town/__tests__/townPlanAdapter.test.ts` (extend)

**CRITICAL:** Do NOT change plot-ID assignment order or the plot filter — business binding depends on it (`groundChunkLoader.test.ts` regression).

- [ ] **Step 1: Write the failing test (extend the adapter suite)**

```ts
// append to src/systems/worldforge/town/__tests__/townPlanAdapter.test.ts
import { STYLE_FAMILIES } from '../architectureStyle';

it('stamps deterministic style fields when a family is provided', () => {
  const fam = STYLE_FAMILIES.highlandStone;
  const a = toArtifactPlan(enginePlanFixture(), 42, fam); // reuse the suite's existing engine-plan fixture/builder
  const b = toArtifactPlan(enginePlanFixture(), 42, fam);
  for (const [i, plot] of a.plan.plots.entries()) {
    expect(plot.wallColorHex).toBeTruthy();
    expect(fam.wallPalette).toContain(plot.wallColorHex!);
    expect(plot.roofForm && fam.roofForms.includes(plot.roofForm)).toBe(true);
    expect(plot.wallColorHex).toBe(b.plan.plots[i].wallColorHex);
    expect(plot.roofForm).toBe(b.plan.plots[i].roofForm);
  }
});

it('plot IDs are unchanged by styling (business-binding invariant)', () => {
  const plain = toArtifactPlan(enginePlanFixture(), 42);
  const styled = toArtifactPlan(enginePlanFixture(), 42, STYLE_FAMILIES.coastalTimber);
  expect(styled.plan.plots.map((p) => p.id)).toEqual(plain.plan.plots.map((p) => p.id));
  expect(styled.plan.plots.map((p) => p.footprint)).toEqual(plain.plan.plots.map((p) => p.footprint));
});
```

(Use whatever fixture the existing suite already builds engine plans with; if it generates via `townEngine`, reuse that call — determinism is what matters, not the fixture shape.)

- [ ] **Step 2: Run to verify failure** — adapter has no third param / fields.

- [ ] **Step 3: Implement**

In `artifacts.ts`, extend the plot type (optional fields — old saves/goldens stay valid):

```ts
// artifacts.ts TownPlan plots entry — ADD:
/** Architecture-style stamps (2026-07-01). Optional: legacy plans omit them. */
wallColorHex?: string;
roofColorHex?: string;
roofForm?: 'gable' | 'hip' | 'steep' | 'flat';
```

In `townPlanAdapter.ts`:

```ts
import { styledWallColor, styledRoof, type StyleFamily } from './architectureStyle';

export function toArtifactPlan(plan: EngineTownPlan, burgId: number, family?: StyleFamily): AdaptedTownPlan {
  // ... existing body unchanged, except each plots.push({...}) gains:
  //   ...(family ? styleStamp(family, pl.polygon) : {}),
  // via this helper:
}

function styleStamp(family: StyleFamily, poly: Pt[]): { wallColorHex: string; roofColorHex: string; roofForm: RoofForm } {
  const roof = styledRoof(family, poly);
  return { wallColorHex: styledWallColor(family, poly), roofColorHex: roof.color, roofForm: roof.form };
}
```

Apply the same stamp in the civic loop (`c.polygon`) and in `voronoiTownAdapter.ts`'s plot emission. In `groundChunkLoader.canonicalArtifactTownForSite`:

```ts
import { styleFamilyForCultureType } from '../town/architectureStyle';
import { getBurgCultureType } from './legacySubmapBridge';
// inside canonicalArtifactTownForSite, replace the toArtifactPlan call:
const family = styleFamilyForCultureType(getBurgCultureType(worldSeed, site.burgId));
const adapted = toArtifactPlan(feetPlan, site.burgId, family);
// and RETURN the family alongside: { ...adapted, family }
```

Extend `AdaptedTownPlan`'s return at this call site (add `family: StyleFamily` to the object `canonicalArtifactTownForSite` returns — type it as `AdaptedTownPlan & { family: StyleFamily }` at the function signature, don't change `AdaptedTownPlan` itself since demo adapters return it without a family).

In `demoTownPlan.ts` pass `STYLE_FAMILIES.temperateFrame` explicitly to `voronoiTownToArtifactPlan`.

- [ ] **Step 4: Run adapter + bridge + integration tests**

Run: `npx vitest run src/systems/worldforge/town src/systems/worldforge/bridge src/systems/worldforge/__integration__`
Expected: PASS. If the pipeline golden test asserts exact plot object shapes, the new OPTIONAL fields may re-freeze a snapshot — inspect the diff: ONLY additive style fields may appear; ids/footprints must be byte-identical.

---

### Task 4: Road gates — split the wall at gatehouse points

**Files:**
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts:952-979` (groundTowns wall-run block)
- Test: `src/systems/worldforge/bridge/__tests__/groundChunkLoader.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
// append to groundChunkLoader.test.ts — reuse the suite's existing local/region/site fixtures
it('opens the wall ring at road gatehouses (not only water gates)', () => {
  const gw = makeGroundWorld(/* same args the suite already uses for a walled town */);
  // A town with gatehouses must yield MULTIPLE wall runs (the ring is split),
  // and no run point may sit within the gate gap radius of a gate point.
  expect(gw.gatehouses.length).toBeGreaterThan(0);
  expect(gw.walls.length).toBeGreaterThan(1);
  for (const g of gw.gatehouses) {
    for (const run of gw.walls) {
      for (const p of run.points) {
        expect(Math.hypot(p.x - g.xM, p.z - g.zM)).toBeGreaterThan(g.gapHalfM * 0.99);
      }
    }
  }
});
```

- [ ] **Step 2: Run to verify failure** — `gw.gatehouses` doesn't exist yet.

- [ ] **Step 3: Implement**

In `groundTowns` (the wall block at `:952`), merge road gates into the split and record gatehouse placements:

```ts
// Above the wall block, per town, alongside gatesM (waterGates):
const roadGatesM = (adapted.walls.gatehouses ?? []).map(([fx, fy]) => ({
  x: (fx - local.bounds.x) * FEET_TO_METERS,
  z: (fy - local.bounds.y) * FEET_TO_METERS,
}));
// Gate gap: street width + shoulder, min 4 m (streets are >= 2.5 m ribbons).
const roadGapHalfM = 4;

// Wall-run split: pass BOTH gate sets. Water gates keep their computed gap;
// simplest correct move — split once with the union using per-gate radii:
const allGates = [
  ...gatesM.map((g) => ({ ...g, gapHalfM })),          // water gates (existing gapHalfM calc)
  ...roadGatesM.map((g) => ({ ...g, gapHalfM: roadGapHalfM })),
];
```

Change `splitWallRingAtGates` to accept per-gate radii (`gates: Array<{x,z,gapHalfM}>`) — inside `gated()`, compare against each gate's own `gapHalfM * gapHalfM`. Update the existing water-gate call site accordingly, and drop the `gatesM.length === 0` closed-ring branch condition to `allGates.length === 0`.

Record placements for Task 5 (tangent from the nearest ring segment):

```ts
// GroundWorld gains: gatehouses: Array<{ xM: number; zM: number; angleRad: number;
//   gapHalfM: number; form: GatehouseForm; colorHex: string; burgId: number }>
for (const [gi, g] of roadGatesM.entries()) {
  planGatehouses.push({
    xM: g.x, zM: g.z,
    angleRad: wallTangentAt(ringM, g),  // helper below
    gapHalfM: roadGapHalfM,
    form: styledGatehouseForm(family, gi, t.burgId),
    colorHex: family.wallTint,
    burgId: t.burgId,
  });
}
```

```ts
/** Yaw of the wall at the ring point nearest to `p` (segment direction). */
function wallTangentAt(ring: Array<{ x: number; z: number }>, p: { x: number; z: number }): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const d = (mx - p.x) ** 2 + (mz - p.z) ** 2;
    if (d < bestD) { bestD = d; best = Math.atan2(b.z - a.z, b.x - a.x); }
  }
  return best;
}
```

Thread `planGatehouses` through `groundTowns`'s return + `GroundWorld` (field `gatehouses`) exactly like `planWalls`. Also tint the wall runs: `planWalls.push({ points: run, widthM: 1.2, colorHex: family.wallTint })` (add optional `colorHex` to `GroundPolyline`).

- [ ] **Step 4: Run the bridge suite** — `npx vitest run src/systems/worldforge/bridge` → PASS, including the untouched business-binding regression.

---

### Task 5: Gatehouse meshes (`gateGeometry.ts`) + wall tint

**Files:**
- Create: `src/systems/world3d/gateGeometry.ts`
- Test: `src/systems/world3d/__tests__/gateGeometry.test.ts`
- Modify: `src/systems/world3d/types.ts` — `ChunkData` gains `gatehouses?: Array<{ x: number; y: number; angleRad: number; gapHalfM: number; form: 'twinTowers'|'tunnelBlock'|'singleTower'; colorHex: string }>` (grid space, like sites); `ChunkMeshBundle` gains `gates?: ChunkGeometryArrays & { colors?: Float32Array }`; `ClippedPolyline` gains `colorHex?: string`
- Modify: `src/systems/world3d/chunkBundle.ts` — call `buildGateMesh(data)` alongside `buildWallMesh`
- Modify: `src/systems/world3d/wallGeometry.ts` — emit per-vertex `colors` from `ring.colorHex` (default the current `#9a9387`), same pattern as `deckGeometry`
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` `loadChunk` (~`:1315`) — map `ground.gatehouses` whose center falls in this chunk into `ChunkData.gatehouses` (convert meters → grid via the same conversion sites use); carry `colorHex` through `clipGroundPolylineToChunk`
- Modify: `src/components/World3D/World3DScene.tsx` — `WallPiece` material becomes `vertexColors` (white base); add `GatePiece` rendering `bundle.gates` (clone of `WallPiece` with `vertexColors`)

- [ ] **Step 1: Write the failing geometry test**

```ts
// src/systems/world3d/__tests__/gateGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { buildGateMesh } from '../gateGeometry';
import type { ChunkData } from '../types';

function chunkWithGate(form: 'twinTowers' | 'tunnelBlock' | 'singleTower'): ChunkData {
  const res = 4;
  return {
    cx: 0, cy: 0, resolution: res,
    heights: new Float32Array(res * res).fill(50),
    biomeIds: Array(res * res).fill('grass'),
    rivers: [], roads: [], sites: [],
    gatehouses: [{ x: 2, y: 2, angleRad: 0.3, gapHalfM: 4, form, colorHex: '#8a877f' }],
  };
}

for (const form of ['twinTowers', 'tunnelBlock', 'singleTower'] as const) {
  it(`emits well-formed geometry for ${form}`, () => {
    const g = buildGateMesh(chunkWithGate(form));
    expect(g.positions.length).toBeGreaterThan(0);
    expect(g.positions.length % 3).toBe(0);
    expect(g.normals.length).toBe(g.positions.length);
    expect(g.colors.length).toBe(g.positions.length);
    const maxIndex = Math.max(...Array.from(g.indices));
    expect(maxIndex).toBeLessThan(g.positions.length / 3);
    expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
  });
}

it('returns empty arrays when no gatehouses', () => {
  const d = chunkWithGate('twinTowers'); d.gatehouses = [];
  expect(buildGateMesh(d).positions.length).toBe(0);
});

it('towers rise above the rampart height', () => {
  const g = buildGateMesh(chunkWithGate('twinTowers'));
  let maxY = -Infinity;
  for (let i = 1; i < g.positions.length; i += 3) maxY = Math.max(maxY, g.positions[i]);
  // Wall is 3.2 m (wallGeometry.WALL_HEIGHT_M); gate towers must exceed it.
  expect(maxY).toBeGreaterThan(3.2 + heightOfTerrainAtGate() - 1e6 * 0); // see note
});
```

> For the height assertion, compute the terrain Y the same way the builder does (flat 50-height fixture → constant), or simply assert `maxY > minY + 4.5` (tower height over base). Use the simpler relative assertion.

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement `gateGeometry.ts`**

```ts
/**
 * @file gateGeometry.ts
 * Procedural gatehouse models at town road-gate openings (styled-architecture
 * slice, 2026-07-01). Assembled from oriented boxes into one vertex-colored
 * mesh per chunk — same transferable-arrays contract as wallGeometry/deckGeometry.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const TOWER_H_M = 5.5;       // above wall's 3.2 m rampart
const TOWER_SIDE_M = 3;
const LINTEL_H_M = 1.2;      // beam over the gap
const TUNNEL_DEPTH_M = 5;    // tunnelBlock: how far the block runs along the road

type GateMesh = ChunkGeometryArrays & { colors: Float32Array };

export function buildGateMesh(data: ChunkData): GateMesh {
  const gates = data.gatehouses ?? [];
  const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [];
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255,
  ];

  /** Push an axis-defined box, yawed by `ang` around its center (cx, cz), base at baseY. */
  const pushBox = (cx: number, cz: number, baseY: number, w: number, h: number, d: number, ang: number, color: [number, number, number]) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const corners: Array<[number, number]> = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
      .map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
    const base = positions.length / 3;
    for (const y of [baseY, baseY + h]) {
      for (const [x, z] of corners) { positions.push(x, y, z); normals.push(0, 1, 0); colors.push(...color); }
    }
    // 4 sides + top, both windings (matches wallGeometry's no-cull posture).
    const quad = (a: number, b: number, cc: number, dd: number) => {
      indices.push(a, b, cc, cc, dd, a, cc, b, a, a, dd, cc);
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(base + i, base + j, base + 4 + j, base + 4 + i);
    }
    quad(base + 4, base + 5, base + 6, base + 7); // top
  };

  for (const g of gates) {
    const local = gridPointToLocal(g.x, g.y, data.cx, data.cy);
    const baseY = heightAt(data, g.x, g.y) - 0.4; // sink footing like the wall
    const color = rgb(g.colorHex);
    const along = (dist: number): [number, number] =>
      [local.x + Math.cos(g.angleRad) * dist, local.z + Math.sin(g.angleRad) * dist];
    const off = g.gapHalfM + TOWER_SIDE_M / 2;

    if (g.form === 'twinTowers') {
      for (const side of [-1, 1]) {
        const [tx, tz] = along(side * off);
        pushBox(tx, tz, baseY, TOWER_SIDE_M, TOWER_H_M, TOWER_SIDE_M, g.angleRad, color);
      }
      // Lintel beam spanning the gap, sitting near the tower tops.
      pushBox(local.x, local.z, baseY + TOWER_H_M - LINTEL_H_M, off * 2 + TOWER_SIDE_M, LINTEL_H_M, 1.2, g.angleRad, color);
    } else if (g.form === 'singleTower') {
      const [tx, tz] = along(off);
      pushBox(tx, tz, baseY, TOWER_SIDE_M + 1, TOWER_H_M, TOWER_SIDE_M + 1, g.angleRad, color);
    } else { // tunnelBlock: two jamb walls along the road + a roof slab over the gap
      const jambOff = g.gapHalfM + 0.8;
      for (const side of [-1, 1]) {
        const [jx, jz] = along(side * jambOff);
        pushBox(jx, jz, baseY, 1.6, TOWER_H_M - 1, TUNNEL_DEPTH_M, g.angleRad + Math.PI / 2, color);
      }
      pushBox(local.x, local.z, baseY + TOWER_H_M - 1, jambOff * 2 + 1.6, 1.4, TUNNEL_DEPTH_M, g.angleRad, color);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}

// Same nearest-vertex terrain sampler as wallGeometry.heightAt (duplicated
// deliberately — both files keep their samplers private and parallel).
function heightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / WORLD3D_CONFIG.METERS_PER_CELL;
  const minGX = data.cx * span, minGY = data.cy * span;
  const tx = span === 0 ? 0 : (gx - minGX) / span;
  const ty = span === 0 ? 0 : (gy - minGY) / span;
  const i = Math.max(0, Math.min(res - 1, Math.round(tx * (res - 1))));
  const j = Math.max(0, Math.min(res - 1, Math.round(ty * (res - 1))));
  return heightToMeters(data.heights[j * res + i]);
}
```

Wire-up:
- `chunkBundle.ts`: `gates: buildGateMesh(data)` next to `walls: buildWallMesh(data)` (only include when non-empty, matching how walls/decks are conditionally attached).
- `loadChunk` in `groundChunkLoader.ts`: convert each `ground.gatehouses` entry whose meter position falls inside the chunk into grid space (use the same meters→grid conversion the walls/decks block at `:1315-1330` uses) and attach as `ChunkData.gatehouses`.
- `wallGeometry.ts`: add `colors` output — fill from `ring.colorHex ?? '#9a9387'` per vertex (copy `deckGeometry`'s rgb helper).
- `World3DScene.tsx`: `WallPiece` material → `<meshStandardMaterial vertexColors color="#ffffff" roughness={0.95} side={THREE.DoubleSide} />`; add `GatePiece` (copy of `DeckPiece` reading `chunk.bundle.gates`); render it in the chunk group wherever `WallPiece`/`DeckPiece` are rendered.

- [ ] **Step 4: Run world3d + bridge suites**

Run: `npx vitest run src/systems/world3d src/systems/worldforge/bridge`
Expected: PASS (existing `wallGeometry` tests may need the new `colors` field asserted-or-ignored; extend them to assert `colors.length === positions.length`).

---

### Task 6: Dock pilings, bridge piers/railings/arch (`deckGeometry.ts`)

**Files:**
- Modify: `src/systems/world3d/types.ts` — `ChunkData.decks` entries gain `detail?: { pilingSpacingM: number; railing: boolean; archRiseM: number }`
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts` — `GroundDeck` gains `detail`; `canonicalTownWaterAndDecks` stamps `detail: family.deckDetail` (resolve the family the same way as Task 3 — this function already loads the atlas/plan, add the culture lookup); the deck clip at `:1324` carries `detail` through
- Modify: `src/systems/world3d/deckGeometry.ts` — pilings + railings + arch
- Test: `src/systems/world3d/__tests__/deckGeometry.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

```ts
// append to deckGeometry.test.ts — reuse its existing deck fixture builder
it('emits pilings below the deck when detail is present', () => {
  const d = deckFixture('dock');
  d.decks![0].detail = { pilingSpacingM: 2, railing: false, archRiseM: 0 };
  const withPosts = buildDeckMesh(d);
  const plain = buildDeckMesh(deckFixture('dock'));
  expect(withPosts.positions.length).toBeGreaterThan(plain.positions.length);
  // Some vertices must sit well below the deck underside (posts descend).
  let minY = Infinity;
  for (let i = 1; i < withPosts.positions.length; i += 3) minY = Math.min(minY, withPosts.positions[i]);
  expect(minY).toBeLessThan(d.decks![0].topY - 1.0);
});

it('adds railing geometry when detail.railing', () => {
  const base = deckFixture('bridge');
  base.decks![0].detail = { pilingSpacingM: 3, railing: false, archRiseM: 0 };
  const noRail = buildDeckMesh(base);
  base.decks![0].detail!.railing = true;
  const rail = buildDeckMesh(base);
  expect(rail.positions.length).toBeGreaterThan(noRail.positions.length);
  // Railing tops rise above the deck surface.
  let maxY = -Infinity;
  for (let i = 1; i < rail.positions.length; i += 3) maxY = Math.max(maxY, rail.positions[i]);
  expect(maxY).toBeGreaterThan(base.decks![0].topY + 0.5);
});

it('arches a bridge: mid-span tops exceed topY', () => {
  const b = deckFixture('bridge');
  b.decks![0].detail = { pilingSpacingM: 3, railing: false, archRiseM: 1.5 };
  const g = buildDeckMesh(b);
  let maxY = -Infinity;
  for (let i = 1; i < g.positions.length; i += 3) maxY = Math.max(maxY, g.positions[i]);
  expect(maxY).toBeGreaterThanOrEqual(b.decks![0].topY + 1.0);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement in `buildDeckMesh`** (after the existing top/skirt emission, per deck):

```ts
const detail = deck.detail;
if (detail) {
  const [cr2, cg2, cb2] = DECK_COLOR[deck.kind];
  const post = (px: number, pz: number, topYp: number, depth: number, side: number) => {
    // Square post, axis-aligned is fine at 0.25 m scale.
    pushPostBox(positions, indices, normals, colors, px, pz, topYp - depth, depth, 0.25, [cr2 * 0.8, cg2 * 0.8, cb2 * 0.8]);
  };
  // Long axis = edge 0→1 of the quad (docks/bridges are built as oriented
  // rectangles by pierQuad); posts march along both long edges.
  const A = local[0], B = local[1], C = local[2], D = local[3];
  const lenAB = Math.hypot(B.x - A.x, B.z - A.z);
  const n = Math.max(2, Math.round(lenAB / detail.pilingSpacingM));
  const PILING_DEPTH_M = 3;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    post(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, bot, PILING_DEPTH_M, -1);
    post(D.x + (C.x - D.x) * t, D.z + (C.z - D.z) * t, bot, PILING_DEPTH_M, 1);
  }
  if (detail.railing) {
    // Rail = thin long box atop each long edge, 1 m high, 0.15 m thick.
    pushRailBox(positions, indices, normals, colors, A, B, top, [cr2 * 1.1, cg2 * 1.1, cb2 * 1.1]);
    pushRailBox(positions, indices, normals, colors, D, C, top, [cr2 * 1.1, cg2 * 1.1, cb2 * 1.1]);
  }
}
```

`pushPostBox`/`pushRailBox` are local helpers emitting axis-aligned boxes into the shared arrays (same structure as `gateGeometry.pushBox` but simpler — no yaw for posts; the rail box spans from point a to point b: center = midpoint, length = distance, yaw = atan2). Copy the box emission from `gateGeometry.ts` (Task 5) and slim it.

**Arch:** when `deck.kind === 'bridge' && detail.archRiseM > 0`, replace the flat fan top with strips: subdivide the long axis into 8 slices; slice `t` gets `topY + detail.archRiseM * 4 * t * (1 - t)` (parabola, 0 at ends). Emit each strip as two triangles (both windings) and skirt the two long edges per-slice. Keep docks (and archRiseM = 0) on the existing fan path.

- [ ] **Step 4: Run** `npx vitest run src/systems/world3d/__tests__/deckGeometry.test.ts` → PASS, then the full world3d suite.

---

### Task 7: Styled building models in the 3D scene (roof forms, palettes, chimneys, explicit role)

**Files:**
- Create: `src/systems/world3d/buildingModels.ts` (roof-form geometry arrays)
- Test: `src/systems/world3d/__tests__/buildingModels.test.ts`
- Modify: `src/systems/world3d/types.ts` — `ChunkData` site + `ChunkSite` gain `role?: string`, `roofForm?: 'gable'|'hip'|'steep'|'flat'`, `roofColorHex?: string`, `chimney?: boolean`
- Modify: `src/systems/world3d/siteGeometry.ts` — pass the four new fields through (one line each in the site mapping)
- Modify: `src/systems/worldforge/bridge/groundChunkLoader.ts:1362` region — building sites now carry `role: b.role`, `colorHex: b.wallColorHex ?? (b.role === 'market' ? '#c8923f' : '#b09a72')`, `roofForm: b.roofForm`, `roofColorHex: b.roofColorHex`, `chimney: family.chimneys` — the `buildings` entries in `groundTowns` must copy `wallColorHex/roofColorHex/roofForm` from the (now-stamped) plan plots when they are built (find where `plan.plots` → `buildings` around `:1030-1060` and carry the fields)
- Modify: `src/components/World3D/World3DScene.tsx` — `SiteBuilding`: role from `s.role` (kill the color-sniffing at `:263`), roof switches on `s.roofForm`, roof color `s.roofColorHex ?? '#7a4a32'`, chimney box when `s.chimney`

- [ ] **Step 1: Write failing tests for the roof builders**

```ts
// src/systems/world3d/__tests__/buildingModels.test.ts
import { describe, it, expect } from 'vitest';
import { buildRoofGeometry } from '../buildingModels';

for (const form of ['gable', 'hip', 'steep', 'flat'] as const) {
  it(`${form} roof geometry is well-formed`, () => {
    const g = buildRoofGeometry(form, 8, 6, 2);
    expect(g.positions.length).toBeGreaterThan(0);
    expect(g.positions.length % 3).toBe(0);
    expect(g.normals.length).toBe(g.positions.length);
    expect(Math.max(...Array.from(g.indices))).toBeLessThan(g.positions.length / 3);
    expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
  });
}

it('gable peaks at the ridge height; flat stays low', () => {
  const gable = buildRoofGeometry('gable', 8, 6, 2);
  const flat = buildRoofGeometry('flat', 8, 6, 2);
  const maxY = (g: { positions: Float32Array }) => {
    let m = -Infinity;
    for (let i = 1; i < g.positions.length; i += 3) m = Math.max(m, g.positions[i]);
    return m;
  };
  expect(maxY(gable)).toBeCloseTo(2, 5);
  expect(maxY(flat)).toBeLessThan(1);
});

it('steep is taller than gable for the same input rise', () => {
  // steep multiplies the rise internally
  const gable = buildRoofGeometry('gable', 8, 6, 2);
  const steep = buildRoofGeometry('steep', 8, 6, 2);
  const maxY = (g: { positions: Float32Array }) => {
    let m = -Infinity;
    for (let i = 1; i < g.positions.length; i += 3) m = Math.max(m, g.positions[i]);
    return m;
  };
  expect(maxY(steep)).toBeGreaterThan(maxY(gable));
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `buildingModels.ts`**

```ts
/**
 * @file buildingModels.ts
 * Procedural roof-form geometry for styled town buildings (2026-07-01).
 * Origin at the roof BASE center; walls place it at wall-top Y. Plain arrays
 * so the React layer wraps them in BufferGeometry (memoized per form+dims).
 */
import type { ChunkGeometryArrays } from './types';
import type { RoofForm } from '../worldforge/town/architectureStyle';

export function buildRoofGeometry(form: RoofForm, width: number, depth: number, rise: number): ChunkGeometryArrays {
  switch (form) {
    case 'gable': return gable(width, depth, rise);
    case 'steep': return gable(width, depth, rise * 1.7);
    case 'flat': return flatParapet(width, depth);
    case 'hip': return hip(width, depth, rise);
  }
}

/** Ridge prism: two sloped faces + two triangular gable ends. Ridge runs along X (width). */
function gable(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  // 6 verts: 4 eaves corners + 2 ridge ends.
  const P: number[][] = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], // eaves 0-3
    [-hw, h, 0], [hw, h, 0],                                 // ridge 4-5
  ];
  const tris = [
    [0, 1, 5], [5, 4, 0],   // north slope
    [2, 3, 4], [4, 5, 2],   // south slope
    [3, 0, 4],              // west gable end
    [1, 2, 5],              // east gable end
  ];
  return fromTris(P, tris);
}

/** Pyramid (the current cone-as-pyramid, made explicit). Apex at center. */
function hip(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  const P: number[][] = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, 0]];
  const tris = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  return fromTris(P, tris);
}

/** Flat roof slab + parapet rim (0.5 m lip). */
function flatParapet(w: number, d: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2, slab = 0.25, lip = 0.5, t = 0.3;
  const P: number[][] = [];
  const tris: number[][] = [];
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
    const b = P.length;
    P.push([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
           [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
    const q = (a: number, bb: number, c: number, dd: number) => tris.push([a, bb, c], [c, dd, a]);
    q(b + 4, b + 5, b + 6, b + 7);                       // top
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b + i, b + j, b + 4 + j, b + 4 + i); }
  };
  box(-hw, hw, -hd, hd, 0, slab);                        // slab
  box(-hw, hw, -hd, -hd + t, slab, slab + lip);          // rims
  box(-hw, hw, hd - t, hd, slab, slab + lip);
  box(-hw, -hw + t, -hd, hd, slab, slab + lip);
  box(hw - t, hw, -hd, hd, slab, slab + lip);
  return fromTris(P, tris);
}

/** Faceted mesh from shared verts: duplicate per-face for flat normals, both windings. */
function fromTris(P: number[][], tris: number[][]): ChunkGeometryArrays {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  for (const [a, b, c] of tris) {
    const A = P[a], B = P[b], C = P[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = positions.length / 3;
    for (const V of [A, B, C]) { positions.push(V[0], V[1], V[2]); normals.push(nx, ny, nz); }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base); // both windings
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals) };
}
```

- [ ] **Step 4: Run the buildingModels test** → PASS.

- [ ] **Step 5: Wire the data through**

1. `groundTowns` (plots → buildings, ~`:1030-1060`): copy `wallColorHex`, `roofColorHex`, `roofForm` from each plan plot onto the pushed building entry, plus `chimney: family.chimneys`.
2. `loadChunk` site mapping (`:1362`): set `role: b.role`, `colorHex: b.wallColorHex ?? (b.role === 'market' ? '#c8923f' : '#b09a72')`, `roofForm: b.roofForm`, `roofColorHex: b.roofColorHex`, `chimney: b.chimney` (the `??` here is legacy-compat for non-styled callers of the loader, e.g. continent mode — it is not a style fallback; canonical towns always stamp).
3. `siteGeometry.buildSiteMeshes`: pass the four fields through to `ChunkSite`.

- [ ] **Step 6: Update `SiteBuilding` in `World3DScene.tsx`**

```tsx
// role: EXPLICIT field replaces color-sniffing (line 263)
const role = s.role ?? s.kind;

// roof: memoized BufferGeometry per (form, w, d, h) — module-level cache
const roofGeom = useRoofGeometry(s.roofForm ?? 'hip', roof.width, roof.depth, rHeight);
// ...
<mesh ref={roofRef} position={[0, (s.boxHeight ?? 0), 0]} geometry={roofGeom} castShadow={SHADOWS}>
  <meshStandardMaterial color={s.roofColorHex ?? '#7a4a32'} flatShading side={THREE.DoubleSide} map={roofTex || null} />
</mesh>
{/* chimney: at the ridge/apex end, only when the family builds them and the shell is solid */}
{s.chimney && !s.parts && (s.roofForm ?? 'hip') !== 'flat' && (
  <mesh position={[roof.width * 0.3, (s.boxHeight ?? 0) + rHeight * 0.9, 0]} castShadow={SHADOWS}>
    <boxGeometry args={[0.6, 1.4, 0.6]} />
    <meshStandardMaterial color="#6e6c66" />
  </mesh>
)}
```

```tsx
// module scope — geometry cache so 200 buildings share a handful of roofs
const roofGeomCache = new Map<string, THREE.BufferGeometry>();
function useRoofGeometry(form: RoofForm, w: number, d: number, h: number): THREE.BufferGeometry {
  return React.useMemo(() => {
    const key = `${form}|${w.toFixed(1)}|${d.toFixed(1)}|${h.toFixed(1)}`;
    let geo = roofGeomCache.get(key);
    if (!geo) {
      const a = buildRoofGeometry(form, w, d, h);
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(a.indices, 1));
      roofGeomCache.set(key, geo);
    }
    return geo;
  }, [form, w, d, h]);
}
```

Note the roof mesh no longer uses `scale` (the geometry is built at real size) and its position drops the `rHeight * 0.5` offset and the `Math.PI / 4` yaw (both were cone artifacts). The existing roof auto-hide `useFrame` logic keeps working (it toggles `roof.visible` on the ref).

- [ ] **Step 7: Run the World3D component tests + full verification suite** — the lifecycle tests assert on scene structure; if any snapshot pins the cone geometry, update it deliberately.

---

### Task 8: 2D palette parity (`TownPlanView`)

**Files:**
- Modify: `src/components/Worldforge/TownPlanView.tsx` (fill at `:334`)
- Modify: the drill-view caller that renders `TownPlanView` for a burg (find with `Grep "TownPlanView" src/components` — it's the map-drill leaf) to resolve + pass `styleFamily`
- Test: `src/components/Worldforge/__tests__/TownPlanView.test.tsx` (extend or create alongside existing component tests)

- [ ] **Step 1: Write the failing test**

```tsx
it('uses family wall palette when styleFamily is provided', () => {
  const fam = STYLE_FAMILIES.highlandStone;
  const { container } = render(<TownPlanView plan={planFixture} styleFamily={fam} /* + existing required props */ />);
  const fills = new Set(
    Array.from(container.querySelectorAll('[data-plot], polygon, path'))
      .map((el) => el.getAttribute('fill'))
      .filter(Boolean),
  );
  // At least one plot must be painted from the family's palette.
  expect(fam.wallPalette.some((c) => fills.has(c))).toBe(true);
});
```

(Adapt the selector to how TownPlanView actually emits plot shapes — check the existing suite's queries first.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```tsx
// TownPlanView props: + styleFamily?: StyleFamily
// fill logic at :334 becomes:
fill={
  styleFamily
    ? styledWallColor(styleFamily, pl.polygon)
    : pl.buildingType ? BUILDING_FILL[pl.buildingType]
    : pl.kind === 'interior' ? '#b89a72' : '#9c7b54'
}
```

In the drill-view caller: `styleFamily={styleFamilyForCultureType(getBurgCultureType(worldSeed, burgId))}` (it already has `worldSeed` + `burgId` to fetch the canonical plan). Demo previews (`AgentSimPreview` etc.) pass `STYLE_FAMILIES.temperateFrame` if they render TownPlanView.

- [ ] **Step 4: Run the Worldforge component suite** — `npx vitest run src/components/Worldforge` → PASS.

---

### Task 9: Full verification + visual proof

- [ ] **Step 1: Full suite**

Run the verification suite from the header. Expected: all green (count will exceed the prior 385 with the new tests). Known background noise per memory: ~346 empty test files elsewhere — not in these paths.

- [ ] **Step 2: Types**

Run: `npx tsc --noEmit`
Expected: zero NEW errors in touched files (pre-existing `src/commands`/BattleMap errors are known noise).

- [ ] **Step 3: 2D↔3D identity guardrail**

Run: `npx tsx .agent/scratch/townIdentityProof.mjs` → regenerate `town-identity-proof.png`, EYEBALL it: same wall ring/wards/streets/civic between 2D and 3D input; plot quads still align. (If the scratch script was cleaned up, restore it from the 2026-06-27 handover's description: it renders the canonical 2D plan and the 3D-transformed input side by side for burg "Agrannoce".)

- [ ] **Step 4: Visual inspection (visual-inspection rule — REQUIRED)**

Using the headless shoot rig (`shoot.mjs`, see memory `preview-screenshot-3d-capture`): capture ground-mode screenshots of three towns with different culture types — one Highland, one Naval/Lake, one River (pick burgs by checking `atlas.pack.cultures[burg.culture].type` in a scratch script). Verify by eye:
  - three visibly DISTINCT palettes/roofscapes (stone+slate vs weathered timber vs half-timber),
  - gabled/steep/flat roofs mixed within a town (not all pyramids),
  - wall opens at road gates with a gatehouse structure standing there,
  - streets pass THROUGH the openings,
  - docks stand on posts; bridges have piers/railings (and an arch where the family has one).
Save shots under `.agent/scratch/` (gitignored proof area) and show them to Remy.

- [ ] **Step 5: Update program docs**

Mark deferred follow-up #1 as done in a short handover note under `docs/superpowers/plans/` and update the memory file `worldforge-canonical-town.md` (add: styled-architecture slice landed — gates/gatehouses/deck detail/roof variety; follow-up #2 roster parity still open).

---

## Self-review notes (already applied)

- **Spec coverage:** §1→Task 1-2, §2→Tasks 5/7, §3→Task 4, §4→Task 5, §5→Task 6, §6→Task 8, §7→Task 9 + per-task TDD. ✔
- **Business-binding invariant** explicitly tested in Task 3. ✔
- **Color-sniffed role** (`World3DScene.tsx:263`) is removed in Task 7 — REQUIRED, otherwise palette walls silently lose their wall/roof textures. ✔
- **`??` legacy-compat vs no-fallback:** the `colorHex`/roof `??` defaults in Tasks 7 only cover non-Worldforge sites (continent mode) that never had styling; canonical towns always stamp. This is compatibility, not a silent style fallback.
- **Type consistency:** `RoofForm`/`GatehouseForm`/`DeckDetail` defined once in `architectureStyle.ts`; world3d imports the type (type-only import keeps the worker bundle clean).
