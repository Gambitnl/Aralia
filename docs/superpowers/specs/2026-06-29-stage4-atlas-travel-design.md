# Stage 4 — Atlas Fast-Travel as the World Loop — Design

**Date:** 2026-06-29
**Status:** Approved (design) — implementing the SAFE ADDITIVE SLICE
**Program:** [Cell-native world umbrella](2026-06-29-cell-native-world-umbrella.md), Stage 4
**Foundations:**
[Stage 1 grid↔atlas bridge](2026-06-27-grid-atlas-bridge-unification-design.md) (IMPLEMENTED),
[Stage 2 position model](2026-06-29-stage2-position-model-design.md) (IMPLEMENTED),
[Stage 3 Locale movement](2026-06-29-stage3-locale-movement-design.md) (IMPLEMENTED)

## Goal

Make the **existing atlas fast-travel system the way the player moves between cells on
the world map**, cell-natively: pick a destination cell → travel (routes + encounters
already exist) → ARRIVE IN THAT EXACT CELL, with arrival set up to enter the destination
town/cell in 3D. The route planner, encounter roll, provisioning gate, ship/ferry
branches, and the `MapPane` Travel mode all already exist and stay exactly as they are —
Stage 4 only closes the **arrival** end so the destination the player picked is the cell
they end up in (and the cell a subsequent Enter-3D frames).

This is **ADDITIVE**: the legacy compass + grid stepping STAY (Stage 6 removes them). The
game stays fully playable; a non-cell-native move (compass step, static-`LOCATIONS` move)
behaves byte-identically to today.

## The gap Stage 4 closes (the Stage-1 trap, in the travel path)

Travel mode commits a trip through `MapPane.handleWorldforgePick` →
`onTileClick(tx, ty, tile, travelMeta)` → `App.handleTileClick` →
`dispatch(MOVE_PLAYER { newLocationId: coord_X_Y, ... })`. But:

- The destination is the clicked **cell `info.i`**. MapPane projects it to a **coarse grid
  tile** (`tx = floor(p.x/graphWidth * cols)`, `ty = floor(...)`) — the same lossy
  proportional projection Stage 1 proved essentially never recovers the chosen Voronoi
  cell when several share a coarse tile.
- `MOVE_PLAYER` then derives `playerCell.cellId` from that lossy `coord_X_Y` via
  `legacyTileToAtlasCell` (Stage 2's `derivePlayerCell`). So after fast-travelling to a
  destination cell, `playerCell.cellId` is whatever cell the *reverse* mapping names for
  the quantized tile — **which need not be the destination cell the player clicked.**
- `localeCoords` is NOT reset: `derivePlayerCell` sets it from `newSubMapCoordinates` (the
  legacy center sub-tile), but the Stage-3 ground producer (BA-5) can leave **stale feet
  from the previous Locale** on `playerCell.localeCoords`. Those feet are meaningless in
  the new cell.
- Nothing sets `entry3DAnchor` for the destination, so a later Enter-3D re-derives an
  anchor from the (lossy) tile rather than framing the destination town.

So: today's "fast-travel" lands the player at a *grid tile near* the destination, not the
destination cell — the world-map loop is grid-bound, exactly what the umbrella retires.

## Approach — carry the destination cell intact through the travel commit (additive)

The travel path already passes a `TravelMeta` from MapPane → App on a committed trip (it
carries trip seconds, the encounter message, the provisioning effect). **Add an optional
cell-native arrival payload to `TravelMeta`** and thread it to `MOVE_PLAYER`:

```
click cell C (Travel mode)
  ├─ route/encounter/provisioning  ── UNCHANGED (existing system)
  ├─ tx,ty = lossy projection of C  ── UNCHANGED (legacy bookkeeping tile, coord_X_Y)
  └─ NEW: travelMeta.destinationCell = {
         cellId:  snapToLandCell(atlas, C),     // the exact destination cell
         anchor:  entry3DAnchorForCell(atlas, C) // burg-centered when settled
       }
        → onTileClick(tx,ty,tile, travelMeta)
        → App.handleTileClick → MOVE_PLAYER { ..., destinationCell }
        → reducer (additive): when destinationCell present,
             playerCell    = { cellId: destinationCell.cellId, localeCoords: null }  // RESET feet
             entry3DAnchor = destinationCell.anchor                                  // frame the town
          else (compass / static move): UNCHANGED Stage-2 derive + entry3DAnchor: null
```

Why this shape:

- **Cell-native arrival, no new mapping.** The destination `cellId` and `anchor` are
  computed in MapPane from the **already-clicked cell `info.i`** using the EXISTING,
  protected Stage-1 helpers (`snapToLandCell`, `entry3DAnchorForCell`) — the same ones the
  Enter-3D path already uses. We do NOT touch `legacyTileToAtlasCell` /
  `getTownTilesForGrid` / `atlasCellToLegacyGrid`, and we never rely on a
  cell→tile→cell round-trip recovering the cell (we carry it explicitly, the Stage-1
  lesson). The bookkeeping `tx,ty`/`coord_X_Y` stay lossy-but-harmless legacy cargo.
- **`localeCoords` RESET on inter-cell travel (Stage-4 critical req).** A fast-travel
  changes the Locale; the old cell's feet are meaningless. The reducer sets
  `localeCoords: null` (honest "unknown until a ground session reports one in the new
  cell"), mirroring how `MOVE_PLAYER` already nulls `entry3DAnchor`. This is the BA-5
  two-producer window handled correctly: on cell change we drop the stale feet rather than
  carry them; the next ground session re-anchors via `SET_PLAYER_GROUND_POS`.
- **Arrival sets up entry into the destination town/cell.** `entry3DAnchor` =
  `entry3DAnchorForCell(atlas, C)` (burg-centered for a settlement). A subsequent Enter-3D
  reads `entry3DAnchor` first (Stage-1 `World3DWrapper` branch) → `getWorldforgeLocalForCell`
  EXACT → the player enters the destination town, not a coarse-grid neighbour. No new 3D
  wiring; we reuse Stage-1's path by populating the field it already consumes.
- **No Locale-feet leak into atlas/world coords (Stage-4 critical req).** `destinationCell`
  carries ONLY a cell id + an atlas-pixel anchor (graph space). No Locale feet cross the
  boundary; feet stay strictly Locale-local (Stage 3's bridge). Travel reasons in cell ids
  / world space exactly as before.

### Why extend `TravelMeta` + `MOVE_PLAYER` rather than a new action / new mover

The trip is ALREADY committed atomically through `onTileClick` → `MOVE_PLAYER` (+
`ADVANCE_TIME` + provisioning) in `handleTileClick`. The move, its clock cost, and its
provisioning are one unit there. Threading the destination cell on the same `TravelMeta`
keeps arrival atomic with the move (no window where the tile moved but the cell didn't) and
reuses the one existing commit path — no speculative second action, no parallel mover
(no-fallback / build-one-real-path). The ship/ferry voyage branch (`onSetSail`) is a
separate relocation flow with its own arrival (`naval` arrival relocation) and is OUT OF
SCOPE here; Stage 4 covers the land/ferry `onTileClick` trip, which is THE world loop.

## Components & Changes

1. **`src/types/travelMeta.ts`** — add an optional cell-native arrival field to
   `TravelMeta`:
   ```ts
   /** Cell-native destination of the trip (Stage 4). When present, arrival sets the
    *  canonical playerCell to this exact cell (resetting Locale feet) and stamps the
    *  3D-entry anchor so Enter-3D frames the destination. Absent for legacy
    *  compass/static moves (those keep the Stage-2 tile-derived cell). */
   destinationCell?: { cellId: number; anchor: Entry3DAnchor };
   ```
   (`Entry3DAnchor` imported from `types/state`.)

2. **`src/state/actionTypes.ts`** — `MOVE_PLAYER` payload gains an optional
   `destinationCell?: { cellId: number; anchor: Entry3DAnchor }`. Optional ⇒ every existing
   dispatcher (compass `handleMovement`, etc.) is unaffected.

3. **`src/state/appState.ts`** — `MOVE_PLAYER` case: when
   `action.payload.destinationCell` is present, set
   `playerCell = { cellId: destinationCell.cellId, localeCoords: null }` (RESET feet) and
   `entry3DAnchor = destinationCell.anchor`. When ABSENT, keep today's exact behaviour
   (Stage-2 `derivePlayerCell` + `entry3DAnchor: null`). Tag the new branch
   `// GRID-RETIRE: BA-2` (the legacy tile/`coord_X_Y` still rides along as bookkeeping
   until Stage 6). No band-aid *ledger* row is needed — this is the cell becoming
   authoritative for the travel arrival (a step TOWARD Stage 6), not a new shadow; the
   surviving compromise is only that the lossy `coord_X_Y` is still written alongside, which
   is the pre-existing BA-2.

4. **`src/components/MapPane.tsx`** — `handleWorldforgePick`, the ordinary land/ferry travel
   branch (both the in-range commit and the post-provision-choice commit): compute
   `destinationCell = { cellId: snapToLandCell(atlas, info.i), anchor: entry3DAnchorForCell(atlas, info.i) }`
   once and include it in the `travelMeta` passed to `onTileClick`. The `pendingTravel`
   state already carries `cellId: info.i`, so `resolvePendingTravel` can recompute the same
   `destinationCell` from it. The lossy `tx,ty` projection is UNCHANGED (still the
   bookkeeping tile + `coord_X_Y`). Imports `snapToLandCell` + `entry3DAnchorForCell` from
   `gridAtlasBridge` (already partly imported for Enter-3D).

5. **`src/App.tsx`** — `handleTileClick`: pass `travelMeta?.destinationCell` through to BOTH
   `MOVE_PLAYER` dispatches (the `tile.locationId` branch and the `coord_X_Y` branch). No
   other change; the move/clock/provisioning sequence is untouched.

## What stays untouched (additive guarantees)

- Compass movement (`handleMovement` → `MOVE_PLAYER` with no `destinationCell`) →
  Stage-2 derive, byte-identical to today.
- Static-`LOCATIONS` quick-travel (the `tile.locationId` branch) without a
  `destinationCell` → unchanged (MapPane only sets `destinationCell` on a Travel-mode atlas
  pick, which lands on `coord_X_Y`, not a static location). [If a future caller wants
  cell-native static moves it just sets the field; nothing forces it.]
- `legacyTileToAtlasCell` / `getTownTilesForGrid` / `atlasCellToLegacyGrid` — NOT modified.
- The route planner, encounter roll, provisioning rings/gate, ship/ferry voyage branch —
  NOT modified.
- `subMapCoordinates` / `coord_X_Y` / the 30×20 grid — still written as legacy bookkeeping.

## Testing (TDD — failing test first for each)

- **`MOVE_PLAYER` with `destinationCell` lands the EXACT cell + RESETS feet** — dispatching
  `MOVE_PLAYER` with `destinationCell: { cellId: 562, anchor: { cellId: 562, centerPx: [..] } }`
  produces `playerCell === { cellId: 562, localeCoords: null }` (feet reset, NOT the
  lossy-tile derive) AND `entry3DAnchor === anchor`, AND leaves `currentLocationId` /
  `subMapCoordinates` byte-identical to a no-`destinationCell` move (legacy bookkeeping
  intact). Critically: the recorded `cellId` is `562` even when
  `deriveCellIdFromTile(seed, tile)` for the bookkeeping tile is a DIFFERENT cell — proving
  the destination is carried intact, not reverse-derived.
- **`MOVE_PLAYER` without `destinationCell` is unchanged** — same dispatch sans the field
  still records the Stage-2 tile-derived cell + `localeCoords = subMapCoordinates` +
  `entry3DAnchor: null` (compat regression guard; the existing Stage-2 test already covers
  this — extend with an explicit `entry3DAnchor: null` assertion).
- **`localeCoords` reset clears STALE feet** — start from a state whose `playerCell` has
  non-null feet (a prior Locale session), dispatch `MOVE_PLAYER` with a `destinationCell`,
  assert `playerCell.localeCoords === null` (the Stage-4 critical requirement).
- **MapPane travel pick carries the destination cell** — a Travel-mode cell pick invokes
  `onTileClick` with `travelMeta.destinationCell.cellId === snapToLandCell(atlas, picked)`
  and `.anchor === entry3DAnchorForCell(atlas, picked)`. (Component test; reuse the existing
  MapPane test harness + a real atlas the suite already builds.)
- **golden / regression** — full `src/systems/worldforge/`, `src/state/__tests__/`,
  `MapPane.test.tsx` stay green; Stage-1/2/3 entry/position/movement tests unchanged;
  `getTownTilesForGrid` + the protected mappings untouched.

## Band-Aid Ledger updates (umbrella)

No NEW band-aid row. Stage 4 makes the cell **authoritative for the travel arrival** (a
step toward Stage 6), reusing Stage 1's anchor helpers and Stage 2's `playerCell` field;
the only surviving compromise is the pre-existing **BA-2** (the lossy `coord_X_Y` /
`subMapCoordinates` still written as the legacy-reader interface). The new reducer branch is
tagged `// GRID-RETIRE: BA-2` so Stage 6's grid deletion forces the legacy bookkeeping out.
The BA-5 two-producer window is *narrowed* by Stage 4 (the ground feet are now actively
reset on inter-cell travel rather than left stale), but BA-5 still stands until Stage 6.

## DEFERRED (explicit)

- **Ship/ferry voyage arrival** cell-native relocation (the `onSetSail` / `naval` arrival
  path) — separate relocation flow; Stage 4 covers the land/ferry `onTileClick` world loop.
- **Live in-3D arrival animation / auto Enter-3D on arrival** — arrival sets `entry3DAnchor`
  + closes the map (existing `TOGGLE_MAP_VISIBILITY`); the player still chooses when to
  Enter-3D. Auto-entry is a UX polish, not this slice.
- **Removing the compass / grid stepping / `subMapCoordinates` / `coord_X_Y`** — Stage 6.
- **Seamless edge-crossing / streaming adjacent Locales** — Stage 5.

## Open risks for Stage 5 (seamless edge-crossing)

- **Walking off a Locale edge must re-anchor `playerCell.cellId`** like fast-travel does
  here (new cell, reset/translate feet to the new Locale's frame) — Stage 5 is the
  *continuous* analogue of this stage's *discrete* cell change; it should reuse the same
  "cell change ⇒ reset Locale feet, re-anchor entry" invariant rather than inventing a
  second one.
- **Edge crossing has no `TravelMeta`** (no trip commit) — Stage 5 will need its own
  reducer signal to change `playerCell.cellId` mid-ground-session; the `destinationCell`
  field here is travel-commit-only and should NOT be overloaded for streaming.
