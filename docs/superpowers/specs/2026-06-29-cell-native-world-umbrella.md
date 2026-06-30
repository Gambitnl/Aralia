# Cell-Native World — Umbrella Design (retire the 30×20 grid)

**Date:** 2026-06-29
**Status:** Approved (umbrella / decomposition)
**Topic:** Replace the legacy 30×20 world grid + compass movement with a Voronoi-cell-native
world: atlas travel between cells, movement on a per-cell **Locale** (synced 2D + 3D),
seamless edge-crossing. Each stage below gets its own spec → plan → implementation.

## Why

Investigation (2026-06-29) proved the start-selection spawn never lands the player in the
chosen town: **chosenBurgRenders = 0 / 219 ports across 2 seeds** (faithful `makeGroundWorld`
sweep; control passes). Root cause: spawn/3D-entry route the chosen Voronoi cell through a
coarse 30×20 grid (`spawnFromAtlasCell` → proportional projection → `legacyTileToAtlasCell`
nearest-land), which essentially never recovers the chosen cell. Towns exist per Voronoi
cell; the grid is a lossy intermediary that can't deliver the player to them.

Rather than patch the grid, retire it. Movement is rebuilt (not migrated) onto the zoomed-in
Locale; the world level becomes pure cell-to-cell travel.

## End-State Architecture

- **Presence model.** Canonical player position = `{ cellId, locale: { xFt, yFt } }` — a
  Voronoi cell + continuous Locale-local feet. Replaces `currentLocationId = "coord_X_Y"`
  AND `subMapCoordinates`. `playerWorldPos` / `playerGroundPos` (meters) back it.
- **World navigation = atlas travel.** The Voronoi atlas is the world map; inter-cell
  movement is the existing `atlasTravelGraph` fast-travel (routes + encounters). No compass,
  no grid stepping.
- **Locale = one state, two synced views.** Each cell's local artifact (region → local) is
  rendered as a 2D Locale map AND a 3D ground from the same movement state; moving in one
  updates the other (canonical-town principle extended to position).
- **Seamless edges.** Walking to a Locale boundary streams the adjacent cell's Locale
  (recursive submap engine, clipped to the parent cell). Long hops use atlas fast-travel.
- **Static `LOCATIONS`** (the 14 hand-authored places) become **cell-anchored Locale
  overrides** rather than grid coordinates.
- **Deleted:** the 30×20 grid, `mapData.tiles`, `coord_X_Y`, `subMapCoordinates`, compass
  movement.

## Cross-Cutting Constraints

- **Save migration.** Old saves carry `coord_X_Y` + `subMapCoordinates`; on load, translate
  `coord_X_Y → cellId` via `legacyTileToAtlasCell` (one-time, versioned in
  `saveLoadService` + a `worldDataMigration`-style backfill).
- **Always-playable invariant.** Every stage ships with the game working. The grid is
  demoted to derived bookkeeping before deletion (final stage).

## Decomposition & Build Order

Each is its own spec → plan → implementation cycle.

1. **Cell-addressed Locale entry** *(foundation)* — adopt the approved
   [2026-06-27 grid↔atlas bridge spec](2026-06-27-grid-atlas-bridge-unification-design.md)
   (`snapToLandCell`, `getWorldforgeLocalForCell`, `entry3DAnchorCell`, World3DWrapper
   branch, MapPane click cleanup) **plus** its missing piece: the **start-selection spawn**
   path must also set `entry3DAnchorCell` from the spawn's already-returned `atlasCellId`
   (currently dead cargo). Fixes the 0/219 bug. Grid still present for movement/2D.
2. **Position model** — introduce `{ cellId, localeCoords }` alongside legacy `coord_X_Y`
   (grid derived for compat) + save-migration scaffolding.
   - **Decision (2026-06-29): cell-native is the SOURCE OF TRUTH**; `coord_X_Y` is
     derived (`atlasCellToLegacyGrid`) for compat + save. This flips a core
     mapping, so it needs its own design doc + save migration up front and must
     heed the Stage-1 lesson (the `legacyTileToAtlasCell` flip rippled into
     `getTownTilesForGrid` + pipeline — verify every derived reader against a
     golden before flipping). Open design questions for the Stage 2 spec:
     (a) `localeCoords` representation (feet within the Locale? reuse
     `playerGroundPos`?); (b) reader-migration order (movement, biome, NPC
     guards, discovery, save) — flip readers to the cell incrementally or in one
     cut; (c) save migration (`coord_X_Y → cellId` via `legacyTileToAtlasCell`,
     versioned). **Status: design pending** — warrants its own focused pass.
3. **Locale movement (2D + 3D synced)** — the new movement system; scrap compass/submap.
4. **Atlas fast-travel as the world loop** — wire existing atlas travel as THE inter-cell mover.
5. **Seamless edge-crossing** — stitch/stream adjacent Locales (hardest piece).
6. **Retire the grid** — delete `coord_X_Y` / `subMapCoordinates` / `mapData.tiles` /
   compass; migrate `LOCATIONS` to cell-anchored Locales; finalize save migration.

## Band-Aid Ledger — temporary patches that MUST be removed at Stage 6

Every interim/"derived shadow" compromise is logged here and tagged in code with
`// GRID-RETIRE:` so a single repo-wide search finds them all. **Stage 6 (retire
the grid) is the forcing function:** deleting `coord_X_Y` / `subMapCoordinates` /
`mapData.tiles` makes every band-aid below fail to compile or fail its test until
it is removed — so the cleanup is enforced by the compiler + test suite, not by
memory. Stage 6 is not "done" until this ledger is empty and the `GRID-RETIRE`
search returns nothing.

| # | Band-aid (added) | Where | Removed when |
|---|---|---|---|
| BA-1 | `playerCell` recorded as a derived *shadow* of the legacy tile (legacy still drives) | appState `derivePlayerCell` (MOVE_PLAYER / START_GAME_SUCCESS / dummy) | grid removed → cell is the only position |
| BA-2 | `coord_X_Y` kept as the position interface every legacy reader still reads | movement, `resolveBiomeId`, NPC guards, discovery, save | grid removed → readers move to `playerCell` |
| BA-3 | **WIDENED (Stage 3, implemented).** `localeCoords` is now continuous Locale FEET, a derived shadow of `playerGroundPos` (the live movement state both the 3D ground and the 2D Locale view share). The `SET_PLAYER_GROUND_POS` reducer case mirrors the position into `playerCell.localeCoords` via the `localePosition` bridge; the integer "submap sub-tile" interpretation is retired for the ground path (BA-5 covers the surviving legacy integer producer). | `localePosition.ts` (bridge) + `worldReducer` `SET_PLAYER_GROUND_POS` mirror + `LocaleMovePane` (2D producer) — tagged `// GRID-RETIRE: BA-3` | feet is the *only* `localeCoords` semantic once the integer path (BA-5) is deleted at Stage 6 |
| BA-4 | save migration derives `cellId` from saved `coord_X_Y` (one-way back-fill) | `playerCellMigration` | grid removed → saves store cell directly |
| BA-5 | **NEW (Stage 3).** `playerCell.localeCoords` has TWO producers until Stage 6: the legacy tile path (`appState` `derivePlayerCell`, integer sub-tile units) and the ground path (`worldReducer` `SET_PLAYER_GROUND_POS`, continuous feet). The ground path is authoritative whenever a Locale/ground session is active (the only time continuous feet are meaningful); readers must treat `localeCoords` as feet ONLY alongside an active ground session. | `appState` `derivePlayerCell` (integer) + `worldReducer` feet mirror — tagged `// GRID-RETIRE: BA-3` at both sites | grid removed → `subMapCoordinates` / the integer path is deleted, leaving feet the sole producer |

Maintenance rule: any new interim compromise adds a row here AND a `// GRID-RETIRE:`
tag at the code site, in the same change.

## Current status (2026-06-29) & Stage 4 handoff

**Done + verified (tests green, no regressions):**
- **Stage 1** — cell-addressed 3D entry; start-selection spawn now lands the player IN the
  chosen town (the 0/219 bug). Verified LIVE. Spec: 2026-06-27-grid-atlas-bridge-unification.
- **Stage 2** — `playerCell { cellId, localeCoords }` field; recorded as a derived SHADOW of
  the legacy tile (legacy still drives) + save migration. Spec: 2026-06-29-stage2-position-model.
- **Stage 3** — Locale movement: 2D `LocaleMovePane` + 3D ground share ONE position via the
  `SET_PLAYER_GROUND_POS` reducer (additive; compass/`subMapCoordinates` untouched). `localeCoords`
  widened to continuous feet. Spec: 2026-06-29-stage3-locale-movement.

**Owed live eyeballs (test-verified, not yet seen in-game):** Stage 3's 2D/3D movement sync
(the quick preview rig can't mount `World3DWrapper`; needs a full gated ground session — use the
raw-vite-on-a-spare-port workaround the Stage-1 live proof used).

**Stage 4 = "Atlas fast-travel as the world loop."** Open risks flagged by Stage 3 (heed these):
- **Reset `localeCoords` on inter-cell travel** — fast-travel changes `playerCell.cellId`; the old
  Locale's feet are meaningless in the new cell. Clear/re-anchor on cell change (mirror how
  `MOVE_PLAYER` nulls `entry3DAnchor`).
- **Don't leak Locale feet into atlas/world coords** — keep feet strictly Locale-local (the
  Stage-1 lossy-projection trap in a new guise).
- **Two-producer window (BA-5)** — until Stage 6 a reader may see integer sub-tiles (legacy path)
  or feet (ground path); treat `localeCoords` as feet ONLY when a ground/Locale session is active.

**Standing constraints for every stage agent:** design-doc first; TDD (failing test first);
ADDITIVE / always-playable (don't remove compass/`subMapCoordinates`/grid before Stage 6); do NOT
change `legacyTileToAtlasCell` / `getTownTilesForGrid` / `atlasCellToLegacyGrid` behavior (Stage 1
proved flipping them breaks town-tiles + pipeline); never rely on a cell→tile→cell round-trip being
lossless; no fallback layers; new GameState fields update BOTH factories + initialState; any interim
compromise adds a Band-Aid Ledger row + a `// GRID-RETIRE:` code tag. Verify with
`npx tsc -b` and `npx vitest run --no-file-parallelism src/systems/worldforge/ src/state/__tests__/
src/components/__tests__/MapPane.test.tsx`. IGNORE only these pre-existing failures: `townEngine`
"dock pier reaches seaward"; anything under a "clever-snyder" path (another chat's worktree); the
`_stubService` implicit-any and `worldHistory`-literal tsc errors.

## Out of Scope

- The continent-scale legacy streamer.
- The 3D rendering technology itself.
- Grid-resolution tweaks (the cell anchor is resolution-independent by construction).
