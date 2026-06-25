# Maritime Travel — Harbors, Ferries & Owned Ships

**Date:** 2026-06-25
**Status:** Design approved (routing core = Approach A; all 6 subsystems in v1)
**Area:** Worldforge world-map travel (extends the existing land travel system)

## Problem

The world-map travel system can plan a fastest route over the owned FMG atlas, but
it is **single-mobility per trip**: a land transport's `passable` predicate admits
*only* land cells, a water transport *only* sea cells, and air both
(`systems/worldforge/travel/atlasTravelGraph.ts`). A journey therefore cannot cross
land → sea → land, so **islands (and any landmass separated by water) are
unreachable**. There is no concept of boarding a vessel, a harbor, a ferry, or an
owned ship.

FMG already generates the maritime substrate we need:

- **Ports** — `pack.burgs[i].port` holds the water-feature id a burg harbors on. A
  burg becomes a port when it sits on a "safe harbor" cell (`cells.harbor === 1`, i.e.
  exactly one adjacent water cell) or is a capital on any harbor (`burgs-generator.ts`
  `shift()`). `cells.haven[cell]` is the adjacent water cell a port opens onto.
- **Sea routes** — `routes-generator.ts` `generateSeaRoutes()` connects ports on the
  same water feature, stored in `pack.routes` with `group: "searoutes"`.

What's missing is (a) a routing model that crosses water at harbors, (b) the
player-facing boat/ferry choice, and (c) a guarantee that reachable islands actually
have a harbor.

## Decisions (from brainstorming)

1. **Harbors-only embarkation.** You may only board/leave a vessel at a port. Walking
   a galley onto a random beach is out. (Carrying your own shrinkable/summonable craft
   to launch from any coast is an explicitly **deferred future extension** — it needs
   an in-fiction justification like a dimensional pocket.)
2. **Both ferries and owned ships.** Ferries-for-hire run along the generated sea
   lanes (pay gold, follow port→port lanes). An owned ship can sail port→port on open
   water (free, flexible) **but only departs from the port where it is physically
   docked**.
3. **Auto multi-modal routing.** Hovering a destination previews ONE fastest route
   that stitches land and sea legs automatically. No manual leg-picking.
4. **Top-of-map default travel mode.** The land mode (foot/horse/…) and the sea
   preference (ferry vs. your ship) are chosen at the top of the world map, as the
   trip default.
5. **Routing core = Approach A** — a unified multi-modal graph with per-cell edge cost
   and port transfer edges, planned by the existing Dijkstra.
6. **Island reachability is guaranteed.** Every *significant* landmass gets at least a
   minimal harbor (a fishing village with a dock) so it can be reached.
7. **Dock size matters.** A ship larger than a dock cannot berth, but can **anchor
   offshore and land passengers via tenders** (sloops/rowboats) — a short extra leg.

## Architecture

The work decomposes into six subsystems, all in v1, layered so the routing core comes
first and the rest attach as graph attributes or state.

```
generation ──► ensureIslandHarbors ──► ports + dockSize on every reachable landmass
                                           │
player state: ownedShips[{vehicleId, dockedPortId}], gold
                                           │
top-of-map default: landMode + seaPreference (ferry | ship)
                                           ▼
        buildMultiModalAtlasGraph(atlas, { landMode, sea, ownedShipPort, dockSizes })
                                           │  (per-cell speed, port transfer edges,
                                           │   ferry-lane bonus, sea danger)
                                           ▼
        planRoutesFrom (existing Dijkstra, generalized to per-edge cost)
                                           ▼
        MultiModalRoute { points, segments[land|sea|tender], time, landMiles,
                          seaMiles, fare, danger, embarkPort, arrivePort }
                                           ▼
        AtlasSvgView: segmented line + harbor markers + composite readout
                                           ▼
        depart ──► deduct fare (ferry) | relocate ship (owned) ──► encounter roll
```

### 1. Routing core — unified multi-modal graph (Approach A)

**Enabling refactor.** `systems/travel/routePlanning.ts` currently derives one
`transportSpeedMph(transport)` for the whole trip and scales every edge by
`TERRAIN_TRAVEL_MODIFIERS[terrain]`. Generalize the `TravelGraph` interface so the
**edge cost is supplied per edge** by the graph, not computed from a single trip-wide
speed:

```ts
interface TravelGraph {
  neighbors(c: number): number[];
  position(c: number): [number, number];
  passable(c: number): boolean;
  /** minutes to travel from cell `a` into neighbor `b` (already accounts for
   *  miles, the mover's speed on that edge, terrain, and any transfer cost). */
  edgeCost(a: number, b: number): number;
  danger(c: number): number;
}
```

The Dijkstra in `planRoutesFrom` changes only in that it calls `graph.edgeCost(cur, nb)`
instead of computing cost from a global speed. `transportSpeedMph` moves *into* the
graph builders. Land-only graphs keep identical behavior (a thin `edgeCost` that
reproduces today's `miles / (speed × terrainMod) × 60`), so existing land travel and
its tests are unaffected.

**`buildMultiModalAtlasGraph(atlas, opts)`** (new, in
`systems/worldforge/travel/`) produces one graph over *all* atlas cells:

- **Land cells** (`h ≥ 20`): passable; `edgeCost` at the player's land mode speed ×
  terrain (roads/difficult/open) — the current land logic.
- **Sea cells** (`h < 20`): passable **iff** the trip has a sea capability (a ferry is
  available, or the owned ship's voyage is active); `edgeCost` at the relevant vessel
  speed. Ferry-lane cells (a set built from `searoutes`) get a speed bonus and lower
  danger; off-lane open water is slower and more dangerous (owned-ship only — ferries
  never leave their lanes).
- **Port transfer edges:** for each port burg, an edge linking its land cell to its
  `haven` water cell with a **boarding cost** (docking/loading time). Dock-size logic
  (subsystem 2) sets this cost and whether a tender leg is inserted.
- **Owned-ship gate:** open-water sea edges are only enabled when
  `opts.ownedShipPort === embarkPort` (you can only sail your own ship from where it's
  moored). Ferry sea edges are enabled at any port that the sea-lane network reaches.

The route the planner returns is post-processed into a `MultiModalRoute`: classify each
polyline point as `land | sea | tender` by the cell it sits in, split into `segments`,
and tally `landMiles`, `seaMiles`, `time`, `fare`, `danger`, and the embark/arrive
port ids.

### 2. Island reachability pass — `ensureIslandHarbors`

A post-generation pass (runs once, in the atlas build pipeline) that guarantees
connectivity:

1. **Find landmasses.** Connected-components over land cells via `cells.c` neighbors
   (water cells break components). Each component = one landmass.
2. **Significance filter.** A landmass needs a harbor only if it is "significant" —
   threshold on land-cell count **or** it contains a burg, a hidden site, or other
   player-relevant content. Tiny uninhabited rocks are skipped (no dock spam).
3. **Ensure a port.** If a significant landmass already has a port burg, done. Else:
   - If it has a non-port coastal burg, **promote** the best one (highest `harbor`
     score / lowest `haven` count) to a port — a fishing village gains a dock.
   - If it has *no* burg, **spawn a minimal fishing village** at its best harbor cell
     (a coastal cell with the safest harbor) and mark it a port.
4. **Connect to the sea network.** Add the new/promoted port to the sea-route lane
   graph so ferries can reach it (link to the nearest port on a reachable water
   feature).

Output: every significant landmass has ≥1 reachable port. Deterministic from the world
seed.

### 3. Dock tiers + tender legs

- **`dockSize`** on each port: `small | medium | large`, derived from burg
  size/population (fishing village → small; town → medium; city/capital → large).
- **Ship draft/class:** extend `STANDARD_VEHICLES` water entries with a `dockClass`
  (`rowboat/keelboat` = small, `galley` = medium, `warship` = large), i.e. the minimum
  dock that can *berth* it.
- **Berthing rule** at a destination port:
  - `ship.dockClass ≤ port.dockSize` → **berth directly** (boarding cost = base dock
    time).
  - `ship.dockClass > port.dockSize` → **anchor offshore + tender leg:** the route
    inserts a short `tender` segment from an offshore anchor cell to the dock at
    rowboat/sloop speed, adding time and a small danger bump. Lets a galley deliver
    passengers to a small fishing dock.
- Ferries always berth (they're sized to their lane's ports), so tenders only arise for
  oversized **owned** ships at small docks.

### 4. Ferry fares

- **Fare** = `baseRate × seaMiles × shipClassFactor`, computed over the ferry sea
  segment. Shown in the readout pre-departure.
- Ferries exist **only along generated sea lanes** between connected ports; if no lane
  reaches the destination's water feature, the ferry option is unavailable there (the
  player needs their own ship).
- **Departing deducts the fare** from `gold`. The player's sea preference
  (`ferry` | `ship`) selects the option — there is no silent cross-fallback between
  them. If the chosen option is unavailable for this trip (ferry: can't afford it or no
  lane reaches the destination; ship: not docked at the embark port), the route says so
  honestly ("can't afford passage" / "no lane to here" / "your ship isn't docked here")
  rather than quietly substituting the other mode.

### 5. Sea danger & encounters

- **Sea danger tables** parallel the land `BIOME_DANGER`: established lane (low) <
  coastal water < open ocean (high). Distance from the nearest lane / coast scales it.
- Sea segment danger feeds the **existing** `dangerRating` + encounter roll, extended
  so a voyage can roll a sea encounter (storm, pirates) per sea segment, not just land.
- Owned-ship open-water routes (off-lane) carry more danger than ferry-lane travel —
  the cost of flexibility.

### 6. Top-of-map default mode + segmented visualization

- **Top control:** the existing transport control at the top of the world map becomes
  the trip default — a land-mode selector plus a **sea-preference** toggle
  (`Ferry` / `Your ship`). Owned-ship is disabled (greyed, with reason) when no ship is
  docked at a usable embark port.
- **Segmented route line** in `AtlasSvgView`:
  - Land segments: solid, land-mode colored (as today).
  - Sea segments: wavy/dashed blue; ferry-lane vs. open-water visually distinct (e.g.
    steady dashes on a lane, lighter dashes off-lane).
  - Tender segment: short dotted hop from the offshore anchor to the dock.
  - **Harbor markers** (anchor/dock glyph, constant screen size) at the embark and
    arrive ports; the existing constant-size "Travel to" flag stays at the destination.
- **Composite readout:** total time, `land mi + sea mi`, fare (if ferry), and danger
  (segmented or worst-segment), extending the current `formatRouteSummary`.

## Data / state changes

- **`GameState`** (update both factory functions per the project rule —
  `utils/core/factories.ts` *and* `state/initialState.ts`):
  - `ownedShips: { id: string; vehicleId: string; dockedPortId: number }[]`
  - travel default already partly exists (selected transport); add `seaPreference:
    'ferry' | 'ship'`.
- **Atlas artifact:** `dockSize` per port; the `ensureIslandHarbors` additions
  (promoted/spawned ports) baked into the generated pack so they're deterministic and
  available to both the map and the route graph.
- **`STANDARD_VEHICLES`** water entries gain `dockClass`.

## Module boundaries (new / changed)

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `routePlanning.ts` (changed) | Dijkstra over `edgeCost`; `TravelGraph` now exposes per-edge cost | — |
| `atlasTravelGraph.ts` (changed) | land graph re-expressed via `edgeCost` (behavior-preserving) | routePlanning, types/travel |
| `multiModalAtlasGraph.ts` (new) | unified land+sea+transfer graph; ferry-lane set; owned-ship gate | atlas pack, routePlanning |
| `ensureIslandHarbors.ts` (new) | connectivity pass: components → significance → ensure/promote/spawn port → link lane | fmg pack, burgs/routes |
| `dockTiers.ts` (new) | dockSize derivation, berth-vs-tender decision, tender leg insertion | vehicles, atlas |
| `seaDanger.ts` (new) | sea danger tables + lane/coast scaling | atlas |
| `ferryFare.ts` (new) | fare calc + affordability | gold, route |
| `travelReadout.ts` (changed) | composite multimodal summary | route |
| `AtlasSvgView.tsx` (changed) | segmented line, harbor markers, sea readout | route model |
| `MapPane.tsx` (changed) | top-of-map default (land mode + sea pref), feed graph, depart→fare/relocate/encounter | all above |

## Testing strategy

Pure modules get unit tests (project pattern):

- `ensureIslandHarbors`: a seed where an island has no burg → a fishing-village port is
  spawned and reachable; an island with a non-port burg → promoted; a tiny rock →
  skipped. Determinism (same seed → same ports).
- `multiModalAtlasGraph` + `planRoutesFrom`: mainland→island yields a route whose
  segments are land→sea→land through the expected ports; owned-ship route disabled when
  ship docked elsewhere; ferry disabled when no lane reaches the feature.
- `dockTiers`: galley→small dock inserts a tender leg; keelboat→small dock berths
  directly.
- `ferryFare`: fare scales with sea miles + class; unaffordable disables ferry.
- `seaDanger`: open ocean > coastal > lane; encounter roll fires on a sea segment.
- `AtlasSvgView`: a multimodal route renders distinct land/sea/tender segments + harbor
  markers (testids), and the readout shows fare + sea miles.

Visual-inspection rule: render a headless atlas with a known mainland→island route and
read the PNG to confirm the segmented line, harbor glyphs, and tender hop match the
data.

## Out of scope (deferred, vision retained)

- Carry-your-own-craft embarkation from any coast (needs dimensional-pocket / shrink /
  summon fiction).
- Ferry **schedules / wait times** (v1 ferries are always available on their lanes).
- Ship **upkeep / crew / cargo** economy beyond fares.
- Naval combat (encounters are rolls, not tactical battles, in v1).
- Sub-map / region-tier sea travel (v1 targets the world atlas tier; the multimodal
  graph generalizes to lower tiers later).
