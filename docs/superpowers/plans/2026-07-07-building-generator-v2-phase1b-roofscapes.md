# Building Generator v2 — Phase 1B: Roofscapes + Regional Styles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-topped/whole-rectangle roofs with solved pitched roofscapes that follow the irregular footprints — hips, gables over wings, valleys, chimneys rising from the actual hearths, dormers, tower caps — dressed by a style grammar keyed to culture, climate, and wealth.

**Architecture:** The footprint generator starts emitting its exact mass decomposition (main block, wings, tower) instead of discarding it; a new pure roof solver turns masses + style + hearth data into a `RoofPlan`; `resolveStyle` extends the existing culture-keyed `architectureStyle.ts` family system with climate and wealth drivers (age stubbed for Phase 3) into a `StyleResolved` stored on the plan so 2D and 3D read one answer. The 3D build raises the solved roof instead of `buildRoofGeometry`'s single rectangle prism.

**Tech Stack:** TypeScript, Vitest, worldforge seed paths, pure data (zero `three` imports in solver/grammar).

**Spec:** `docs/superpowers/specs/2026-07-07-building-generator-v2-living-buildings.md` (Ambition 2)

**Parallel-track note:** Phase 1A runs in parallel and also touches `blueprintTypes.ts` (its Task 3) and `generateBuilding.ts` (its Task 8). Coordinate: if 1A's Task 3 has not landed yet, land THIS plan's Task 1 contract fields together with it (one freeze); if it has, this plan's Task 1 is a deliberate additive re-freeze. Never edit `generateBuilding.ts` while a 1A task holds it — sequence via the Agora lock discipline (`agora-coordination` skill).

## Global Constraints

- Feet-canon 5 ft grid; pure data; zero `three` imports in `src/systems/worldforge/**`.
- Deterministic via `rngFromPath(streamPath(path, '<concern>'))`; new stream names for new concerns; never `Math.random()`.
- No fallback: unknown culture type / climate / building type throws (matches `styleFamilyForCultureType`).
- US spelling. No commits, no branches — master only, tests green per task, 2am auto-snapshot.
- Style never moves walls: geometry identity under style changes is a pinned test.
- Visual eyeball required at the end (Remy's rule) — skyline + close-ups, two cultures, three wealth tiers.

## File Structure

```
src/systems/worldforge/interior/
  blueprintTypes.ts       MODIFY  Task 1 (masses, RoofPlan, StyleResolved fields) — deliberate re-freeze
  footprint.ts            MODIFY  Task 1 (emit FootprintMass[])
  generateBuilding.ts     MODIFY  Task 4 (style input → resolveStyle → solveRoof → plan.roof)
  roofPlan.ts             CREATE  Task 3 (the solver)
src/systems/worldforge/town/
  architectureStyle.ts    MODIFY  Task 2 (resolveStyle: climate + wealth + age-stub drivers)
src/systems/world3d/
  buildingModels.ts       MODIFY  Task 5 (buildRoofMeshData from RoofPlan)
src/systems/worldforge/bridge/
  interiorParts.ts        MODIFY  Task 5/7 (consume solved roof + StyleResolved materials; thread StyleContext)
src/systems/worldforge/interior/renderBlueprintSvg.ts  MODIFY  Task 6 (roof-plan overlay)
src/components/DesignPreview/steps/PreviewBlueprint.tsx MODIFY Task 6 (roof toggle)
```

Dependency order: 1 → 2 → 3 → 4 → (5, 6 parallel) → 7 → 8.

---

### Task 1: Contract — footprint masses + roof/style fields

The footprint generator internally rolls a main rect, wings, and a tower (`footprint.ts:56-83`) then throws the rects away, keeping only cells. The roof solver needs the exact decomposition — emit it.

**Files:**
- Modify: `src/systems/worldforge/interior/footprint.ts` (`Footprint.masses`, populate in `genFootprint`, transform in `clampFootprint`)
- Modify: `src/systems/worldforge/interior/blueprintTypes.ts` (additive fields; deliberate re-freeze)
- Test: `src/systems/worldforge/interior/__tests__/footprint.test.ts` (extend)

**Interfaces (produces — verbatim):**

```ts
// footprint.ts
export interface FootprintMass {
  kind: 'main' | 'wing' | 'tower';
  /** Post-normalize cell coords (same frame as Footprint.cells). */
  x: number; y: number; w: number; h: number;
}
export interface Footprint { cols: number; rows: number; occ: boolean[][]; cells: Cell[];
  /** Exact decomposition, main first. Union of masses === cells. */
  masses: FootprintMass[];
}

// blueprintTypes.ts (all additive)
export interface RoofChimney { x: Feet; y: Feet; topFt: Feet; }
export interface RoofDormer { x: Feet; y: Feet; /** outward normal of the roof side it pierces */ nx: number; ny: number; }
export interface RoofTowerCap { x: Feet; y: Feet; w: Feet; d: Feet; apexFt: Feet; form: 'pyramid' | 'cone'; }
/** One planar roof face: 3-4 corners in feet, z = height above wall-top. */
export interface RoofPlane { pts: Array<[Feet, Feet, Feet]>; }
export interface RoofPlan {
  planes: RoofPlane[];
  ridges: Array<{ x1: Feet; y1: Feet; x2: Feet; y2: Feet; zFt: Feet }>;
  valleys: Array<{ x1: Feet; y1: Feet; x2: Feet; y2: Feet }>;
  chimneys: RoofChimney[];
  dormers: RoofDormer[];
  towerCaps: RoofTowerCap[];
  pitchRiseFt: Feet;
  eaveOverhangFt: Feet;
}
/** The resolved dress: one answer for 2D and 3D. Never affects geometry
 *  below the wall-top (pinned by the style-identity test). */
export interface StyleResolved {
  familyId: string;             // architectureStyle StyleFamily['id']
  wallColor: string; roofColor: string; trimColor: string;
  roofForm: 'gable' | 'hip' | 'steep' | 'flat';
  pitchRiseFt: Feet; eaveOverhangFt: Feet;
  /** Wealth finish tier drives palette pick + ornament flag. */
  finishTier: 'poor' | 'common' | 'wealthy';
  ornament: boolean;
  raisedPlinth: boolean;        // marsh climate
}
// BlueprintPlan additions:
//   masses: FootprintMass[];          (always set — echoes Footprint.masses)
//   roof?: RoofPlan;                  (set when style context provided; Task 4)
//   styleResolved?: StyleResolved;    (set when style context provided; Task 4)
```

- [ ] **Step 1: Write the failing test** (extend `footprint.test.ts`)

```ts
it('masses exactly tile the footprint: union === cells, main first — 100 seeds × all types', () => {
  for (const type of ALL_TYPES) {
    for (let seed = 0; seed < 100; seed++) {
      const fp = genFootprint(rootSeedPath(seed), type);
      expect(fp.masses[0].kind).toBe('main');
      const union = new Set<string>();
      for (const m of fp.masses) {
        for (let y = m.y; y < m.y + m.h; y++)
          for (let x = m.x; x < m.x + m.w; x++) union.add(`${x},${y}`);
      }
      expect(union.size >= fp.cells.length).toBe(true); // masses may overlap each other
      for (const c of fp.cells) expect(union.has(`${c.cx},${c.cy}`)).toBe(true);
      for (const key of union) {
        const [x, y] = key.split(',').map(Number);
        expect(fp.occ[y]?.[x]).toBe(true); // no mass cell outside the footprint
      }
    }
  }
});

it('clampFootprint transforms masses consistently with cells', () => {
  const fp = genFootprint(rootSeedPath(4), 'manor');
  const clamped = clampFootprint(fp, Math.max(4, fp.cols - 2), fp.rows);
  // every clamped mass stays inside the clamped grid
  for (const m of clamped.masses) {
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.w).toBeLessThanOrEqual(clamped.cols);
  }
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/systems/worldforge/interior/__tests__/footprint.test.ts`.
- [ ] **Step 3: Implement.** In `genFootprint`, the rects already exist pre-normalize — carry each `Rect` with its kind through the normalize step (apply the same min-cell offset), intersect with the occupied set after the bare-rectangle repair loop (a repair wing appends a `wing` mass). `clampFootprint` clips each mass to the clamp window and drops empty ones (if the MAIN empties, throw — a clamp that severe is a contradictory lot). In `generateBuilding.ts` set `masses: fp.cells ? fp.masses : []` — plainly `masses: fp.masses` — when assembling the plan. **RNG discipline:** carrying rects adds ZERO draws; the footprint stream stays byte-stable (the pinned draw-sequence golden from v1 A8 is the guard — it must stay green).
- [ ] **Step 4: Run to verify pass** + FULL interior suite + `npx tsc --noEmit`. The `generateBuilding` golden gains a `masses` field — regenerate ONLY the affected snapshots and eyeball the diff is additive (new field, nothing else moved).

---

### Task 2: `resolveStyle` — climate + wealth join the culture driver

Extend the existing family system (`architectureStyle.ts`) with the two new approved drivers; the age driver lands as a typed stub (Phase 3 fills it).

**Files:**
- Modify: `src/systems/worldforge/town/architectureStyle.ts`
- Test: `src/systems/worldforge/town/__tests__/architectureStyle.test.ts` (extend or create)

**Interfaces:**

```ts
export type ClimateClass = 'temperate' | 'cold' | 'arid' | 'marsh';
export interface ResolveStyleInput {
  cultureType: string;                    // FMG culture type (existing mapping)
  climate: ClimateClass;
  wealth: 'poor' | 'common' | 'wealthy';
  /** Phase 3 driver — accepted now, only 'new' has effect rules. */
  ageBand?: 'new' | 'aged' | 'old' | 'ancient';
  buildingType: BuildingType;
}
export function resolveStyle(input: ResolveStyleInput, path: SeedPath): StyleResolved;
```

**Rules (data, not scattered ifs):**
- Family from `styleFamilyForCultureType(cultureType)` (throws on unknown — keep).
- `roofForm`: family's `roofForms[0..n]` picked by one draw from `streamPath(path, 'style')`; climate overrides: `cold` → prefer `'steep'` when the family offers it; `arid` → prefer `'flat'`; temple/keep never `'flat'` (a flat keep top IS allowed — keep exception: keep may be flat/parapet; temple never).
- `pitchRiseFt`: base 5; `steep` 8; `cold` ×1.4; `arid` flat → 0.
- `eaveOverhangFt`: 1; `cold` 2 (snow shed), `arid` 0.5.
- `finishTier` = wealth. Palette pick: wealthy picks from the LAST half of the family palettes (dressed stone/slate end), poor from the FIRST half (weathered end) — one draw each for wall/roof/trim from the same `'style'` stream.
- `ornament` = wealth === 'wealthy'; `raisedPlinth` = climate === 'marsh'.
- `ageBand` accepted, no effect yet except passing through to `StyleResolved` consumers later — document.

- [ ] **Step 1: Write the failing tests** — cold prefers steep + deeper eaves; arid flattens; wealthy ≠ poor palette pick for the same seed; unknown culture throws; determinism (two calls deep-equal); temple never flat over 50 seeds.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** as pure table-driven logic; the ONLY rng use is the `'style'` stream (3 draws: form, wall, roof — fixed count regardless of input so the stream is refactor-stable).
- [ ] **Step 4: Pass + typecheck.**

---

### Task 3: The roof solver

Pure geometry: masses + style + plan data → `RoofPlan`. Per-mass roofs joined with valleys, chimneys from hearths, dormers for windowless upper bedrooms, caps on towers.

**Files:**
- Create: `src/systems/worldforge/interior/roofPlan.ts`
- Test: `src/systems/worldforge/interior/__tests__/roofPlan.test.ts`

**Interfaces:**

```ts
export interface SolveRoofInput {
  masses: FootprintMass[];
  footprintCells: Cell[];
  style: Pick<StyleResolved, 'roofForm' | 'pitchRiseFt' | 'eaveOverhangFt'>;
  /** Hearth/forge-hearth furnishings of the TOPMOST habitable floor, feet. */
  hearths: Array<{ x: Feet; y: Feet }>;
  /** Upper-floor bedrooms owning no window edge (dormer candidates): anchor cells. */
  windowlessUpperRooms: Cell[];
  wallTopFt: Feet;   // storeys * storey height — roof z values are ABOVE this
}
export function solveRoof(input: SolveRoofInput): RoofPlan;
```

**Algorithm (concrete):**
1. **Main mass** gets the style's `roofForm`: `gable`/`steep` = ridge prism along the LONGER axis (ridge z = pitchRiseFt); `hip` = ridge shortened by half-depth each end (4 planes); `flat` = zero-rise slab + parapet flag (planes empty, one ridge at z 0 marking the parapet line). Eaves extend `eaveOverhangFt` beyond the mass edges.
2. **Each wing** gets a gable prism with its ridge along the wing's long axis at the SAME pitch slope (rise scales with the wing's half-width so slopes match the main — real construction), extended INTO the main mass by the 1-cell overlap so the junction is covered. The two intersection segments between wing planes and main planes are emitted as `valleys` (compute as the projection of the wing's eave-to-ridge edges onto the main's slope: both slopes are known linear functions z(x,y); the valley is the segment where they are equal, clipped to the wing's width — implement as line-segment intersection of the two plane pairs and clip; add a focused unit test with a hand-computed T-shape).
3. **Towers** get NO main-roof coverage: emit a `towerCap` (`pyramid` for square family roofs, `cone` when the family's first roofForm is `steep`) with apex `pitchRiseFt * 1.6` above the wall top, and CLIP the main/wing planes out of the tower's cells.
4. **Chimneys:** one per hearth, projected to `(x, y)`; `topFt` = local roof height at that point + 3 (stack clears the roof). Merge hearths within 5 ft into one stack.
5. **Dormers:** one per windowless upper bedroom anchor, snapped onto the nearest sloped plane, oriented outward (normal of that plane's downhill side).
6. Everything deterministic and RNG-FREE — the solver is a pure function; all taste came in through `style`.

- [ ] **Step 1: Write the failing tests**

```ts
it('coverage: every footprint cell center lies under ≥1 plane or a tower cap — 100 seeds × 5 types', () => { /* point-in-poly over plane XY projections */ });
it('every hearth gets a chimney whose topFt clears the local roof', () => { /* evaluate plane z at chimney xy */ });
it('T-shape fixture: exactly 2 valleys, hand-computed endpoints ±0.1 ft', () => { /* fixed masses, no rng */ });
it('tower cells are excluded from main planes and capped', () => {});
it('flat style yields no sloped planes and no dormers', () => {});
it('solver is a pure function: deep-equal outputs for equal inputs', () => {});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** per the algorithm; keep each geometric helper (planeZAt, clipSegmentToRect, prismFor) small and unit-tested inside the same test file.
- [ ] **Step 4: Pass + typecheck.**

---

### Task 4: `generateBuilding` resolves style + solves the roof

**Files:**
- Modify: `src/systems/worldforge/interior/generateBuilding.ts`
- Test: `src/systems/worldforge/interior/__tests__/generateBuilding.test.ts` (extend)

**Interfaces:**
- `GenerateBuildingInput.style?: StyleContext` (the reserved Phase 1A Task 3 type: `{ cultureId | cultureType, climate, wealth, ageBand }` — reconcile: change the reserved `StyleContext.cultureId: number` to `cultureType: string` HERE if 1A froze it with `cultureId`; that is a deliberate coordinated edit, note it in the freeze comment).
- When `input.style` present: `plan.styleResolved = resolveStyle(...)` (stream `'style'` off the buildingPath) and `plan.roof = solveRoof(...)` fed by the topmost habitable floor's hearths and windowless upper bedrooms. When absent: both undefined (briefless/preview v1 calls unchanged). Memo key gains a style digest (`cultureType|climate|wealth|ageBand` or `''`).

- [ ] **Step 1: Failing test** — style in → `roof` + `styleResolved` set, chimney count ≥ hearth-bearing rooms on top floor; style absent → both undefined and output byte-identical to the pre-task snapshot (same briefless-snapshot guard pattern as Phase 1A Task 8).
- [ ] **Step 2: Verify failure** (capture the style-less snapshot first).
- [ ] **Step 3: Implement** — resolve, solve, attach; **the style-identity invariant test**:

```ts
it('style never moves walls: same seed under 3 styles ⇒ identical floors/walls/doors', () => {
  const styles = [cold_poor, temperate_common, arid_wealthy].map((s) =>
    generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(7), style: s }));
  const bones = (p: BlueprintPlan) => JSON.stringify({ f: p.floors, fp: p.footprintCells, s: p.stairs });
  expect(bones(styles[0])).toBe(bones(styles[1]));
  expect(bones(styles[1])).toBe(bones(styles[2]));
});
```

- [ ] **Step 4: Pass + full interior suite + typecheck.**

---

### Task 5: 3D — raise the solved roof

**Files:**
- Modify: `src/systems/world3d/buildingModels.ts` (add `buildRoofMeshData(roof: RoofPlan, wallTopFt): { tris: RoofTriangles; chimneyBoxes: MeshBox[]; capData: ... }` — planes triangulated fan-wise, chimneys as `MeshBox` kind `'chimney'` added to `MeshBoxKind`, caps as pyramid/cone tri fans; reuse `fromTris`)
- Modify: `src/systems/worldforge/bridge/interiorParts.ts` (`blueprintStructureParts` consumes `plan.roof` when present — feet→meters like the walls; material colors from `plan.styleResolved` with the existing per-plot styled colors as the source when styleResolved is absent)
- Modify: `src/components/World3D/World3DScene.tsx:385` region — blueprint-driven buildings with `plan.roof` skip the legacy `buildRoofGeometry` rectangle prism (legacy prism stays for non-blueprint props/buildings)
- Test: `src/systems/world3d/__tests__/buildingModels.test.ts` (extend)

- [ ] **Step 1: Failing tests** — `buildRoofMeshData` emits ≥1 triangle per plane, all vertices at z ≥ wallTopFt − eave drop; chimney boxes rise above their local plane; deterministic.
- [ ] **Step 2-3: Implement**; roof triangles get their own geometry group so the bridge maps `roofColor`.
- [ ] **Step 4: Pass + typecheck + bridge suites green (`src/systems/worldforge/bridge/__tests__/`).**

---

### Task 6: 2D — roof overlay in the blueprint drawer

**Files:**
- Modify: `src/systems/worldforge/interior/renderBlueprintSvg.ts` (optional `roof?: RoofPlan` argument → `<g data-roof>` overlay: plane outlines tinted, ridges solid, valleys dashed, chimney dots ⌂, dormer carets, tower caps hatched)
- Modify: `src/components/DesignPreview/steps/PreviewBlueprint.tsx` (a "roof" toggle + style preset dropdown: cold-poor / temperate-common / arid-wealthy)
- Test: render test asserting `data-roof` group, ridge/valley/chimney element counts match the RoofPlan.

- [ ] Steps: failing render test → implement → pass → typecheck.

---

### Task 7: Production wiring — StyleContext from the atlas

**Files:**
- Modify: `src/systems/worldforge/bridge/interiorParts.ts` (or `townPlanAdapter.ts` where the burg's culture/biome already flow — trace `styleFamilyForCultureType` call sites for the existing culture plumb line): build `StyleContext` per plot — `cultureType` from the burg's FMG culture type (already available to the styled-architecture path), `climate` from the burg's biome via a closed `BIOME_TO_CLIMATE` table (cold biomes → 'cold', desert → 'arid', marsh/swamp → 'marsh', everything else 'temperate'; unknown biome id throws), `wealth` from `plot.district ?? 'common'`, `ageBand: 'new'` — and pass it through `InteriorPlotInput.style` (add the optional field, mirroring Phase 1A Task 11's pattern).
- Test: extend `generateInterior.test.ts` — plot with style context yields `plan.roof`; legacy plot yields none; unknown biome throws.

- [ ] Steps: failing test → implement (trace first: the culture type already reaches the 3D bake for `styledRoof` — reuse that exact source) → pass → run `src/systems/worldforge/__integration__/pipeline.test.ts` → typecheck.

---

### Task 8: Golden re-freeze + VISUAL EYEBALL

- [ ] **Step 1:** Full worldforge + world3d suite; re-freeze coordinate goldens shifted by roof/style fields (`-u`, eyeball the diff — additive fields and roof data only; wall/door/room coordinates must NOT have moved unless Phase 1A landed between, in which case its re-freeze already covered them).
- [ ] **Step 2:** Same-plan-three-styles golden (Task 4's test) pinned; roof solver determinism sweep 200 seeds.
- [ ] **Step 3: VISUAL EYEBALL (required):** load a real town in 3D via the shoot rig (`shoot.mjs`, `battlemap3d-camera-pose-hook`/`preview-screenshot-3d-capture` memories): (a) skyline overview — pitched roofs, no flat-topped shells, valleys where wings meet; (b) close-up — chimneys over hearth walls, dormers, a tower cap; (c) two different-culture burgs side by side — visibly different families; (d) one wealthy vs one poor ward — finish difference reads. 2D: the blueprint drawer's roof overlay on a manor (ridges/valleys sane). Record captures under `.agent/scratch/`, fix what reads wrong before calling done.
- [ ] **Step 4: Bookkeeping:** flip the Phase 1B feature tiles on `building-generator-v2` in `public/planmap/topics.json`; update the `building-generator-v2` memory.

---

## Plan Self-Review (done at write time)

- **Spec coverage (Ambition 2):** massing decomposition → Task 1; hips/gables/valleys/tower caps/dormers/chimneys-from-hearths → Task 3; pitch/overhang/materials per culture+climate+wealth → Task 2; age driver accepted-but-stubbed → Task 2 (Phase 3 fills); one `StyleResolved` for 2D+3D → Tasks 1/4/5/6; same-plan-different-dress golden → Task 4; beautification-wave boundary respected (geometry + data here, shader polish there) → Tasks 5/8.
- **Determinism:** solver RNG-free; `resolveStyle` fixed 3-draw stream; footprint mass emission adds zero draws (v1 A8 golden guards it).
- **Type consistency:** `FootprintMass`/`RoofPlan`/`StyleResolved` defined once (Task 1), consumed by 3/4/5/6; `ClimateClass` defined in Task 2, used by Task 7's biome table.
- **Flagged coordination point:** `StyleContext.cultureType` vs the 1A-reserved `cultureId` field — Task 4 names the reconciliation explicitly; the two plans touching `blueprintTypes.ts`/`generateBuilding.ts` must sequence those tasks (parallel-track note at top).
