# 2B-3D-INTEGRATION-DESIGN-PLAN

**Purpose**: Turn the 3D mode into the primary, deterministic per-submap-tile exploration surface (terrain + props + actors + interactions), aligned with world seed + save/load, and ready for AI-driven NPC/creature behavior.

**Last Updated**: 2026-02-10
**Status**: Draft (needs answers to Questionnaire)
**Owner**: TBD

---

## One-Sentence Vision

When the player enters a submap tile in 3D, they should see an immediately legible, navigable, biome-authentic micro-landscape with clear points of interest and actor presence; revisits must be deterministic (same seed, same tile), while new games produce genuinely new worlds.

---

## Non-Negotiables (Explicit)

- **Determinism**: Given the same `worldSeed`, world coords, biome id, and submap coords, the 3D tile must reproduce the same macro features (paths/rivers/clearings) and baseline prop fields.
- **Persistence scope**:
  - Within a running game and across save/load: determinism holds.
  - For "New Game": `worldSeed` changes, so the same coords produce a different tile.
- **Per-submap-tile framing**: The 3D scene is a single submap tile footprint; traversal to adjacent tiles is explicit (not streaming open-world yet).
- **World model**: Use a continuous world "field" model (elevation/moisture/temp/etc.) but cache/render in tiles/chunks for performance and UI.

---

## Questionnaire (Answers Required To Finalize The Plan)

Write short answers next to each item and we will lock decisions into the "Design Decisions" section.

1. **Scene Scope**: A. Submap tile only (no continuous world traversal planned; world is huge).
2. **Cross-View Alignment**: A. Yes: 3D macro features should correspond to 2D submap features (and vice-versa).
3. **Edge Continuity**: A. Yes: rivers/roads/cliffs must edge-match across adjacent tiles (NOTE: currently not working for 2D either, but it should).
4. **"Engaging Landscape"**: Lean playability/readability first, then raise the visual ceiling. (Rationale: current 3D integration feels unstable/cursed; e.g. lighting appears to ramp until the scene blows out.)
5. **Traversal Rules**: C. Hard rules (blocked terrain), but resolve blockers via D&D-inspired narrative interactions (items/spells/skill checks/saving throws), not a bespoke physics/minigame.
6. **Actor Persistence**: Wants a staged generation model instead of two distinct "types":
   - ambient visuals exist immediately (enough to render and feel alive),
   - a "skeleton" is generated at first meaningful interaction (name, equipment, combat-relevant stats),
   - a "soul" (drives/goals/backstory) is generated when social interaction begins.
   Also: some special persistent pursuers (e.g. bounty hunters) may exist later; keep minimal to avoid overkill.
7. **NPC AI Depth**: Goal is C (deep sim), but build A -> B -> C sequentially.
8. **Combat**: Undecided. A is attractive, but environment-mutable spells make 3D combat wiring expensive; defer decision until the base world/terrain feels solid.
9. **Art Target + Perf**: Wants Valheim / Firewatch / Zelda: BotW vibes (stylized + atmospheric + readable). Browser game.
10. **World Scale**: Strongly dislikes seeing tile edges. Wants "big maps" (suggested ~20x footprint), but expects far-distance LOD and distant actor simulation (NPCs as background numbers until in range).
11. **Debugging**: Yes, strongly. Needs in-3D overlays plus a workflow where guidance is possible without "looking over the shoulder" (e.g. deterministic tile recipe + screenshot-based iteration).
12. **Data-Driven Tuning**: Does not want to hand-tune knobs. Prefer presets / profiles / "set-and-forget" authoring, with changes validated visually rather than guessing numbers.
13. **Hierarchical Discovery**: B. Fine-grained tiles are visible when zooming, but appear fuzzy/unknown until explored (no POI icons, generic hints, blurred styling).
14. **Batch Travel UX**: No skip. Multi-step travel plays out per step in real time, rolling encounters and advancing time on each crossing.

---

## Current State Assessment (Hyper-Critical)

This section is intentionally sharp. The goal is to make the real risks unmissable.

### 1) Determinism Is Underspecified For "World Continuity"

- The system is deterministic for a single tile, but **continuity across tiles is not guaranteed**.
- Without explicit edge constraints, roads/rivers will "teleport" at borders. That kills believability fast.

### 2) Biome Config Is Split Across Multiple "Truth Sources"

- 2D submap visuals use `biomeVisualsConfig` (`src/config/submapVisualsConfig.ts`).
- 3D terrain uses `getHeightConfig` / `getMoistureConfig` (`src/components/ThreeDModal/terrainUtils.ts`).
- World biome definitions live in `BIOMES` (constants).

Problem: we currently have **three knobs spaces** with no single biome "DNA" object tying them together. This guarantees drift and makes authoring new biomes expensive and error-prone.

### 3) Macro Features Exist, But The Feature Graph Is Too Thin

Current macro features are essentially:
- `path`, `river` + `riverBank`, `clearing`

That is not enough to make tiles feel authored. You get:
- a line (path),
- a line (river),
- a circle (clearing).

Engagement needs *combinatorics*: ridges, basins, saddle points, cliff bands, wetlands, terraces, dunes, scree, etc. Even if the shader looks nicer, the geometry reads repetitive without a stronger feature graph.

### 4) Prop Placement Is Still "Scatter With Rules" (No Semantics)

The system has a placement weight function (good), but props are still fundamentally:
- random points + rejection sampling + coarse masks

Missing:
- semantic clustering (groves along river bends, rockfall fields below steep slopes, dead trees in swamp pockets),
- "story props" / POI anchors and the rule that the rest of the tile composes around them.

### 5) Rendering Complexity Risks Outpacing Gameplay

Enhanced sky/water/terrain are easy to grow into a perf sink, especially with:
- splat blending, normal mapping, multi-texture sampling,
- high instance counts,
- post-processing.

If we don't tie visual complexity to measurable budgets (GPU time, draw calls, texture memory), we will regress quickly.

---

## Design Decisions (To Fill After Questionnaire)

This becomes the contract for implementation. Don't start major refactors until these are locked.

- Scene scope: Per-submap-tile 3D scene only (explicit traversal; no streaming open world).
- Edge continuity: Required (features must align across adjacent submap tiles).
- Cross-view alignment: Required (2D submap and 3D should be different renderings of the same underlying recipe).
- "Engaging landscape": Prioritize playability/readability first, then visual richness. Visual work should not block navigation semantics.
- Traversal rules: Hard blockers in the navigation layer, resolved via narrative D&D-style interactions (items/spells/skill checks/saving throws) rather than bespoke movement minigames.
- Actor persistence: Staged generation (ambient visuals -> skeleton-on-interaction -> soul-on-social), with optional special global pursuers later.
- NPC AI depth: Target C long-term, delivered via A -> B -> C phases.
- Combat integration: Deferred decision; keep exploration stable first.
- Data-driven vs code-driven knobs:
- Perf + hardware target:
- Tile edges: Must be hidden (immersion requirement).
- Tile variety: Wants within-tile diversity (micro-biomes/patches) and many deterministic POIs.
- Tile traversal UX: When approaching a boundary, show an explicit edge indicator / "travel to next tile" affordance.
- Quick travel context: Submap quick travel exists, so long walks are optional (frolic/explore/resources/ambient encounters or targeted quests).
- World map model: Continuous fields + graphs (Azgaar-like), but rendered/cached as tiles; entering 3D shows the local chunk derived from the continuous model.
- Watabou-style zoomed-in 2D POI/town maps: Desired later, but explicitly parked for this 3D implementation track.
- World map scale: Massive. When zoomed out, tiles should read as tiny; as you zoom in, render additional finer grids inside the tile (hierarchical tiling / multi-resolution grid).
- World travel: Step-based movement, but each step advances in-game time based on biome + roads + hazards (dangerous fauna, indigenous populations, etc.).
- Discovery/fog: Hierarchical zoom shows finer grids even when undiscovered, but in a fuzzy/unknown state; exact POIs/labels/details unlock via exploration.
- Batch travel UX: No skip. Big moves are decomposed into many sub-steps, each taking a short real-time delay and rolling encounter chance.

---

## Why "Navigation vs Visuals" Still Needs Prioritization (Layman Explanation)

You can absolutely *want* both equally (and you should). The reason it still becomes a trade in practice is:

- **Time budget**: Every hour spent on fancy materials/sky/post-processing is an hour not spent on the actual layout rules that make the landscape "playable" (routes, hazards, POIs).
- **Complexity budget**: Visual richness tends to multiply tech surface area (shader logic, texture memory, lighting correctness). That increases the chance of perf regressions and bugs, which then slows down gameplay iteration.
- **Readability is a gate**: If the terrain doesn't present clear traversal affordances (where can I go, what blocks me, what is interesting), then better visuals often just make "beautiful confusion."

So the plan should explicitly gate on playability first:
- Phase early: ensure the world is *readable and navigable* with stable lighting and clear traversal affordances.
- Phase later: push the visual ceiling once the layout/semantics are stable.

---

## Visual Target (Feasibility Notes)

Target inspiration:
- Valheim (stylized, low-poly, strong fog/atmosphere)
- Firewatch (painterly gradients, color design, readable silhouettes)
- Zelda: BotW (as a direction; not expecting 1:1 technical parity)
- Watabou's Procgen Arcana (strong 2D proc-gen map readability and style; potential inspiration for POI layouts and 2D exports).
- Azgaar's Fantasy Map Generator (world-scale: coastlines, rivers, regions, settlements, roads, labels; target "feel" for the macro world model).

Constraint:
- Browser/WebGL implies strict budgets on shader complexity, texture memory, and overdraw. We should aim for the *feel* of these references (palette, fog, silhouettes, composition) more than their literal material fidelity.
  
Watabou note:
- Generated images are free to use (per Watabou FAQ; attribution appreciated but not required).
- The generator source is not generally open-source, so we should treat it as inspiration and/or use generated outputs, not copy/paste code.

---

## Tile Size, Edges, And LOD (Key Design Problem)

Player requirement: "seeing the edge of the map breaks immersion."

We need a strategy that works with a per-submap-tile scene:

- Clarification: "tile transitions" in 3D refer to moving between adjacent **submap cells** (not world-map tiles).
- Desired submap grid: move toward a square `30 x 30` submap grid.

- **Horizon masking**: fog + atmospheric scattering + skybox + distant silhouette meshes (mountain ring).
- **Terrain skirts**: extend geometry downward/outward so you never see the underside/edge seam.
- **Proxy far-field**: render a very low-cost "beyond tile" ring (low-res height + cheap materials) stitched from deterministic neighbor data, without simulating actors outside the active tile.
- **Actor LOD**: far NPCs/creatures are simulated as cheap state (numbers/timers) until they enter an "activation radius" and become rendered actors.
- **Edge travel indicator**: when the player approaches the playable boundary, show a clear UI cue that they can travel to the adjacent tile (and which direction).

This section should be finalized after deciding whether the gameplay tile footprint remains ~9000 ft with visual tricks, or truly expands to much larger physical footprints.

---

## Micro-Biomes And POIs (Within-Tile Diversity)

Requirement: a single biome per world tile feels too uniform; wants diversity within reason.

Design direction:
- Keep a dominant biome id (for worldmap identity), but generate within-tile patches driven by:
  - height/moisture/slope features (wetlands near rivers, scree under cliffs, clearings, dune fields)
  - neighbor-biome influence near borders (soft transitions)
  - POI-local overrides (ruins may clear vegetation, caves may create rocky gradients)
- Avoid "spaghetti" blending failures (e.g. thin desert ribbons cutting through mountains, POIs bisected by biome seams):
  - enforce minimum region width/area for secondary patches
  - apply morphological smoothing / blobification to patch masks
  - constrain certain patches to plausible terrain (desert sands prefer low moisture + low slope; alpine snow prefers high elevation + low temp proxy)
  - if neighbor influence is enabled, keep it as a *border band* with falloff, not arbitrary lines through the tile interior
- POIs should be deterministic (seeded) and plentiful:
  - caves/dungeons, small villages, hidden groves, ruins, shrines, camps, monoliths, etc.

---

## Lighting Stability Gate

Known issue: lighting appears to ramp up over time until the scene blows out ("living inside the sun").

We must treat this as a blocker:
- identify and fix any cumulative light/exposure changes per frame or per re-render
- ensure post-processing and tone mapping are stable and idempotent
- add debug readouts for key lighting values (exposure, intensities) in the 3D HUD

---

## Perceived Scale And Movement Feel (Gate)

Observed issue: even when using D&D-ish speed (30 ft / 6s), movement *does not feel* like 6 squares per round and the world edge does not feel far away.

We should treat "feel" as part of playability:
- ensure the camera zoom/FOV/height support a believable sense of distance
- ensure the player avatar scale matches prop scale (trees are not "giants" unless intended)
- ensure there are mid- and far-field cues (fog, silhouettes, landmarks) so distance reads correctly
- provide a calibration overlay:
  - 5ft grid lines + a 30ft reference ruler in-world
  - speed readout (ft/sec and ft/round)

This is difficult to validate while lighting is broken, so lighting stability is a prerequisite.

## Target Architecture

### 1) Biome "DNA" (Single Source Of Truth)

Create a single biome-level config object that can feed:
- 3D terrain samplers (height/moisture/feature tuning),
- 3D materials (splat palette, roughness, wetness),
- prop ecology (tree/rock density curves),
- 2D submap visuals (icons/colors/features),
- encounter tables (creatures/NPC archetypes).

Implementation direction:
- Keep `BIOMES` as metadata (name, family, color).
- Add a `BiomeProcGenProfile` keyed by `biomeId`.
- Provide adapters that derive 2D visuals config and 3D sampler configs from the profile, instead of hand-maintaining multiple maps.

### 2) Feature Graph + Edge-Matching

Move from independent "feature masks" to a small graph:
- `RoadNetwork`: edges constrained (tile border continuity).
- `RiverNetwork`: edges constrained + slope-aware (always downhill-ish, even if faked).
- `Landmarks`: 1-3 anchors per tile that influence terrain and props (clearings, ruins, monoliths, camps).

Key: define border "ports" (north/south/east/west) so adjacent tiles share endpoints.

### 3) Simulation vs Rendering Split

Define a stable intermediate representation:

```ts
type Tile3DRecipe = {
  tileKey: { worldX: number; worldY: number; subX: number; subY: number; biomeId: string; worldSeed: number };
  terrain: { height: HeightFieldParams; moisture: MoistureParams; features: FeatureGraphParams };
  props: { fields: PropFieldRecipe[]; landmarks: LandmarkRecipe[] };
  actors: { npcs: ActorSpawnRecipe[]; creatures: ActorSpawnRecipe[] };
};
```

Then build:
- `Tile3DRecipe -> R3F scene objects`
- `Tile3DRecipe -> gameplay systems` (encounters, navigation constraints)

### 4) Actor Layer

Actors are seeded per tile, but have a persistence policy:
- "seed-only" mode: purely deterministic; respawns on each entry.
- "stateful" mode: store actor instances in `gameState.generatedNpcs` / `gameState.tileActors` keyed by tileKey.

The chosen policy must match Questionnaire #6.

---

## Narrative Traversal Obstacles (Scheduled Deep Dive)

Goal: blocked terrain should exist (hard rules), but resolution should feel like D&D:
- "I use rope and grapple" (item-based)
- "I cast Fly / Misty Step / Water Walk" (spell-based)
- "We climb" (skill checks)
- "The cliff crumbles" (saving throws / consequences)

High-level implementation direction (intentionally minimal for now):

- Model blockers as *navigation graph constraints*, not physics.
  - Example: an edge between two regions is blocked by `cliff_up_20ft`.
- When the player attempts to cross a blocked edge:
  1. Present 2-6 resolution options, derived from:
     - party skills (Athletics, Acrobatics, Survival, etc.)
     - spells known/prepared
     - inventory items (rope, pitons, grappling hook)
     - environment context (rain, wind, time of day)
  2. Run 1-N checks (skill checks, saves) depending on obstacle height/complexity.
  3. Apply consequences on failure (HP damage, time loss, lost item, split party, alert nearby creatures).
  4. On success: unlock the edge (temporarily or permanently) and allow traversal.

Key constraint: keep this narrative-first and reusable, so "climb 20 ft" is not a bespoke minigame.

This should likely land after world continuity + semantic terrain is stable, so we can author blockers from terrain semantics (cliffs, deep water, mud, etc.).

---

## Actor Persistence With Promotion (Scheduled Deep Dive)

Goal: avoid a hard split between "ambient" and "named" actor *types*. Instead, generate in stages so cost scales with player attention.

Proposed staged model:
- **Ambient Visuals (always)**:
  - enough to render a crowd/creature presence (silhouette, rough gear, idle behavior),
  - deterministic placement by tile seed and ecology rules.
- **Skeleton (on first meaningful interaction)**:
  - stable identity: name (or descriptor), race/gender/age if not already fixed,
  - combat-/loot-relevant structure: equipment set, class/level band, inventory rollup,
  - persistence: stored in state so revisits keep continuity.
- **Soul (on social interaction)**:
  - motivation/goal, backstory hooks, disposition baselines, memory scaffolding,
  - heavier LLM calls live here, not at spawn time.

This keeps world population cheap while ensuring anyone the player engages with becomes "real."

This needs a careful definition of "meaningful" so persistence doesn't explode state size.

---

## Implementation Plan (Phased)

### Phase 1: Lock Decisions + Add Instrumentation (No Big Refactors Yet)

- Add a permanent debug HUD in 3D showing:
  - `worldSeed`, world coords, sub coords, biome id
  - derived `submapSeed`
  - perf counters (FPS already exists; add draw calls / instance counts if feasible)
- Add a "lighting sanity" gate:
  - ensure light intensity does not accumulate over time,
  - ensure exposure/tonemapping is stable and predictable,
  - add a quick toggle to revert to a known-good baseline lighting setup.
- Add a "tile transition" control surface (north/south/east/west) to validate that seeds and macro features change correctly.
- Define the "Tile3DRecipe" shape and generate it from existing samplers (even if incomplete).

**Exit criteria**
- Enter/exit 3D is stable.
- Moving to adjacent submap coords produces a different tile deterministically.
- We can log/serialize a Tile3DRecipe for a tile for debugging.

### Phase 2: Biome Proc-Gen Profile Consolidation

- Create `BiomeProcGenProfile` and adapters:
  - `profile -> HeightSamplerConfig`
  - `profile -> MoistureSamplerConfig`
  - (optional) `profile -> submapVisualsConfig`
- Migrate existing 3D `getHeightConfig/getMoistureConfig` to use profiles.

**Exit criteria**
- Adding a biome requires editing one profile file (not 2-3 scattered maps).

### Phase 3: Edge-Matching Macro Features

- Introduce border ports for `path` + `river`:
  - deterministic selection of which edges have a river/road
  - deterministic endpoints on those edges
- Ensure adjacent tiles share endpoints and the river/road continues.

**Exit criteria**
- Step across tiles and see coherent rivers/roads across borders.

### Phase 3.5: World Travel Model (Continuous Fields, Tiled Cache)

Goal: keep player travel "tile-based" for UX and performance, while generation is continuous so rivers/biomes/roads naturally cross borders.

- Define world-space coordinates:
  - `worldPos = (worldX, worldY, subX, subY)` where `worldX/worldY` index the world tile, and `subX/subY` index the submap cell inside it.
- Continuous fields:
  - deterministic samplers for elevation/moisture/temp/roughness at any worldPos
  - derived biome at worldPos (dominant biome + patch overlays)
- World graphs:
  - rivers generated from elevation field (flow accumulation) and cached in graph form
  - roads connect settlements/POIs (graph), constrained to plausible terrain
- Cache:
  - store computed field summaries and graph segments per world tile so UI and 3D can query cheaply.

**Exit criteria**
- World map travel remains discrete and understandable.
- Entering 3D for adjacent submap cells produces continuous macro features (no seams).

### Phase 3.6: Hierarchical World Map Zoom (Massive-World UX)

Goal: make the world feel enormous without requiring an absurd single fixed grid resolution.

- Add zoom levels (conceptually L0..Ln).
  - L0: "continent view" tiles are tiny.
  - As you zoom, tiles subdivide and render finer grids inside the focused area.
- Internals: represent this as hierarchical tiling (quadtree-like) or nested grids:
  - each tile can be subdivided into child tiles deterministically from `worldSeed`
  - discovery can propagate from coarse -> fine levels (or vice-versa)
- Rendering: at each zoom level:
  - draw only the tiles needed for the viewport
  - sample the continuous world fields at the appropriate resolution for that zoom

This is a UI/UX layer over the continuous world model; it should not change the underlying determinism.

### Phase 4: Terrain Semantics + Materials

- Promote more semantic terrain regions derived from height/moisture/slope/features:
  - `mud`, `scree`, `sand`, `grass`, `rock`, `snow`, `water`, `riverbank`, `path`
- Material system uses those semantics for splat selection.
- Keep a hard budget: texture count, shader complexity, instance counts.

**Exit criteria**
- Terrain reads "biome-authentic" at a glance and is navigable.

### Phase 5: Props + Landmarks That Compose The Tile

- Move from "scatter everywhere" to "compose around anchors":
  - 1-3 landmarks per tile (ruin, campsite, shrine, monolith, grove)
  - prop fields biased around / away from those anchors
- Connect landmarks to gameplay triggers (inspection, encounters, NPC interactions).

**Exit criteria**
- Tiles feel authored: recognizable POIs, not just noise + trees.

### Phase 6: Actor Persistence + Social + Encounters

- Decide and implement persistence policy (#6):
  - deterministic respawn vs stored instances
- Add promotion policy (ambient -> persisted named actor) and define the promotion triggers.
- Integrate social UI in 3D and hook into NPC dispositions/memory.
- Hook encounters to terrain/landmarks (ambushes on roads, predators near water, etc.)

**Exit criteria**
- Meet an NPC in 3D, return later, behavior matches chosen persistence rules.

---

## Verification Plan

### Determinism Checks

- For a fixed `worldSeed` and fixed coords, assert the following are stable across reload:
  - derived submap seed
  - macro feature endpoints (roads/rivers)
  - landmark selection
  - prop field RNG sequences

### Cross-Tile Continuity

- Pick a tile and its north/east neighbors.
- Verify:
  - river endpoints align across borders,
  - road endpoints align across borders,
  - no discontinuity spikes at edges.

### Performance Budgets

- Record on target hardware:
  - FPS in a dense biome and a sparse biome
  - memory usage (rough)
  - instance counts

### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.
