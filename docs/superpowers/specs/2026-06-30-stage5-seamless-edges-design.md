# Stage 5 — Seamless Edge-Crossing (open-region walking) — Design

**Date:** 2026-06-30
**Status:** Approved (design) — implementing the SEAM-FIRST THIN VERTICAL SLICE
**Program:** [Cell-native world umbrella](2026-06-29-cell-native-world-umbrella.md), Stage 5
**Unifies:** the umbrella's Stage 5 (state: re-anchor the cell on edge-cross) with the
[open-region wilderness design](2026-06-29-open-region-wilderness-design.md) (rendering:
height + scenery as pure functions of world position).
**Foundations (implemented):** Stage 1 cell-addressed entry, Stage 2 `playerCell`, Stage 3 Locale
movement (`playerGroundPos` ↔ `localeCoords` feet), Stage 4 atlas-travel arrival.

## Goal

The player walks off the edge of the cell they're standing in and **keeps walking into the
adjacent cell** — no load screen, no invisible wall, no compass. Crossing a cell boundary
re-anchors the canonical `playerCell.cellId` to the neighbour and streams that neighbour's
ground, continuously. This is the new continuous overland mover that **replaces compass / 30×20
grid stepping** (Stage 6 deletes the compass). Atlas fast-travel (Stage 4) remains the long-hop
mover; Stage 5 is the *continuous* analogue of Stage 4's *discrete* cell change and reuses the
same invariant: **cell change ⇒ reset/translate Locale feet, re-anchor entry.**

## Substrate (verified 2026-06-30)

- **Ground world is single-cell + bounded.** `groundChunkLoader.makeGroundWorld(local,…)` builds a
  `GroundWorld { cols, rows, heights[], biomeIds[], extentMetersX = cols×1.524, extentMetersZ }`
  from ONE cell's `LocalArtifact`. `World3DWrapper` spawns the camera and dispatches
  `SET_PLAYER_GROUND_POS { tileX, tileY, xM, zM }` (~10 Hz) as it walks. **No edge detection in
  ground mode** — past `extentMetersX/Z` the camera just clamps (`World3DWrapper.tsx`).
- **Adjacency:** `atlas.pack.cells.c[cellId]` = neighbour cell ids (unordered Voronoi neighbours);
  `cells.p[cellId] = [x,y]` site (FMG graph px); `cells.h[cellId]` height (≥20 land). The
  direction to a neighbour = sign of `(cells.p[nb] − cells.p[cell])`. Already used by
  `buildAtlasNeighbourhood`.
- **Re-entry spawn:** `World3DWrapper` restores `playerGroundPos.xM/zM` only when its `tileX/tileY`
  match the entry tile, else burg/centre; the build effect re-runs on `currentLocationId` /
  `worldSeed` / `entry3DAnchor` changes. **No mechanism today re-streams the ground mid-session on
  a cell change** — Stage 5 adds exactly that signal.
- **Determinism already exists** (open-region decision 3): land is a pure function of `(seed, cell)`
  recomputed identically every entry; player edits live in `state.worldforgeDeltas`.

## The one genuinely-risky claim (seam-first slice targets it)

**Height must be continuous ACROSS a cell boundary** — two adjacent cells' ground meeting without a
cliff. Within a cell it's already fine. Per the open-region design the fix is **height as a pure
function of world position** (`h = f(worldX, worldY)` = FMG coarse field interpolated + world-(x,y)
noise), so the shared edge of two cells evaluates to the same height from both sides **by
construction — zero stitching code**. The seam-first slice exists to put this in front of Remy's
eyes on day one: walk across ONE working cell seam on bare ground and eyeball it. Everything else
(scenery, vistas, water) layers on only after the seam is proven.

## Approach — the seam-first vertical slice (additive)

Build the smallest thing that proves continuous cross-cell walking, in dependency order. Each step
is its own TDD cycle; the legacy compass/grid stays fully working throughout (Stage 6 removes it).

### S5.1 — Neighbour-cell resolution (pure, testable) — *first code slice*
New pure helper `cellNeighbourInDirection(atlas, cellId, dx, dy)`: from `cells.c[cellId]`, pick the
land neighbour whose site offset `(cells.p[nb] − cells.p[cellId])` best matches the crossing
direction `(dx,dy)`. Plus `worldPosToCell(atlas, x, y)` (nearest-cell, reusing the existing
nearest-cell scan) for "which cell does this world position fall in?". Pure, no React; golden
tests against a real atlas (a cell's chosen E/N/… neighbour is adjacent in `cells.c` and lies in
that direction).

### S5.2 — Pure-position height + the SEAM TEST (the risk) — *prove continuity*
A `groundHeightAtWorldPos(seed, worldX, worldY)` that is continuous everywhere (FMG-interpolated
coarse + deterministic world-position noise). **Failing test first:** sample the shared boundary
between two adjacent land cells from both cells' frames and assert the height agrees to a tight
tolerance (no cliff). Then an EYEBALL via the existing headless 3D capture (shoot.mjs /
`fmg-render` rig, per the visual-inspection rule): two adjacent cells' bare ground rendered meeting
flat. **Gate:** Remy sees the seam before any further layering.

> **CONFIRMED root cause (2026-06-30, traced `local/generateLocal.ts:144–184`).** Today's local
> terrain is NOT continuous across cell boundaries:
> - **Macro relief IS world-positioned** — `base = sampleRegion(fx, fy)` bilinearly samples the L1
>   region heightfield at WORLD feet `fx = bounds.x + (cx+0.5)*CELL_FT`. Continuous *within* a
>   region; across cells it agrees only insofar as adjacent cells' regions interpolate the SAME FMG
>   coarse field at the same world point (must be verified, but it's world-indexed, so fixable).
> - **Detail noise BREAKS it** — `detail = noiseA(cx,cy)+noiseB(cx,cy)` where
>   `makeLatticeNoise(streamPath(localPath,'detail-a'), …)` is seeded PER-LOCAL and indexed by LOCAL
>   cell coords `(cx,cy)` from each Local's own origin. Two adjacent cells use different seeds and
>   different origins → their shared edge gets different detail → a seam/cliff.
> **The S5.2 fix:** replace the per-local detail with **world-position noise** — `noise(worldFx, worldFy)`
> from a SINGLE global (per-seed) lattice indexed by world feet, NOT by `(cx,cy)`/`localPath` — and
> sample the macro from one world-position-deterministic field. Then the height at any world point
> is identical regardless of which cell's Local evaluates it ⇒ seams match by construction. The seam
> test then doubles as a guard that nothing re-introduces per-cell indexing.

### S5.3 — Edge detection + cross signal (state) — *re-anchor the cell*
`World3DWrapper.handleGroundPositionChange` detects when the walked position exits the current
Locale's extent (e.g. `xM < 0 || xM > extentMetersX || …`). On exit it computes the crossing
direction, resolves the neighbour via S5.1, and dispatches a NEW reducer action
`LOCALE_CROSS_TO_CELL { cellId, enterFeet }` (NOT `TravelMeta`/`destinationCell` — those are
travel-commit-only, per the Stage-4 doc). The reducer sets
`playerCell = { cellId: neighbour, localeCoords: enterFeet }` (feet translated to the new Locale's
entry edge — the opposite edge, same tangential offset) and clears any stale `playerGroundPos`
tied to the old cell. `// GRID-RETIRE:` tag — this is the cell becoming the live mover.

### S5.4 — Stream the neighbour ground (render) — *continuous walk*
`World3DWrapper`'s build effect watches `playerCell.cellId`; on change it rebuilds the ground world
from the neighbour cell's Locale (`getWorldforgeLocalForCell`) and spawns the camera at
`localeFeetToGroundMeters(enterFeet)` (Stage-3 bridge). Because S5.2 makes the boundary heights
agree, the camera steps across with no visible seam. **Prefetch:** when the player nears an edge
(within a margin), pre-build the neighbour ground so the swap is instant (open-region decision 4).

### S5.5 — Edges & water (bound the world honestly)
Ocean cells (`cells.h < 20`) are the ship layer: walking to a shore stops at the water; open water
needs the existing maritime system ([[maritime-travel-status]]). The atlas outer edge = open ocean
to the fog horizon (natural bound, no invisible wall) — open-region decision 9.

## What stays untouched (additive guarantees)
Compass (`CompassPane` / `handleMovement` / `subMapCoordinates` stepping), the 30×20 grid,
`legacyTileToAtlasCell` / `getTownTilesForGrid` / `atlasCellToLegacyGrid` behaviour, atlas
fast-travel, and the Stage-1..4 paths. Stage 5 ADDS a continuous mover; nothing legacy is removed
until Stage 6. A player who never walks to an edge sees byte-identical behaviour.

## Testing (TDD — failing test first per slice)
- **S5.1** neighbour resolution: a cell's chosen directional neighbour is in `cells.c` and lies in
  that direction; `worldPosToCell` round-trips a cell's own site back to itself.
- **S5.2 SEAM (the risk):** height at the shared boundary of two adjacent land cells agrees from
  both frames within tolerance (no cliff) — the gating golden. Plus a rendered eyeball.
- **S5.3** reducer: `LOCALE_CROSS_TO_CELL` sets `playerCell.cellId` to the neighbour with translated
  `localeCoords` and clears stale `playerGroundPos`; a non-cross move is unchanged.
- **S5.4** the build effect re-streams on `playerCell.cellId` change and spawns at the translated
  feet (component test against the existing World3D harness).
- **Regression:** full `src/systems/worldforge/ src/state/__tests__/ MapPane.test.tsx` green;
  compass/grid tests unchanged.

## Band-Aid Ledger (umbrella)
No new shadow. Stage 5 makes the cell the **live continuous mover** (a step toward Stage 6). The
surviving compromise is the pre-existing BA-2/BA-5 (compass + `subMapCoordinates` still present as
the legacy mover until Stage 6); the new cross path is `// GRID-RETIRE:`-tagged so deletion forces
the compass out.

## DEFERRED (explicit)
- Scenery / distant vistas / horizon LOD (open-region decisions 7–8) — layered AFTER the seam is
  proven (S5.2 gate); not the foundation.
- Removing the compass / `subMapCoordinates` / the grid — Stage 6.
- Multi-cell simultaneous render (more than current + prefetched neighbour) — only if the single
  prefetch proves insufficient.
