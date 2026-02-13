# 3D World Integration Implementation Plan

**Date**: 2026-02-12  
**Status**: Active execution plan (Azgaar-primary, Stage R1 implemented, parity validation pending)  
**Scope**: Full roadmap discussed in questionnaire + follow-ups

## Objective

Deliver a browser-based 3D exploration pipeline that is deterministic per save, feels massive, supports meaningful travel/events/POIs, and can evolve into AI-driven actor simulation without collapsing performance or clarity.

## Execution Discipline (Mandatory)

- No shortcut implementations are accepted as "done" if they bypass the agreed primary path.
- "Done" requires: integration + gameplay bridge wiring + persistence safety + deterministic verification.
- Temporary scaffolds are allowed only if explicitly labeled and tracked with a follow-up item in this file.
- This plan file must be updated at each meaningful phase boundary and after major scope decisions.
- If risk or uncertainty appears, document it here first, then proceed with a concrete mitigation step.

## Locked Decisions

- Primary world generation path is full Azgaar component integration (extracted/runtime-adapted), not long-term derived approximation.
- World map presentation target is seamless atlas style by default (not visible square tile grid).
- Travel/Movement mode can expose optional overlays (Voronoi/debug) as toggles; default OFF.
- States/borders are allowed in Phase 1 as toggleable visual layers (not forced always-on).
- New game must start with a new world seed.
- Seed persists within-session and across save/load (auto-save toggle default ON).
- In 3D exploration, time should progress in real time (1s real = 1s in-game).
- Submap travel should be step-based; each crossed cell costs real-time delay (3s target currently).
- Encounter checks occur per crossed cell; if triggered, finish that step then pause route.
- Edge traversal uses soft telegraphing (not hard invisible walls).
- Prioritize playability/readability first, then visual polish.
- 2D and 3D must align on roads/rivers/cliffs and deterministic structure.
- Long-term actor model: ambient -> skeleton-on-interaction -> social/backstory depth.
- Watabou local/POI generation is parked as a later phase.
- Time-of-day must not mutate deterministic terrain/layout generation for a tile recipe.

## Layman Model Clarification

- "Continuous map" means the player sees one seamless world atlas (coastlines/relief/rivers), not obvious square chunks.
- Under the hood, simulation still uses hidden world cells for travel time, encounter checks, persistence, and submap anchoring.
- Clicking anywhere on the atlas can snap to nearest hidden world cell; this preserves deterministic gameplay while keeping visuals immersive.
- Submap generation is anchored to a world cell (plus neighbors), so local terrain remains coherent with world context.

## Decouple Contract

- Detailed coupling inventory and staged decouple plan lives in `docs/tasks/3d-exploration/world-map-rewire-mapping.md`.
- We will decouple in sequence:
  - Renderer decouple first (`MapPane` swap to Azgaar atlas UI while preserving gameplay contracts).
  - Grid UI decouple second (remove legacy tile-grid renderer after click-travel/save/submap parity checks pass).
- Protected during renderer migration:
  - `MapData.tiles` compatibility
  - `MOVE_PLAYER` / `SET_MAP_DATA` contracts
  - save/load world seed persistence
  - submap hidden-cell anchoring

## Phase Roadmap

### Phase 0: Foundation (Now)

1. Quick travel: convert from teleport to ordered step execution.
2. Add per-step encounter chance and pause-after-current-step behavior.
3. Add soft edge telegraph UI for submap boundaries.
4. Keep/verify auto-save toggle behavior and seed persistence policy.

**Exit Criteria**
- Multi-cell quick travel visibly steps cell-by-cell.
- Time advances per step.
- Encounter can interrupt remaining route after current step.
- Edge cue appears before crossing boundaries.

### Phase 0.5: World-Map Coupling Audit + Rewire Staging

1. Maintain and update `world-map-rewire-mapping.md` as the authoritative decouple map.
2. Lock R1 scope: renderer swap only, no reducer/persistence contract breakage.
3. Lock R2 scope: remove legacy grid UI only after parity gates pass.
4. Define regression checklist for atlas click-travel, save/load, and submap anchoring.

**Exit Criteria**
- Coupling map covers renderer, travel, state, save/load, and submap dependencies with file-level references.
- R1/R2 boundaries are explicit and agreed.
- Rewire checklist is ready before map renderer replacement work continues.

### Phase 1: Azgaar Core Integration + Atlas Rendering

1. Phase 1A - Extract/adapt Azgaar generation components as primary backend (heightmap, cells, rivers, biomes, settlement hooks, states/borders where applicable).
2. Phase 1B - Replace square-tile world presentation with seamless atlas renderer (biome tint + coast + relief + rivers + settlements).
3. Phase 1C - Keep travel deterministic by snapping click targets to hidden world cells.
4. Phase 1D - Add map layer toggles: borders/states, rivers, relief, movement overlays.
5. Create deterministic border-port system for roads/rivers/cliffs between adjacent submaps.
6. Ensure 2D and 3D consume the same continuity contract.
7. Add deterministic recipe dumps for debug regression checks.

**Exit Criteria**
- Atlas view is default and no longer looks like exposed square map tiles.
- Azgaar-style macro geography is visible (coast/rivers/relief/settlement layers).
- Neighbor tile transitions preserve path/river/cliff continuity.
- Re-entering same tile in same save yields identical macro layout and submap anchors.

### Phase 1.5: Azgaar Option Triage (Feature-by-Feature)

1. Enumerate Azgaar options and classify each as: `Keep`, `Hide`, `Defer`.
2. Remove/disable non-game UI affordances (`New Map`, editor/export/import controls, etc.) from player-facing runtime.
3. Keep generator-relevant options that shape world output and gameplay semantics.
4. Produce a signed-off "Runtime Option Manifest" for maintenance.

**Exit Criteria**
- Every relevant Azgaar option has an explicit disposition and owner decision.
- Runtime world map UI is clean, game-focused, and free from generator-tool clutter.

### Phase 2: Massive-World Readability

1. Add far-field masking stack: fog + silhouette ring + edge skirts.
2. Add basic LOD rules (distance-based simplification for props/actors).
3. Add movement/scale calibration overlay (optional debug mode) to tune perceived speed.
4. Evaluate submap grid migration from `20x30` to `30x30` and update traversal/perf budgets.

**Exit Criteria**
- Tile edges stop breaking immersion in normal play.
- Movement speed feels coherent with world scale cues.

### Phase 3: Terrain + Biome Semantics

1. Consolidate biome proc-gen knobs into a single profile model.
2. Add terrain semantics (mud/scree/path/riverbank/etc.) and constrain blends.
3. Prevent implausible micro-strips (desert cuts through mountain artifacts).

**Exit Criteria**
- Biome readability improves without manual per-map knob twiddling.
- Authoring uses unified profiles instead of split config maps.

### Phase 4: POIs, Resources, and Discovery

1. Deterministic POI spawn graph (caves, ruins, camps, groves, villages).
2. Resource presence per tile + optional 2D auto-harvest with lower yield/quality.
3. Discovery-radius model for imprecise POI hints that tighten with clues.
4. Support runtime POI insertion hooks (e.g., newly revealed cave entrance).

**Exit Criteria**
- Tiles have meaningful exploration objectives.
- POI/resource discovery behavior matches designed hint-radius loop.

### Phase 5: Actor Staging + Social Depth

1. Ambient actor simulation as cheap background state.
2. Promote interacted actors to skeleton state (identity/combat/loot coherence).
3. Generate deeper drives/backstory on social interaction.
4. Add controlled persistent hunters/factions as special cases.

**Exit Criteria**
- Interacted actors persist coherently.
- Background simulation remains performant at scale.

### Phase 6: Deferred Tracks

1. Optional combat mode integration for mutable 3D environments.
2. Watabou-like local map generation integration for POI/town zoom-ins.
3. Higher-fidelity visual target pass (Valheim/Firewatch/BotW-inspired style treatment).

## Execution Order

1. Ship Phase 0 fully first.
2. Validate with playtest + deterministic checks.
3. Continue phase-by-phase; no parallel high-risk refactors across multiple phases.

## Execution Progress

### Completed In This Pass

- Added full-scope roadmap file for all agreed 3D/world integration requirements.
- Added explicit world-map coupling artifact: `world-map-rewire-mapping.md` with R1/R2 decouple stages and rewire checklist.
- Implemented step-based quick travel payload support (ordered path + step durations + encounter chance + step delay).
- Converted quick travel handler from one-shot teleport into step-by-step execution.
- Added per-step encounter interruption behavior (finish current step, then stop remaining route).
- Added soft edge telegraph UI (boundary banner + edge bands) in submap view.
- Preserved existing auto-save toggle path (default ON).
- Locked and implemented initial Phase 1A world-source swap stub: `generateMap` defaults to Azgaar-backed generation pipeline (still mid-integration).
- Added legacy generator fallback path so world generation cannot hard-fail at startup.
- Implemented Stage R1 renderer swap in `MapPane`: default read-only Azgaar atlas embed with click-to-hidden-cell bridge to existing `onTileClick` movement flow.
- Added seed-stable Azgaar embed URL generation from map layout, plus initialization retries and legacy-grid fallback mode if iframe bootstrap fails.
- Fixed Azgaar embed 404 in base-prefixed deployments by resolving iframe URL via `import.meta.env.BASE_URL` (works with configured Vite base `/Aralia/`).
- Replaced broken source `index.html` vendoring with built Azgaar runtime bundle (`dist` output) to eliminate `.ts` module 404s in iframe mode.
- Added Azgaar runtime cache-busting query parameter to avoid stale broken embed HTML in browser cache.
- Resolved two concrete R1 runtime blockers reported during live testing:
  - `/vendor/azgaar/index.html` 404 due to Vite base path mismatch.
  - `.ts` runtime module 404s due to source HTML being vendored instead of built runtime HTML.
- Fixed built Azgaar module bundle path from absolute `/Fantasy-Map-Generator/index-*.js` to relative `./index-*.js` in vendored runtime HTML to prevent iframe module 404s on localhost.
- Enabled Azgaar menu + layer toggles for option triage, while hard-disabling destructive actions (New Map / Save / Load / Export) in the embed.
- Enabled Azgaar pan/zoom and added an Aralia `Pan/Zoom` vs `Travel` interaction toggle.
- Implemented transform-aware atlas click-to-travel mapping using Azgaar's runtime transform (`viewX/viewY/scale`) exposed via an iframe bridge.
- Added main-menu `World Generation` entry point that opens the world map before starting a run.
- Added pre-run regeneration controls (`Apply Seed`, `Reroll World`) in `MapPane` setup mode, with lock gating.
- Added world-regeneration lock policy: regeneration is blocked when save data exists or an active run is in memory, with explicit user-facing reasons.
- Added `SET_WORLD_SEED` state action so regenerated preview worlds keep seed + map data aligned before character creation starts.
- Added preconfigured-world handoff: when no saves/active run exist and a preview map is prepared, `New Game` now reuses that configured world instead of rolling a new one.
- Added deterministic map generation tests for seed stability, location anchoring, and start discovery behavior.
- Implemented deterministic edge-port continuity for submap roads and rivers across adjacent world tiles.
- Added continuity tests to verify edge matching, determinism, and independent network channels.
- Extended deterministic edge-port continuity to impassable cliff bands in submaps.
- Added cliff continuity test coverage for cross-tile east/west edge matching.
- Ran typecheck successfully.

### Next Up

- Run R1 parity checks: atlas click-travel correctness, save/load round-trip, and submap anchoring consistency.
- Validate the new main-menu world-generation lock UX against real save states (fresh profile, existing save, active in-memory run).
- After parity passes, execute R2 cleanup: remove obsolete legacy world-map renderer paths.
- Complete full Azgaar component extraction/integration path (primary backend).
- Run Azgaar option triage pass and finalize Runtime Option Manifest.
- Continue continuity contract work (edge-matched roads/rivers/cliffs across adjacent tiles).

### Backlog (Non-Gating, Do Not Derail Next Phase)

- Locked-world guard sweep for Azgaar in-map tools: when world generation is locked, block all generation-mutating actions still reachable via embedded UI (including `Edit Burg` regen paths).
- Burg tools review: audit `Burgs Overview` and related burg editors for any actions that mutate map topology/data and require lock gating.
- Broad command-category suppression policy: disable or intercept all tool actions under `Regenerate`, `Add`, and `Create` while in locked mode; keep pure read-only inspection/layer toggles allowed.

### Immediate R1 Parity Checklist

1. Open world map in `Azgaar Atlas` mode and verify iframe loads without 404s or runtime reference errors.
2. Click center and near-edge atlas positions; verify `MOVE_PLAYER` triggers and player marker/discovery update coherently.
3. Perform save -> reload -> open map; verify same world seed and same visible macro map behavior.
4. Enter submap after atlas-based move; verify world cell anchoring and biome coherence are preserved.
5. Record any atlas click mismatch cases (especially coastline/edge clicks) before proceeding to R2 cleanup.

## Questionnaire Traceability

Primary source of full discussion answers: `docs/tasks/3d-exploration/2B-3D-INTEGRATION-DESIGN-PLAN.md`.

This implementation file is the executable roadmap. Items still needing explicit lock/spec detail:

1. Combat integration mode details (kept intentionally deferred).
2. Exact hardware/performance target budgets (FPS + device class + max instance counts).
3. Exact transport-time formula for biome/terrain/load/favored-terrain modifiers.
4. POI hint-radius shrink mechanics (how clues reduce search radius numerically).
5. Runtime POI injection rules (when/why hidden entrances are spawned).
6. Actor promotion triggers and retention limits (what counts as "meaningful interaction").
7. 3D lighting/floor safe-mode debugging path (backburner but not removed).
8. Final azgaar module boundary selection (direct vendoring vs thin bridge wrappers).
9. Click-travel snapping rule details (nearest cell vs weighted by passability/path costs).

## Verification Plan

1. Determinism:
- Fixed seed + coords => stable recipe outputs across reloads.

2. Travel:
- Quick travel crosses N cells in N visible steps.
- Encounter pause stops remaining route after current step.

3. Continuity:
- Adjacent tiles align road/river/cliff edges.

4. Performance:
- Record baseline FPS/instance counts in sparse and dense biomes before/after major phase.

### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.
