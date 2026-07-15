# Absorbed: Worldforge (docs/projects/worldforge)

Status: active reference — absorbed into planmap topic `wf-interiors` on 2026-07-15.
The living-project folder (SPEC, GAPS, 100KB tracker, subproject docs, orchestration
briefs and PNG proofs) was deleted; git history is the archive. This doc preserves the
approved Worldforge SPEC verbatim (below) plus the gap register state at absorption.
The living-world sim spec, subproject trackers, and lane logs live only in git history
(`docs/projects/worldforge/` before 2026-07-15).

## Gap register at absorption (2026-07-14 state)

Open / active:

- WF-G1 (open, deliberate): `Feet` stays a plain number alias, not a branded type;
  revisit only if a real unit-mixing bug appears at the FMG-port meter boundary.
- WF-G7 (open): SP3 leaf-to-3D still owes one live regression sign-off proving
  interiors, NPCs, businesses, and combat survived the handoff / spawn-on-burg /
  coordinate-anchor work.
- WF-G8 (open): SP4 hidden places need discovered-site atlas pins — persist discovered
  ground positions, map through `groundToAtlas`, feed atlas `markers`.
- WF-G9 (open): `?phase=agentsim3d` walking-agents render rung is implemented but has
  no recorded rendered proof (night + commute clocks).
- WF-G13 (active): the SP3 selected-leaf-to-3D handoff is NOT consumed in production —
  `MapPane.handleEnter3DHere` always uses the root atlas `focusCellId`;
  `buildLeaf3DHandoff` / `leafAtlasAnchor` / `groundToAtlas` / `atlasToGround` have
  tests but no production consumers. Carry a leaf/tier address through `Entry3DAnchor`.
- WF-G14 (active): travel can persist contradictory geography — burg-shift redirects
  allow `playerCell=A` with `entry3DAnchor.cellId=B` (44 redirects at seed 42). Resolve
  one canonical cell identity before dispatch and reconcile legacy saves on load.
- WF-G15 (active): Worldforge local Travel is not gameplay — mode only changes
  highlighting and clicks drill like Explore; needs reachable/unreachable preview,
  commit/cancel/failure, locale-coordinate ownership, keyboard/touch parity.
- WF-G18 (open): Highland/River roof colors render nearly black in the daylight
  blueprint 3D preview; calibrate lighting/material response without replacing the
  resolved district palettes.

Resolved highlights (backdated on the planmap topic): WF-G6 no-fallback purge
(2026-06-20); W02 audit fixes WF-G10 canonical live atlas, WF-G11/G12 keyboard+touch
atlas accessibility (2026-07-11); the 2026-07-14 building wave WF-G16/G17/G19-G29
(building evolution, history compaction, weathering, street ensembles, courtyards,
row-roof rhythm, party-wall ownership and dressing, roof seams, lot negotiation,
terrain-stepped rows).

---

# Original approved SPEC (2026-06-11) follows verbatim
# Worldforge â€” Procedural World Pipeline Specification

Status: approved by owner (spec interview 2026-06-10/11)
Owner: Remy
Spec author: Claude (Fable 5), from a 24-question structured interview
Project folder: `docs/projects/worldforge/`
Visual baseline captures: `.agent/campaign-kickoff/` (Azgaar atlas, classic submap
layout, World3D blue-slab landing, RealmSmith pixel village)

## 1. Vision

One generation pipeline that produces the entire world at every scale, from the
Azgaar continental atlas down to the inside of a single bedroom, with every
layer derived deterministically from the layer above it â€” and a living
simulation inhabiting the result.

The player experience: scroll into the world map and the cartography keeps
deepening (region, local area) like a map that never runs out of detail; click
to step into the world itself and your party stands on that exact ground in 3D;
walk into a town whose streets and buildings were grown, not placed; open any
door and the interior is there, correctly sized, furnished, and occupied by
agents living their lives.

Worldforge **replaces** the current Submap as the canonical local-navigation
surface (Decision Blitz D3) and becomes the consumer of the tile-grid adapter
contracts (D2), the Azgaar-canonical feature decision (D1), the World3D LOD
loader contract (D4), and the unified 3D entrypoint ownership (D5).

## 2. Owner work-style directive

> "You are a terrible estimator of work duration. Don't even bother figuring
> out feasibility in time frame. Just do what you can."

This spec therefore contains **no schedule and no feasibility hedging**. It
describes the full system. Build order (Â§9) is a priority order, not a
timeline. Agents work top of the list downward, always leaving the tree in a
provable state per the repo's process rules.

## 3. Decision record (interview, 2026-06-10/11)

| # | Topic | Decision |
|---|---|---|
| 1 | Azgaar acquisition | **Port the FMG algorithms into Aralia** (TypeScript modules we own) â€” true continuation below Azgaar's floor, same mathematical character. |
| 2 | Zoom topology | **Discrete layers with named scales**; each layer a generated artifact with a defined handoff contract. |
| 3 | 2Dâ†”3D relationship | **Hybrid "live where it matters"**: 2D layers are cartography (Witcher-style map artifacts), with a curated live overlay (party position, known NPCs, active quests). The 3D ground world is canonical reality. |
| 4 | 3D gameplay end-state | **Full simulation presence** (movement/interaction implied as prerequisites). |
| 5 | Town quality bar | **All four Watabou virtues**: organic street/plot geometry, cartographic presentation, structural variety/landmarks, footprint data quality. Inspiration: watabou.itch.io, fantasytowngenerator.com. |
| 6 | Town gen lineage | **RealmSmith was the in-repo Watabou-replacement attempt** â€” Worldforge evolves/rewrites it rather than starting cold. |
| 7 | Art direction | **Procedural-realistic ambition** (not stylized low-poly, not billboards). |
| 8 | Asset policy | **Procedural shaders + AI-generated textures/assets only.** No third-party asset libraries. |
| 9 | AI-gen flow | **Runtime generation + local cache** â€” the game calls a generation service on demand and caches results. |
| 10 | Interiors | **Fully procedural room-packing** from the building footprint; furnish by room role. |
| 11 | Door policy | **Seamless** â€” interiors exist inside exterior shells in the world; no loading boundary. |
| 12 | Scale canon | **D&D feet everywhere.** 5 ft is the atomic unit at every layer; meters never appear in authored data. |
| 13 | Entity look | **AI-gen assisted characters**: parametric procedural bodies + AI-generated texture detail (faces, clothing, heraldry). |
| 14 | Persistence | **Deterministic base + delta layer** (regenerate from seed; save records diffs). |
| 15 | Town simulation | **Full agent simulation** â€” every NPC a persistent simulated agent. |
| 16 | System wiring | **Everything**: economy/businesses, worldSim history/factions, quests/encounters, crime/intrigue â€” "and more to be added later." |
| 17 | Window target | No target â€” full vision, priority order, do what we can. |
| 18 | Performance | **Owner's machine is the target** at 60fps; broader hardware later. |
| 19 | Combat handoff | **In-window stretch goal**: walking into hostiles generates a BattleMap3D fight from that spot's terrain. |
| 20 | Zoom UX | **Scroll through 2D map layers; explicit click to enter 3D** (and buildings). |
| 21 | Legacy surfaces | **Replace aggressively** â€” new layers take over as soon as they minimally function; legacy stays in-tree but unmounted (Submap extraction contracts still honored, D3). |
| 22 | Camera | **Tactical orbit + character focus** â€” orbit camera anchored to the party, boardgame feel, consistent with the battle map camera. |
| 23 | Project name | **worldforge**. |
| 24 | 2D/3D examples calibration | Factorio (one dataset) vs Witcher (map artifact) vs FM (viewer) â€” owner chose the hybrid after examples. |

## 4. The layer model

Five named layers, each deterministically derived from its parent. All
coordinates in **feet**; the 5 ft cell is atomic. (Conversion shim: Azgaar's
internal metric units are converted once, at the port boundary, and never leak.)

```
L0  ATLAS      â€” the continent. Ported-FMG world: Voronoi cells, height,
                 climate, rivers, biomes, cultures, states, burgs, routes.
                 Today's iframe map becomes a native render of owned data.
                 Scale: ~420 ft/px cartography; cells â‰ˆ thousands of feet.

L1  REGION     â€” a neighborhood of atlas cells (target: the area around one
                 cell, ~25,000 Ã— 25,000 ft). Refines L0: sub-cell heightfield,
                 river courses widened to real banks, route polylines become
                 roads with width, burg positions become town sites with
                 footprint envelopes, biome edges get natural transition
                 detail. Rendered as cartography (zoomable).

L2  LOCAL      â€” the playable area around a point of interest or the party
                 (target: ~3,000 Ã— 3,000 ft; replaces the 20Ã—30 submap).
                 Terrain materials, vegetation distribution, water bodies,
                 paths, town street networks + building footprints, POI
                 placements, encounter context. THE handoff artifact: the 2D
                 cartographic render and the 3D ground world both consume the
                 same LocalArea dataset (the hybrid model's pivot point).

L3  GROUND     â€” the 3D world built from L2: heightfield meshes (5 ft grid),
                 material splats, vegetation instances, water, building
                 exterior shells WITH interiors packed inside them
                 (seamless), furniture, props, agents. Chunk-streamed
                 (consumes the D4 LOD-in-loader + skirts contract).

L4  INTERIOR   â€” not a separate scene (door policy = seamless): the interior
                 generation pass of L3 buildings. Room-packing solves the
                 footprint into rooms by building role; furnishing rules per
                 room type; occupants assigned from the town's agent roster.
```

**Handoff contract per layer:** a typed, versioned, seed-addressed artifact â€”
`generate(parentArtifact, seedPath, bounds) â†’ LayerArtifact`. Seed path is
hierarchical (`worldSeed/cellId/regionId/localId/buildingId/...`) so any
artifact regenerates in isolation. Layer artifacts are pure data (renderable by
2D cartography or 3D); renderers never generate.

## 5. The two presentation stacks

### 5.1 Cartographic stack (L0â€“L2)
- One continuous scroll-zoom map surface replacing the MapPane iframe and the
  Submap pane: zooming crosses layer thresholds with crossfade; each layer
  renders in a coherent ink-and-parchment-meets-Azgaar style (the existing
  atlas look is the family anchor).
- **Live overlay** (the "live where it matters" hybrid): party marker, known
  NPC positions, active quest markers render as live data on the cartography.
  Everything else is map artwork.
- Click affordances: any visible point offers "travel here" / "enter world
  here" (explicit 3D entry per decision #20).

### 5.2 Ground stack (L3â€“L4)
- Chunk-streamed 3D (extends the existing World3D streamer + D4 LOD contract),
  tactical-orbit camera anchored to the party (decision #22).
- Towns and interiors stream as part of the same world (seamless doors).
- Full simulation presence: agents on schedules, weather, time-of-day.
- Combat stretch goal: hostile contact extracts the local 40Ã—30 (5 ft) terrain
  patch + participants into BattleMap3D.

## 6. Town generation (the RealmSmith rewrite)

Quality bar = Watabou's four virtues (decision #5), structured as passes over
the L2 town site envelope:

1. **Site analysis** â€” terrain fit, water access, route entries (from L1 roads).
2. **Skeleton** â€” organic street network grown from gates/market/water, not a
   grid: space-colonization or tensor-field street growth seeded by entry
   routes and terrain gradients.
3. **Blocks & plots** â€” street loops subdivided into wedge plots with density
   falloff from center.
4. **Civic anatomy** â€” walls/gates (era + wealth driven), market square,
   temple(s) per religion presence, guild halls, docks where water allows,
   castle/manor per governance â€” driven by worldSim history + factions
   (decision #16).
5. **Buildings** â€” per-plot footprint polygons (the L3/L4 contract input) with
   role, storeys, age, condition; **economy wiring**: every worldBusiness in
   this town claims a building; the owning NPC becomes its keeper agent.
6. **Population** â€” full agent roster: households, occupations, schedules
   (home/work/leisure by game time), faction/crime affiliations.
7. **Cartographic render** â€” the town as a beautiful 2D map document (zoom
   target inside L2), AND the same data extruded in L3.

## 7. Asset & material pipeline (runtime AI-gen + cache)

- A `ForgeAssetService`: `request(assetKey) â†’ cached | generate`. Asset keys
  are semantic (`texture/wall/plaster/weathered/temperate`,
  `face/human/female/40s/sun-worn`, `heraldry/state-17`). Local cache is
  content-addressed; misses call the image-generation service at runtime
  (decision #9) with graceful degradation to procedural-shader fallbacks when
  offline (the repo's Ollama-style resilience pattern applies).
- Procedural shaders remain the base layer everywhere (terrain splats, water,
  sky); AI-gen supplies what shaders can't: PBR surface detail, faces,
  clothing patterns, signage, heraldry.
- Entities: parametric body generator (evolution of CharacterActor's body
  plans) + AI-gen texture skinning (decision #13).

## 8. Simulation & persistence

- **Deterministic base + delta** (decision #14): every artifact regenerates
  bit-identically from its seed path; the save stores only diffs (deaths,
  thefts, door states, construction, reputation). Delta schema versioned from
  day one.
- **Full agent simulation** (decision #15): every generated NPC is a
  persistent agent with identity, home, schedule, and needs. Engineering
  reality on owner hardware: simulation LOD â€” full embodied agents near the
  player, schedule-level simulation for the loaded local area, statistical
  simulation (existing worldSim daily loop) beyond. The contract: **any agent
  is inspectable at full detail the moment you reach them**, which is what
  "every NPC is real" must mean at runtime.
- All existing daily-loop systems (economy steps, businesses, factions,
  history) become *inputs and consumers* of agent state rather than parallel
  abstractions â€” wired incrementally, "everything and more to be added later."

## 9. Build order (priority, not schedule)

1. **Spine first**: layer-artifact types, seed-path scheme, feet-canon
   conversion shim, `generate()` interfaces, golden-seed regression tests.
2. **FMG port, minimum viable atlas**: heightmap â†’ cells â†’ rivers â†’ biomes â†’
   burgs â†’ routes generation natively, validated against the same-seed iframe
   output; native L0 cartographic render replacing the iframe.
3. **L1 region generation + scroll-zoom cartography** (the first visibly new
   thing: the map keeps zooming past today's floor).
4. **L2 local generation** (wilderness first: terrain/vegetation/water/roads)
   + cartographic render + live overlay; aggressive cutover of the submap slot
   (legacy stays in-tree, unmounted; D3 contracts honored via adapters).
5. **L3 ground mode on L2 data**: stream the local area in 3D, party present,
   orbit camera, walkable terrain (replaces World3D's blue slab with real
   ground).
6. **Town generator passes 1â€“5** (skeleton â†’ plots â†’ anatomy â†’ buildings) with
   the 2D town map render; first walkable 3D town exteriors.
7. **L4 interiors**: room-packing + furnishing + seamless doors.
8. **Entity pipeline**: parametric bodies + ForgeAssetService + AI-gen
   skinning; agent roster + schedules in towns.
9. **System wiring waves**: economy/businesses â†’ history/factions â†’
   quests/encounters â†’ crime/intrigue.
10. **Stretch**: combat handoff from ground mode.

Every numbered item ends with: capture proof, tracker update, gap log per the
living-project protocol.

## 10. Honest risks (recorded, not used to shrink scope)

- **FMG port fidelity**: matching Azgaar's output exactly for existing saves'
  seeds may be impossible (JS float/order quirks); mitigation â€” the port
  becomes canonical going forward (D1 makes Azgaar-the-data canonical, not
  Azgaar-the-iframe), and existing-world continuity is handled by importing
  the current world's exported data as a frozen L0 artifact.
- **Seamless interiors + procedural-realistic + full agents** is a maximal
  triple; sim-LOD (Â§8) and chunk-LOD (D4) are the designed pressure valves â€”
  fidelity scales down with distance, never with scope.
- **Runtime AI-gen** is a live dependency in the player path; the procedural
  fallback layer (Â§7) must always render *something* coherent.
- **Aggressive replacement** (decision #21) means daily play may be rough
  mid-campaign; the Submap dependency contracts (D3 inventory) are the
  checklist that nothing load-bearing is lost.

## 11. Post-spec owner clarifications

### 2026-06-11 â€” Azgaar cells are the canonical L0 unit (owner)

- Worldforge layers key off **Azgaar's Voronoi cells**, not square approximations.
  The ported generator already produces true Voronoi cells (FMG's jittered-grid
  â†’ Voronoi pipeline); the early debug renders that looked square used the fast
  square-grid lookup and were misleading â€” the render rig now draws real cell
  polygons (`fmg-voronoi-*.png`).
- Seed-path convention: region/local segments key off the **FMG cell id**
  (`cell:<id>`), not atlas x-y coordinates. (The spine's `cell:71-8` examples
  were illustrative strings predating this clarification; the legacy MapPane
  "Cell 71,8" x-y convention is superseded for Worldforge purposes.)
- L1 region generation derives from a cell neighborhood around the anchor
  cell id, honoring true cell adjacency (`cells.c`), not square windows.

### 2026-06-11 â€” World-generation options: exposed at creation, frozen in play (owner)

- The full FMG options surface (Azgaar's menu: points/cells density, template,
  sea level, temperature equator/pole, precipitation, cultures/states/burgs
  counts, etc.) is part of what we own now. Worldforge mirrors it as a typed
  `WorldGenOptions` object: **exposed in the world-creation UI, recorded
  verbatim in the L0 artifact, immutable after game start**.
- In-game, generation options are read-only world facts â€” no option may
  mutate during gameplay (regeneration = new world, never an edit to a live
  one). UI surfaces that show the options post-creation render them disabled.
- Options defaults match upstream FMG defaults so a default Worldforge world
  is a default Azgaar world.

### 2026-06-22 â€” Azgaar-authoritative recursive cartography + SVG render-port (owner session)

A long design session (resumed from the "world map player marker + Enter-3D"
thread) refined the cartographic stack (L0â€“L2) and its relationship to Azgaar.
The decisions below **supersede** the conflicting parts of Â§5.1 and Â§9.2 where
noted. Reference captures live in `.agent/azgaar-ref/` (real Azgaar) and
`docs/projects/worldforge/orchestration/proof/` (native render).

**1. Azgaar stays the authoritative top layer; render it natively in SVG for parity.**
- Today the World Map embeds the *real Azgaar app in an `<iframe>`*
  (`public/vendor/azgaar/`, `src/components/MapPane.tsx`). A native render
  (`AtlasMapView` + `atlasDraw`, **canvas**) exists but is unmounted and below
  parity â€” that gap is the "WF quality I wasn't impressed by."
- Decision: L0 becomes a **faithful SVG render-port** of the owned FMG data.
  Generation is already a faithful port (`src/systems/worldforge/fmg/`); we now
  also port Azgaar's *rendering technique* for 1:1 parity, then retire the
  iframe. This **supersedes Â§9.2's** renderer-agnostic "native L0 cartographic
  render" (the canvas `atlasDraw` was the approximation that underdelivered) and
  Â§5.1's renderer-neutral language.
- Render study (real Azgaar, seed 761): the polish = (a) **merged per-region
  polygons** â€” one path per state/biome at low opacity over a parchment
  landmass, so there are **zero Voronoi facets at any zoom**; (b) **rivers as
  discharge-tapered filled ribbons** (`fill`, `stroke:none`), hairline at source
  â†’ fat channel at mouth; (c) **bÃ©zier-smoothed** coastlines, routes, and ocean
  depth contours; (d) an ordered **~30-layer `<g>` stack** toggled by `display`
  (oceanâ†’lakesâ†’landmassâ†’textureâ†’biomesâ†’riversâ†’reliefâ†’regionsâ†’provsâ†’bordersâ†’
  routesâ†’coastlineâ†’labelsâ†’iconsâ†’markersâ€¦) â€” that *is* how "layers" work; (e) an
  SVG **filter library** (`paper`, `blur1â€“10`, `dropShadow`, `outline`,
  `crumpled`, `turbulence`) for texture/relief/ink. SP0 reproduces these.

**2. Recursive Voronoi submap tiers, clipped to the parent cell's polygon.**
- Each cartographic tier (L0 world â†’ L1 region â†’ L2 local) is itself an
  Azgaar-style **Voronoi cell map**; clicking a cell drills into a submap
  **shaped like that cell's polygon**. The square `REGION_SIZE_FT` window in
  `generateRegion.ts` is an unfortunate inheritance from the old 20Ã—30 DOM
  submap and is **removed** â€” this realizes Â§11's "not square windows" at the
  implementation level (the submap boundary is the parent cell outline).
- **Inheritance contract (the "Bomnogorvan" rule):** a submap does **not** roll
  new top-level set pieces. It inherits the parent cell's burg **by identity**
  (same name/population/culture/state â€” not a re-roll), plus its rivers, roads,
  biome, and ownership, **projected by relative position** into the enlarged
  submap and snapped to the containing sub-cell. A burg at a parent cell's apex
  appears in a sub-cell at the submap's apex, where the inherited roads meet.
- Generator split: WF's owned machinery (`fmg/voronoi`, `generateRegion`
  inheritance helpers, `seedPath`) **drives** the submaps but **derives all
  contents from the Azgaar parent cell** â€” WF never generates a competing world.
  Source of truth flows strictly downward: Azgaar L0 â†’ WF L1+. This corrects any
  reading of Â§9.2 where the FMG port might "own L0 generation" independently:
  the port reproduces *Azgaar's* world (same seed/options); for an existing
  world its exported data is the frozen L0 (per Â§10).
- The existing heightfield + town-envelope L1/L2 artifacts remain the
  **terrain/3D** derivation; the **Voronoi sub-cell graph** is added as the
  first-class **navigation/cartographic** surface of each tier.

**3. Discovery: the base world is known; hidden places are found.**
- The party grew up in this world â€” every cell, nation, biome, road, and town
  on the atlas is visible and **travelable from the start**. No terrain
  fog-of-war, no per-cell discovery gate (an earlier per-cell-discovery idea was
  dropped here).
- Discovery applies only to **hidden off-map places** (ruins, caches, shrines,
  dungeons): deterministically placed, **physically present in the 3D world**,
  absent from the atlas until the player **comes within proximity in 3D**, where
  they pin on the map. Full loop = placement â†’ 3D proximity reveal â†’ atlas pin
  (the L3 `handleGroundPositionChange` hostile-proximity loop is the hook).

**4. 3D at the leaf cell (hybrid).** Drilling bottoms out at L2 local; explicit
click enters L3 ground there (consistent with Â§5.2/Â§9). Proposed, to confirm
when SP3 is specced: the **leaf submap is the authority for geometry/placement**
(terrain, biome, where the burg/river/road sit) and **Worldforge L2/L3 is reused
as the content provider** (town plan via `generateTownPlan`, roster, businesses,
interiors, combat) â€” Azgaar-authoritative placement, Worldforge content reuse.

**5. Always-on party marker** on every cartographic tier (the live overlay of
Â§5.1), anchored to the party's current cell â€” trivially owned once L0 is native
SVG (the original "player location indicator missing" bug is a symptom of the
iframe coordinate indirection).

**6. Town generation â€” confirmed implemented, and Azgaar has none to port.**
Â§6 passes 2â€“3 are realized by `src/systems/worldforge/town/generateTownPlan.ts`
(organic radial street growth + plot subdivision with SAT collision), fed by
`generateRegion` town sites and consumed by `World3DWrapper`/`groundChunkLoader`
â€” the verified L2â†’L3 town path SP3 will consume.
- Verified from the vendored source: **Azgaar does not generate town layouts
  locally.** The Edit-Burg "burg preview" (`modules/ui/burg-editor.js` â†’
  `Burgs.getPreview`) delegates to *external* Watabou web tools
  (`watabou.github.io/city-generator | village-generator | dwellings`), embedded
  via `<object data="â€¦&preview=1">`. Azgaar only places the burg (point, name,
  population, type, port/citadel, emblem) and passes its *context* as URL params:
  deterministic seed (`seed+burgId`), size from population
  (`2.13Â·(popÂ·rate/density)^0.385`), and tags `river|coast|port|biome|confluence|
  citadel|connectivity`.
- Implication: there is **nothing in Azgaar to port for town interiors**;
  `generateTownPlan` is the owned Watabou replacement (decision #6), and the
  burgâ†’Watabou parameterization above is the reference for how a burg should map
  to its town. This confirms the layer ownership split: **Azgaar owns the world +
  burg placement; Worldforge owns the town** (and everything below it).

**7. Decision â€” we do NOT use or clone Watabou; towns are wholly owned.**
- Watabou's generators (`city-generator`, `village-generator`, `dwellings`) are
  **not open source**; the author (Oleg Dolya) has explicitly declined to share
  the code, calling out AI-reproduction specifically. We respect that: **no
  embedding his hosted tool in gameplay, no reverse-engineering, no scraping his
  output to clone the algorithm.** Beyond ethics, an online third-party hosted
  generator violates the owned/offline/deterministic/seed-addressed contract.
- Town generation is built **clean-room** from the public procedural-city
  literature (Voronoi/medial-axis ward subdivision, wall+gate placement, street
  growth, recursive plot subdivision) and our own code. Watabou's *output
  quality* is the bar (decision #5), never a source.
- Architecture note: a **Voronoi-ward** town generator is the natural **deepest
  tier** of the recursive cartography â€” the burg footprint subdivides into wards
  (Voronoi cells) â†’ blocks â†’ building plots, reusing the same clip-to-parent +
  re-tessellate machinery as the worldâ†’regionâ†’local submaps. This is the
  preferred evolution target; the current organic-radial `generateTownPlan` is a
  valid interim approach. Town UX mirrors Azgaar's two affordances, owned: inline
  L2 cartographic render (glance) + explicit enter-3D (step in).

**8. Town generator â€” quality benchmark vs Watabou + acceptance criteria (new SP-T).**
Benchmark (2026-06-22): `generateTownPlan` was rendered at village/town/capital
scales (`.agent/town-compare/render-towns.mjs` â†’ `ours-{village,town,capital}.png`)
and judged against Watabou (the in-app "Asktas" burg preview as reference â€” *not*
re-pulled; per item 7 no Watabou scraping). **Verdict: ours produces a
street-lined scatter, not a town** â€” good at hamlet scale, weak at town, poor at
capital. The bones are sound (deterministic organic streets, clean SAT-checked
footprints, role/storey tags); the settlement-making subsystems are absent.

Failure modes (evidence in `src/systems/worldforge/town/generateTownPlan.ts`):
- **No enclosed blocks** [critical] â€” streets never form a connected planar
  graph: primaries are independent gateâ†’center paths, secondaries are dead-end
  stubs, the ring floats unsnapped. No faces to subdivide â†’ the root cause.
- **Beads-on-a-string** [critical] â€” plots walked along streets with
  neighbor-rejection *guarantee* gaps; no party-wall frontage; hollow block
  interiors.
- **Density from street length, not population** [critical] â€” thin lattice over
  an oversized box.
- **Size cap + no typology** [high] â€” envelope caps at 4000 ft half-extent
  (`generateRegion`), so town (pop 2484) and capital (pop 12000) are the same
  size; no wall/citadel emergence with scale.
- **Civic anatomy missing (SPEC Â§6 pass 4)** [high] â€” no walls, gatehouses,
  castle/keep, temple/cathedral, market *square* (plaza), guild halls, or docks,
  despite religion/port data being available.
- **No terrain/water integration** [high] â€” town gen takes only envelope+gates;
  can't hug/bridge a river, site a harbor, or avoid slopes; the region
  heightfield is never passed down.
- **Road identity dropped at the gate** [medium] â€” internal streets don't
  continue the approaching road's direction/identity.
- **Geometry monotony** [medium] â€” uniform axis-to-street rectangles, rigid
  orientation, 3 fixed street widths, no L-shapes/courtyards/alleys/size
  power-law.
- **Degenerate fallback** [low] â€” no gates â†’ one horizontal street.

Acceptance criteria for the owned town generator (ranked):
1. **Blocks first** â€” Voronoi-ward / block-face subdivision; buildings fill
   enclosed faces (no beads-on-string).
2. **Density** â€” contiguous party-wall frontage + interior infill; coverage
   scales to population.
3. **Civic anatomy (pass 4)** â€” walls + gatehouses (era/wealth-gated), market
   plaza (open space), temple(s) per religion presence, castle/keep per
   governance, docks where water allows.
4. **Terrain/water** â€” consume the region heightfield + river/coast; site on
   water; bridges; slope-aware streets.
5. **Typology by scale** â€” uncap by area; hamlet â†’ village â†’ walled town â†’ city
   â†’ capital (+citadel/cathedral) thresholds.
6. **Variety** â€” footprint shape/size distributions, orientation jitter, street
   hierarchy with alleys, road-continuation main streets.

This becomes **SP-T (Town generator, Voronoi-ward)** â€” slots **after SP1**
(reuses its clip-to-parent + re-tessellate machinery as the deepest tier) and
**before SP3** (leafâ†’3D consumes the town). The current `generateTownPlan` stays
as the interim renderer until SP-T lands.

**Sub-project order for this slice (each its own spec â†’ plan):** SP0 SVG atlas
render-port (L0 parity, retires the iframe, delivers the marker + cell-click) â†’
SP1 Voronoi submap engine (the inheritance contract) â†’ **SP-T town generator
(Voronoi-ward, acceptance criteria above)** â†’ SP2 tiered navigation + render
(retires the square DOM submap) â†’ SP3 leafâ†’3D (hybrid) â†’ SP4 hidden-places loop.

## 12. Relationship to existing projects

- **Submap** â†’ replaced surface; its extraction contracts are Worldforge
  acceptance criteria (D3).
- **World System** â†’ the new world-geography contract of D2 is *authored by
  Worldforge* (L0â€“L2 artifact types); tile-grid adapters preserve legacy
  consumers until cutover.
- **WorldSim Service** â†’ consumes D1 (Azgaar canonical): its feature
  derivation re-roots onto ported-FMG artifacts.
- **World3D / World 3D UI** â†’ L3 is built on their streamer + entrypoint
  ownership (D4, D5); 3D visual-quality work (.agent/GOAL) continues as the
  L3 quality bar.
- **RealmSmith** â†’ lineage donor for the town generator; its types/passes are
  the starting vocabulary for Â§6.
- **Town/Village view** â†’ replaced by L2 town cartography + L3 ground towns.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/projects/worldforge/SPEC.md","sha256WithoutMarker":"7fa4b66988169d799d9313341632be8f80a91443bd373e1ddb697a282cc6bd30","markedAtUtc":"2026-06-26T00:24:25.883Z"} -->
