# Handover — Procedural dungeon generator (first draft → next agent)

**Date:** 2026-07-06 · **Campaign:** World · **Plan-map node:** `dungeon-generator` (status `active`)
**Spec:** [2026-07-05-procedural-dungeon-generator.md](../specs/2026-07-05-procedural-dungeon-generator.md)

> **UPDATE 2026-07-06 (later the same day):** Remy rejected the scatter+MST
> layout on sight ("this looks terrible" — rooms merged into blobs). The layout
> core was rewritten as a **growth-based builder**: rooms attach to existing
> rooms through a door + straight corridor, any placement touching existing
> floor is rejected, and extra doors open through 1–2 cell wall gaps as loops.
> Result: distinct walled rooms, corridors that read as corridors, visible door
> cells, grid-aligned structure, colonnaded halls. Section 3's pipeline
> description is stale; the contract, tests (still 8/8), and preview wiring are
> unchanged. Lesson recorded: mock up target layouts and get a look approval
> BEFORE building a generator.

You are picking up a **built and verified first draft** of a procedural dungeon
generator for Aralia. Read this whole file, verify the current state yourself
(commands below), then help decide the open direction at the end — I want your
opinion, not just execution.

---

## 1. What Aralia is (the constraints that shaped this)

Aralia is a D&D 5e tactical RPG in React 19 + TypeScript, built with Vite. A few
project directives are load-bearing here — do not violate them:

- **Determinism via seed paths.** All procedural randomness goes through
  `SeededRandom` (Park–Miller) seeded from hierarchical seed paths in
  `src/systems/worldforge/seedPath.ts` (`rngFromPath` / `streamPath` /
  `childSeedPath`). **Never** `Math.random`, `Date.now`, or mulberry32 in logic.
  **Trap:** `SeededRandom.nextInt(min, max)` is min-inclusive / **max-EXCLUSIVE**.
- **Feet-canon.** The world is on a 5 ft grid (`CELL_FT = 5`), D&D feet everywhere.
- **No fallbacks (Remy's directive).** Build one real path and fail honestly. Do
  NOT paper over a broken layout (e.g. teleporters bridging islands) — re-roll or
  throw. No graceful-degradation.
- **Visual-inspection rule.** Numeric goldens are necessary but NOT sufficient.
  Every generation/visual slice must be rendered and eyeballed.
- **No branches / no worktrees.** Work only on `master`. Do not create branches or
  git worktrees. Work is left uncommitted in the tree (a 2am cron auto-commits).
- **3D render path is WebGPU + TSL.** The battle-map 3D scene bakes lighting into
  `MeshBasicNodeMaterial.colorNode` because the node path has no `LightsNode` for
  R3F-added lights (they render black). WebGL is still the default; WebGPU is behind
  `?gpu=1`. See `src/components/BattleMap/BattleMap3DGpuScene.tsx`.

## 2. What this feature is

A NEW worldforge layer: an **explorable, multi-room dungeon** generated as pure
data, then (later) rendered in 3D. It is the sibling of the single-building interior
generator and deliberately mirrors its contract: pure data, zero THREE imports,
deterministic from a seed. Its combat payload is D&D encounters keyed to graph
depth (difficulty → CR/XP budget), meant to resolve through Aralia's fight-in-place
5 ft tile referee.

## 3. What is already built (first draft, verified)

| File | What it is |
|------|-----------|
| `src/systems/worldforge/dungeon/generateDungeon.ts` | The generator. Pure data, zero THREE. Pipeline: room scatter → AABB separation → Bowyer–Watson Delaunay → Prim MST → loop edges → semantics (boss/entrance/critical path/room types/difficulty) → L-corridor carve → wall + BFS-field rasterize → CR-budgeted decoration. Re-rolls on a disconnected layout (max 5 derived attempts), throws honestly if none connect. |
| `src/systems/worldforge/dungeon/types.ts` | The `DungeonPlan` contract + enums. Doc-comment discipline matches `interior/types.ts`. |
| `src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts` | 8 acceptance tests, all green. |
| `src/components/DesignPreview/steps/PreviewDungeon.tsx` | 2D top-down canvas drawer: seed box + reroll, sliders (rooms/loopChance/decor), overlay toggles (Delaunay, MST, loops, critical path, difficulty heatmap, rooms/props/spawns), live stats + legend. |
| `src/components/DesignPreview/DesignPreviewPage.tsx` | Wiring only: import + `steps[]` entry `{ id: 'dungeon', label: 'Dungeon', group: 'world' }` + render line. |

## 4. Verify it yourself before changing anything

```bash
# Tests (should print 8 passed)
npx vitest run src/systems/worldforge/dungeon/__tests__/generateDungeon.test.ts
```

Preview (eyeball):
1. Start the `dev` server from `.claude/launch.json` (Vite). Note the base path is
   `/Aralia/` and the design workbench is a separate HTML entry.
2. Navigate to `http://<host>:<port>/Aralia/misc/design.html?step=dungeon`.
3. **Gotcha:** the preview screenshot tool hangs on this canvas. To capture, pull the
   canvas out via `document.querySelector('canvas').toDataURL(...)` in an eval and
   decode it, or read pixels directly — don't rely on the screenshot tool.

The 8 invariants under test: 100% flood-fill reachability from the entrance;
identical grid checksum across 3 runs; different seeds differ; boss depth ≥ 60% of
max BFS depth; entrance is a degree-1 leaf and not boss-adjacent; loop count =
cyclomatic number (E − V + 1); ≥ 3 leaf rooms at 40+ rooms; no prop/spawn on a
doorway/wall/void cell; 60-room gen < 50 ms.

## 5. Honest caveats (do not mistake these for "done")

- **Units are grid-native (cells), not feet.** This first draft keeps the whole plan
  in 5 ft cells; only `widthFt`/`depthFt` are feet. The spec's "feet at the plan
  boundary" conversion for rooms/props/spawns is a **documented deferral** (see the
  header of `types.ts`). Anything built on top now inherits cells.
- **Perf:** the < 50 ms budget passes in the Node test harness at 60 rooms. The
  in-browser dev build measured ~74 ms cold at 42 rooms (unoptimized dev + cold JIT).
  Confirm in a prod build before trusting the budget end-to-end.
- **Monster selection is a placeholder.** `CR_TABLE` in `generateDungeon.ts` is a
  hardcoded crypt list; real bestiary/CR sourcing is not wired.
- **No 3D yet.** `buildDungeonScene` from the spec is not written. The preview is 2D
  only.

## 6. Reference files (conventions to copy, not modify blindly)

- `src/systems/worldforge/seedPath.ts` — the determinism contract (frozen).
- `src/utils/random/seededRandom.ts` — the RNG (note nextInt is max-exclusive).
- `src/systems/worldforge/interior/generateInterior.ts` + `interior/types.ts` — the
  exact pure-data pattern this mirrors.
- `src/components/BattleMap/BattleMap3DGpuScene.tsx` — the WebGPU/TSL baked-lighting
  scene pattern for the eventual 3D slice (instanced meshes, no scene lights, known
  InstanceNode instanceColor trap documented inside).
- `src/components/DesignPreview/steps/PreviewBlueprint.tsx` — sibling preview step
  pattern (SVG-string variant; this dungeon step uses canvas).

## 7. Open decisions — I want your recommendation

These were offered to Remy as the next-step fork; he chose to hand over instead of
picking. Read the spec + code, then **give your opinion on each before proceeding**,
and confirm the direction with Remy (end that turn with the AskUserQuestion tool per
his standing preference — concrete options, your recommendation first).

**A. Immediate direction (pick one to drive the next slice):**
1. **Refine the 2D draft** — iterate the generator/drawer on eyeball: room-shape
   variety, corridor elbow quality, decoration density, name flavor, heatmap read.
   Stay in 2D. (Lowest risk; tightens the layout before anything is built on it.)
2. **3D scene builder** — write `buildDungeonScene` on the WebGPU/TSL path (instanced
   floor/wall/pillar/torch/etc., baked lighting, `dispose()`), so dungeons render in
   the real battle-map path.
3. **Feet-canon + contract conversion** — do the deferred boundary conversion now
   (rooms/props/spawns → feet per the `DungeonPlan` contract) before more is built on
   cells. (Cheap now, painful later — arguably should precede option 2.)
4. **Leave as-is** — first draft is enough; Remy drives from the preview.

**B. Spec open questions (from the spec's own "Open questions"):**
- **World attachment:** where do dungeons hook into the world? Hidden-place leaf on
  the atlas, a building interior with a stair-down, or a standalone travel
  destination. (Carried as a `spike` on the plan-map.)
- **Monster sourcing:** which existing bestiary / stat-block table feeds the CR/XP
  budget picker (replacing the placeholder `CR_TABLE`).
- **Multi-level dungeons:** stair-down to a deeper `childSeedPath` complex — v1 or
  later.

My own lean (for you to challenge): do **3 (feet-canon) then 2 (3D)** — converting
units after the 3D builder reads cells means reworking the builder. But if Remy wants
a fast visual payoff, **2** first is defensible since the drawer already proves the
data. Form your own view.

## 8. Plan-map

`public/planmap/topics.json` → node `dungeon-generator` (campaign `world`, status
`active`): 3 features `done` (generator, tests, 2D preview), 4 `specced` (feet-canon,
3D builder, decoration/monsters, world attachment). Deps wired to `wf-interiors`
(mirrors L4 contract), `world-props` → prop-schema-placement-engine (decoration is
props), `fip-slice1` (encounters use the tile referee). When you finish a slice,
update this node's feature statuses in the same turn (Remy's alpha-signal rule).
