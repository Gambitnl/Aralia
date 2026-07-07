# Design prompt — Building Generator v2: Living Buildings

**You are picking up a design job, not a build job.** Your deliverable is an approved design spec (and after approval, a build plan). Interview Remy, explore the code, write the spec, get it approved. Do NOT write production code.

Use the `superpowers:brainstorming` skill first, then `interview` if available, then `superpowers:writing-plans` once the spec is approved. Remy answers direction questions via the AskUserQuestion tool — never as raw text questions.

---

## What exists (your foundation — read before designing)

The **building blueprint pipeline** is COMPLETE (2026-07-07). One deterministic generator (`src/systems/worldforge/interior/generateBuilding.ts`) emits a `BlueprintPlan` (`blueprintTypes.ts`): irregular footprints (wings/towers), rooms with purposes assigned adjacency-aware (kitchens by halls, pantries by kitchens), privacy-weighted doors with explicit swing data (`openDir`/`swingInto`), walls as per-edge data + merged runs with outward normals and real thickness, purpose-aware windows (bedrooms guaranteed, cellars never), hint-placed furniture (hearths only on exterior walls), basements + upper floors + stairs. Two consumers read that one data shape:
- 2D: `renderBlueprintSvg.ts`, live at Design Preview `misc/design.html?step=blueprint`.
- 3D: `buildBuildingMeshData` (`src/systems/world3d/buildingModels.ts`) + `blueprintStructureParts` (`src/systems/worldforge/bridge/interiorParts.ts`) — irregular shells, thick walls, door frames, window voids, below-grade basements.

Read-first context:
- `docs/superpowers/plans/2026-07-06-building-blueprint-HANDOVER.md` (executed; stamped with what landed)
- `docs/superpowers/specs/2026-07-05-building-blueprint-pipeline-design.md` (v1 design + rationale)
- `.superpowers/sdd/critique-fix-plan.md` — Wave C section lists the deferred integration decisions this design must now settle
- `.agent/scratch/blueprint-critique-round2.md` — 50-point critique of v1; Critics 2/3/5 flag exactly the gaps v2 addresses
- Town side: `src/systems/worldforge/` town generation (plots, roles: house/market/workshop/civic/temple/keep), the town population model (typed dwellings, realistic occupancy, lazy NAMED households — see memory `town-population-model`), and the agent-sim street movement (`?phase=agentsim`).

## The four ambitions (all approved by Remy 2026-07-07 — design all four, phased)

### 1. Inhabited buildings (the flagship — design this deepest)
Generate each building FROM its inhabitants instead of a type label. The town population model already produces named households with trades, sizes, wealth. Feed that into `generateBuilding`: a blacksmith with three kids gets forge + master bedroom + shared kids' room; a rich merchant gets a counting room and servant quarters. The plan becomes evidence about the people. Then make occupants USE the rooms: asleep in their bed at night, at the workbench by day, at the table at meals; hearths lit after dusk; chests/shelves become containers whose contents derive from room purpose + owner trade. This is the bridge to the agent-sim frontier (memory: `agentsim-roadmap`). Design questions you must settle: the household→room-program mapping, how occupancy schedules bind to furniture positions, container loot generation, and what happens when households change (death, marriage, moving) — regenerate or mutate?

### 2. Roofscapes + regional styles
Pitched roofs that follow the irregular footprints (hips, valleys, gables over wings), chimneys placed from the actual hearth data in the plan, dormers, tower caps. Plus a style grammar keyed to the atlas (culture/biome/burg wealth): timber-frame vs whitewashed stone vs steep snow roofs — same floor plan, different dress. Coordinate with the beautification wave (memory: `beautification-wave-build-status`, spec `docs/superpowers/specs/2026-07-02-world-beautification-wave.md`). The current flat-topped shells are the biggest visual gap.

### 3. Street-aware blocks (Wave C grown up)
Buildings that face the street (frontage — settle the deferred Wave C decision), share party walls, form row-houses and courtyards; blocks composed as ensembles, not isolated lots; market squares ringed by arcaded fronts. This must finally settle: the town-role vocabulary gap (town gen emits house/market/temple/keep/civic; the generator speaks cottage/shop/tavern/workshop/manor — a real `temple` type with nave/sanctuary/vestry purposes already in the vocabulary), and lot-size negotiation between town gen and the generator (today: `clampFootprint` hard-caps).

### 4. Buildings with history
An age/wear dimension that shows: a newer wing in different stone, a bricked-up door, sagging rooflines, boarded windows on abandoned houses. Over game time the living-world sim (memory: `living-world-sim`) renovates, extends, or ruins them. Design how history is stored (per-building seed + event log?), how it stays deterministic, and how it renders in both 2D and 3D.

## Non-negotiable constraints (Remy's standing directives — bake into the spec)

- **Feet-canon 5 ft grid**; all geometry data pure (zero `three` imports in generators).
- **Deterministic** via worldforge seed paths (`rngFromPath(streamPath(...))`); never `Math.random()`. Mind draw-order stability — v1 pins goldens.
- **No fallback / graceful degradation** — one real path, fail honestly.
- **US spelling** everywhere. **GOV.UK plain writing** in the spec (front-load, one idea per sentence); new coined terms go into `tools/agora/GLOSSARY.md` the same turn.
- **No time estimates, no feasibility-shrinking** — full vision, priority order.
- **Work only in master; never branch or worktree; never commit** (2am auto-snapshot).
- **Visual-inspection rule**: every visual slice in the eventual plan must end with a render-and-eyeball step, not just green tests.
- **Plan-map capture**: the moment scope decisions land, update `public/planmap/topics.json` (node `building-generator-v2` exists, status `parked` → flip to `specced` when the spec is approved).
- One BlueprintPlan stays the single source of truth — v2 EXTENDS the contract additively (v1 goldens must keep passing or be re-frozen deliberately, stated in the plan).

## Process

1. Read the context docs above and skim the v1 modules.
2. Brainstorm + interview Remy on the open design questions (each ambition lists them; batch questions, use AskUserQuestion).
3. Write the spec to `docs/superpowers/specs/2026-07-07-building-generator-v2-living-buildings.md` — all four ambitions, phased (Remy's priority: inhabited first, then roofs/styles, blocks, history — confirm with him).
4. Get explicit approval, flip the plan-map node to `specced`, then write the build plan via `superpowers:writing-plans`.
