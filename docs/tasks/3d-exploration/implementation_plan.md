# 3D World Integration Implementation Plan

**Date**: 2026-02-11  
**Status**: Active execution plan (phased)  
**Scope**: Full roadmap discussed in questionnaire + follow-ups

## Objective

Deliver a browser-based 3D exploration pipeline that is deterministic per save, feels massive, supports meaningful travel/events/POIs, and can evolve into AI-driven actor simulation without collapsing performance or clarity.

## Locked Decisions

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

### Phase 1: World Continuity + Determinism

1. Create deterministic border-port system for roads/rivers/cliffs between adjacent tiles.
2. Ensure 2D and 3D consume the same continuity contract.
3. Add deterministic recipe dumps for debug regression checks.

**Exit Criteria**
- Neighbor tile transitions preserve path/river continuity.
- Re-entering same tile in same save yields identical macro layout.

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
- Implemented step-based quick travel payload support (ordered path + step durations + encounter chance + step delay).
- Converted quick travel handler from one-shot teleport into step-by-step execution.
- Added per-step encounter interruption behavior (finish current step, then stop remaining route).
- Added soft edge telegraph UI (boundary banner + edge bands) in submap view.
- Preserved existing auto-save toggle path (default ON).
- Ran typecheck successfully.

### Next Up

- Phase 1 continuity contract (edge-matched roads/rivers/cliffs across adjacent tiles).
- Deterministic recipe dumps/tests for re-entry consistency.

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
8. Azgaar runtime integration boundaries (generator import pipeline vs native rewrite details).

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
