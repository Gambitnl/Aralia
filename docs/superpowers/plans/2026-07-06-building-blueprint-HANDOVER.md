# Handover — Building Blueprint Pipeline

**You are picking up a fully-designed, ready-to-build feature.** The design is done, approved, and turned into a step-by-step plan. Your job is to build it. Read this whole doc first, then read the plan, then start.

---

## What this is (plain version)

We design each building as a clean **2D blueprint first**, then build the 3D from that same blueprint. Willing a good 3D building into existence directly is hard; a flat 2D blueprint is easy to get right and becomes the single source of truth. One generator emits blueprint **data** (rooms, doors, windows, furniture, stairs, walls — all in feet on a 5 ft grid); a 2D drawer and the 3D build both read that one data shape.

This was proven with a "reverse experiment": we rendered a 2D module-style blueprint *from* the existing 3D interior generator's data. It works — one shared data shape + one renderer serves both directions.

## Current state

- **Spec — APPROVED** by Remy: `docs/superpowers/specs/2026-07-05-building-blueprint-pipeline-design.md`. All decisions are made (see below). No open questions in the spec.
- **Build plan — WRITTEN, your primary instruction:** `docs/superpowers/plans/2026-07-05-building-blueprint-pipeline.md`. 12 test-first tasks in dependency order. Follow it task-by-task.
- **Plan-map** node `building-generator` is `active`, the ★ focus. `public/planmap/topics.json`.
- **Two Design Preview surfaces already exist** (World group): `Floorplans` (a rich standalone look-lab) and `3D→Blueprint` (the reverse experiment — the real one to grow). Open at `http://localhost:<port>/Aralia/misc/design.html?step=blueprint`.
- **A 34-point harsh critique** of the first look-fork is captured and folded into the plan's fix-list: `.agent/scratch/floorplan-critique.md`.

## The decisions already made (do not re-litigate)

1. **Irregular footprints are in v1.** L-shapes, wings, and a tower — and the 3D build learns to raise non-rectangular shells. Not a later pass.
2. **Walls sit on the grid line with real thickness** (thick outer ~1.5 ft, thin inner ~0.5 ft), growing outward from the line. A wall never eats a playable tile, so rooms stay full-size and combat still reads a wall edge as cover. (Rejected: walls filling the middle of a tile — that wastes a 5 ft strip per wall; dungeon-only.)
3. **Basements are in v1.** Basement + ground + upper floors.

## Non-negotiable constraints (Remy's standing directives)

- **Feet-canon 5 ft grid.** All coords in feet, aligned to 5 ft. `CELL_FT = 5`, `MIN_ROOM_FT = 10`.
- **Pure data, zero `three` imports** in the generator and the `BlueprintPlan` data. Data only.
- **Deterministic** via the worldforge seed paths (`rngFromPath(streamPath(path, '<concern>'))`). Same seed path → byte-identical plan. **Never `Math.random()` in generator code.**
- **US spelling** in identifiers and labels (color, gray, -ize).
- **No fallback / graceful degradation.** Build one real path; fail honestly.
- **Do NOT commit, and do NOT branch.** Work only in `master`. Never create a git branch or worktree. The repo auto-snapshots to GitHub daily at 2am — leave finished work in the tree. Each task ends by running its tests green; there is no manual commit.
- **Visual-inspection rule.** Numeric goldens are not enough — render and eyeball every visual slice (the 2D drawer on the Design Preview, the 3D in-world) before calling it done.
- **Plain writing, US English** in any docs you touch.

## The task order (from the plan)

1. Blueprint data contract (`blueprintTypes.ts`) → 2. Irregular footprint (`footprint.ts`) → 3. Room partition with a dominant main room (`partition.ts`) → 4. Room purposes, storage capped (`program.ts`) → 5. Doors + street entrance on the main room (`doors.ts`) → 6. Walls-with-thickness + outward-facing windows (`walls.ts`) → 7. Room-clipped furniture (`furnish.ts`) → 8. Floors + basement + stairs, assemble `BlueprintPlan` (`generateBuilding.ts`) → 9. Golden snapshots → 10. Legacy adapter so the current 3D build keeps working (`generateInterior.ts`) → 11. Pure 2D drawer with the picture fixes (`renderBlueprintSvg.ts` + wire `PreviewBlueprint.tsx`) → 12. 3D build raises the irregular shell + wall thickness.

Each task in the plan has exact files, interfaces, and concrete Vitest tests. The tests are the contract — write them first, watch them fail, implement, watch them pass.

## All relevant files

**Read-first docs**
- `docs/superpowers/plans/2026-07-05-building-blueprint-pipeline.md` — THE PLAN (your instruction).
- `docs/superpowers/specs/2026-07-05-building-blueprint-pipeline-design.md` — the design + rationale.
- `.agent/scratch/floorplan-critique.md` — the 34-point critique the plan fixes.

**Existing code you extend (the owned generator + its data)**
- `src/systems/worldforge/interior/generateInterior.ts` — current 3D interior generator (BSP rooms/doorways/furnishings/stairs, multi-storey). You grow this into the shared generator; a thin adapter keeps its `InteriorPlan` output for existing callers (Task 10).
- `src/systems/worldforge/interior/types.ts` — the current `InteriorPlan` contract. Your new richer contract lives in a new `blueprintTypes.ts`.
- `src/systems/worldforge/seedPath.ts` — the deterministic seed-path RNG (`rootSeedPath`, `childSeedPath`, `streamPath`, `rngFromPath`). Use it for all randomness.

**Preview surfaces (already built this session)**
- `src/components/DesignPreview/steps/PreviewBlueprint.tsx` — the reverse experiment. Exports pure `buildPlan` and `renderBlueprint`; the SVG builder here is the seed of Task 11's `renderBlueprintSvg.ts`. Grow this to consume the shared generator.
- `src/components/DesignPreview/steps/PreviewFloorplans.tsx` — the rich look-lab (its own private generator). Decide at Task 12 whether it retires.
- `src/components/DesignPreview/DesignPreviewPage.tsx` — where preview steps register (steps list + switch). `blueprint` and `floorplans` steps are already wired.

**3D build (Task 12 touches these)**
- `src/systems/worldforge/bridge/interiorBuild.ts`, `src/systems/worldforge/bridge/interiorParts.ts` — the interior 3D build path.
- `src/systems/world3d/buildingModels.ts` — building mesh data.

**Tooling / proof**
- `.agent/scratch/gen-blueprints.mts` — a headless script that imports the pure `buildPlan`/`renderBlueprint` and writes sample `.svg` files (proves the pure functions run outside the browser). Run: `npx tsx .agent/scratch/gen-blueprints.mts`.
- `public/planmap/topics.json` — the plan-map node `building-generator` (keep its status honest as you build: flip features `specced → active → done`).

**Adjacent / coordinate with (do not clobber)**
- `docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md` and a `PreviewDungeon` step — a **parallel** dungeon generator is being built by another agent. It is a sibling that also extends the interior generator's contract. Your `BlueprintPlan` may become the shared base; check for its edits before touching `generateInterior.ts`/`types.ts`, and coordinate via the Agora daemon (`agora-coordination` skill) if both are live.

## Gotchas you will hit

- **The dev preview server dies on start** when another chat holds this same folder (an overlapping-restart race). Retry `preview_start`; verify in a single `preview_eval` to beat the crash window. Not your bug.
- **`preview_screenshot` hangs** on the Design Preview page (R3F + heavy SVG). Inspect via the SVG DOM (`preview_eval` reading `outerHTML`) instead, or use the headless `gen-blueprints.mts` script for the 2D, and the shoot rig for 3D.
- **The design-preview tab bounces to the game app on first navigation.** Call `window.location.assign('/Aralia/misc/design.html?step=blueprint')` again to make it stick; confirm with `document.querySelector('h1').textContent === 'Design Preview'`.
- **Files carry an auto-generated `@dependencies` header.** New files won't have it; that's fine.

## Decisions left open for YOU (state your recommendation first, then proceed unless it needs Remy)

1. **How to execute this plan.** Options Remy was offered:
   - **Subagent-driven (recommended):** dispatch a fresh subagent per task, review between tasks. Best for a clean 12-task run.
   - **Inline:** execute tasks in your own session in batches with checkpoints.
   - *Give your recommendation and pick one; Remy is fine either way.*
2. **Task 10 — adapter vs supersede.** Keep `generateInterior` as a thin adapter that maps `BlueprintPlan → InteriorPlan` (safest — existing 3D callers unchanged), or fully replace it and update callers. Recommend the adapter unless you find few callers. State your call.
3. **Task 12 end — retire `PreviewFloorplans`?** Once `PreviewBlueprint` renders the shared generator well, decide whether the `Floorplans` look-lab retires or stays. State your call.

## How to start

1. Read the plan and this doc fully.
2. Load `superpowers:subagent-driven-development` (if subagent-driven) or `superpowers:executing-plans` (if inline).
3. Begin at Task 1. Write the test, watch it fail, implement, watch it pass. Move to the next task.
4. At Tasks 11 and 12, do a real visual eyeball, not just green tests.
5. Keep the plan-map node and the `building-blueprint-pipeline` memory honest as you land tasks.

Good luck. The design work is solid — trust the plan, let the tests drive.
