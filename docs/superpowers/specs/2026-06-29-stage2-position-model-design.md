# Stage 2 — Canonical Position Model (`playerCell`) — Design

**Date:** 2026-06-29
**Status:** Approved (design) — implementing
**Program:** [Cell-native world umbrella](2026-06-29-cell-native-world-umbrella.md), Stage 2
**Foundation:** [Stage 1 grid↔atlas bridge](2026-06-27-grid-atlas-bridge-unification-design.md) (IMPLEMENTED)

## Goal

Introduce a canonical player presence **`playerCell: { cellId, localeCoords }`** as the
SOURCE OF TRUTH for where the player is, with the legacy `currentLocationId`
(`coord_X_Y`) + `subMapCoordinates` demoted to **DERIVED** values kept for compat.
Plus save-migration scaffolding so old saves gain a `cellId`.

Per the umbrella's **Decision (2026-06-29)**: cell-native is the source of truth;
`coord_X_Y` is derived via `atlasCellToLegacyGrid`. The grid is NOT removed (Stage 6);
it remains a derived/bookkeeping layer so the game keeps working unchanged.

This stage is deliberately *incremental*: we **record** the canonical cell wherever
position is set, and we keep every existing `coord_X_Y` reader untouched by continuing
to write the derived `coord_X_Y` / `subMapCoordinates` as the writers already do.
Flipping the *readers* onto the cell is Stage 3+ work, not this one.

## Open questions (resolved)

### (a) `localeCoords` representation

**Decision: `localeCoords` reuses the existing `subMapCoordinates` semantics** — an
integer `{ x, y }` sub-tile cell within the Locale (the legacy submap grid), the *same
value* the game already stores in `subMapCoordinates`. We do **not** introduce a new
feet/meters unit in Stage 2.

Rationale:
- The umbrella's end-state names `locale: { xFt, yFt }` (continuous feet) backed by
  `playerWorldPos` / `playerGroundPos` (meters). But continuous-feet Locale movement is
  literally Stage 3 ("Locale movement (2D + 3D synced) — the new movement system").
  Inventing an `xFt/yFt` field now, with no producer/consumer, would be speculative
  (violates the no-fallback / build-one-real-path directive) and untestable against real
  movement.
- `subMapCoordinates` is the *only* live, written Locale-local position today. Mirroring
  it keeps `playerCell` a faithful record of current truth with a real producer and a
  real round-trip to test.
- `playerGroundPos` (tile-local meters) and `playerWorldPos` (continent meters) already
  exist and already back the 3D view. They remain the meters backing the umbrella refers
  to; Stage 3 will widen `localeCoords` to continuous feet and bridge it to
  `playerGroundPos`. Stage 2 leaves those fields exactly as they are.

So in Stage 2: `playerCell.localeCoords` is `{ x: number; y: number } | null`, set to the
same value as `subMapCoordinates` at every write site. Type kept deliberately structural
so Stage 3 can widen it to feet without a second migration.

### (b) reader-migration order — flip incrementally or in one cut?

**Decision: do NOT flip any readers in Stage 2.** Cell becomes the recorded truth; the
derived `coord_X_Y` keeps feeding every existing reader unchanged. Concretely the readers
that stay on the derived value this stage:

- **movement** — `handleMovement.ts` parses `currentLocationId.split('_')` and computes the
  next `coord_X_Y`; unchanged. It is also the place we *derive* the cell (see below).
- **biome** — `worldReducer.resolveBiomeId` regex-matches `coord_X_Y` → `mapData.tiles`;
  unchanged.
- **NPC guards / discovery / save preview** — read `currentLocationId`; unchanged.

The reader flip (movement → biome → NPC → discovery → save) is sequenced in **Stage 3**,
where the new Locale movement system actually produces continuous positions worth reading
from the cell. Flipping readers now would be churn with no behavioural payoff and real
regression risk (the Stage-1 lesson).

### (c) save migration

On load, derive `cellId` from the saved `coord_X_Y` via `legacyTileToAtlasCell` (the
EXISTING, golden mapping — see HARD CONSTRAINT below), versioned and idempotent, mirroring
`worldDataMigration`. Saves predating Stage 2 have no `playerCell`; the migration backfills
it from `currentLocationId` + `subMapCoordinates`.

## Why `legacyTileToAtlasCell` for the derive (not `atlasCellToLegacyGrid`)

The umbrella names `atlasCellToLegacyGrid` for the *forward* (cell → tile) projection and
`legacyTileToAtlasCell` for the *reverse* (tile → cell). Stage 2 has BOTH directions:

- **Forward (cell → coord_X_Y), when a cell is the input** (3D-entry anchor, future
  start-selection): use `atlasCellToLegacyGrid(atlas, cellId, gridSize)` to derive the
  bookkeeping tile. (Already used this way in Stage 1 / MapPane.)
- **Reverse (coord_X_Y → cellId), when a tile is the input** (legacy compass movement,
  save migration of old saves): use `legacyTileToAtlasCell(atlas, x, y, cols, rows)` — the
  SAME function `getWorldforgeLocalForLocation` already uses, so the recorded `cellId`
  matches the cell the 3D generator would resolve for that tile. No new mapping, no flip.

**HARD CONSTRAINT honoured:** we do NOT modify `legacyTileToAtlasCell` or
`getTownTilesForGrid`, and we do NOT change `atlasCellToLegacyGrid`'s behaviour. Stage 1's
regression came from *reimplementing* `legacyTileToAtlasCell`; Stage 2 only *calls* these
existing functions. The recorded cell is a faithful, derived shadow of the tile the game
already computes — never an authority that overrides it in Stage 2.

> A subtlety: today's movement still computes `coord_X_Y` first; `playerCell.cellId` is
> derived FROM that tile via `legacyTileToAtlasCell`. So in Stage 2 the tile is still the
> de-facto driver and the cell is its shadow. The *naming* (cell = truth) is established
> and the field is populated everywhere, so Stage 3 can invert the dependency (cell drives,
> tile derived via `atlasCellToLegacyGrid`) without adding the field or the migration.
> This staged inversion is exactly what "incremental — existing readers untouched" means.

## Data model

```ts
/** Canonical player presence (cell-native world, Stage 2). The atlas Voronoi
 *  cell the player occupies + their Locale-local position. SOURCE OF TRUTH;
 *  `currentLocationId` (coord_X_Y) + `subMapCoordinates` are derived shadows. */
export interface PlayerCell {
  /** Atlas (FMG) Voronoi cell id. */
  cellId: number;
  /** Locale-local position. Stage 2 = the legacy submap sub-tile {x,y} (mirrors
   *  subMapCoordinates). Stage 3 widens this to continuous Locale feet. */
  localeCoords: { x: number; y: number } | null;
}
```

`GameState.playerCell: PlayerCell | null` (null at the main menu / before spawn, like
`subMapCoordinates`).

## Components & Changes

1. **`src/types/state.ts`** — add `PlayerCell` interface + `playerCell: PlayerCell | null`
   field on `GameState`.

2. **`src/utils/core/factories.ts`** (BOTH factory functions) + **`src/state/initialState.ts`**
   — add `playerCell: null` (project rule: update both factories + initialState).

3. **`src/state/actionTypes.ts`** + **`src/types/actions.ts`** — `StartGameSuccessPayload`
   gains optional `playerCell?: PlayerCell | null`. No new action type is needed for moves:
   the cell rides existing actions.

4. **A derive helper** — `src/systems/worldforge/local/playerCellFromLegacy.ts`:
   `deriveCellIdFromTile(worldSeed, x, y, cols, rows): number | null` — a thin, pure wrapper
   over `getBridgeAtlas` + `legacyTileToAtlasCell` (the golden reverse mapping), guarded so a
   generator hiccup returns `null` rather than throwing into a reducer/migration. (Returning
   null is honest "unknown cell", not a behavioural fallback path — the game still runs on the
   untouched grid.)

5. **`src/state/appState.ts`** — derive + store `playerCell` alongside the legacy fields in
   the two position writers, so the canonical cell is recorded at every set:
   - `MOVE_PLAYER`: compute `playerCell` from `action.payload.newLocationId` +
     `newSubMapCoordinates`. If the id is `coord_X_Y`, parse + `deriveCellIdFromTile`; if it's
     a static `LOCATIONS` id with `mapCoordinates`, derive from those. `localeCoords =
     newSubMapCoordinates`. (Recording-only — does not change the legacy assignments.)
   - `START_GAME_SUCCESS`: `playerCell = restOfPayload.playerCell ?? <derive from
     initialLocationId + initialSubMapCoordinates>`. (Start-selection already carries the
     cell in `entry3DAnchor`; we thread the same cell into `playerCell` so the source of
     truth and the 3D anchor agree from frame one.)
   - `RESTART_WITH_PROCEDURAL_PARTY` / `START_GAME_FOR_DUMMY` / `INITIALIZE_DUMMY_PLAYER_STATE`:
     set `playerCell` consistently with the legacy fields they write (derive, or null when
     the spawn is the static `STARTING_LOCATION_ID` with no map coords). These dev/skip paths
     just stay self-consistent; no behavioural change.

6. **`src/hooks/useGameInitialization.ts`** — `startGame` already resolves the spawn tile +
   (for start-selection) the `entry3DAnchor` cell. Thread the spawn cell into the payload's
   `playerCell` (use `startTown.atlasCellId` when present, else `deriveCellIdFromTile` on the
   resolved spawn tile). `localeCoords = initialSubMapCoords`.

7. **`src/services/saveLoadService.ts`** — in `loadGame`, after the existing migrations, call a
   new `migratePlayerCell(loadedState)` (in `src/state/migrations/playerCellMigration.ts`):
   idempotent — if `playerCell` already present, no-op; else derive `cellId` from
   `currentLocationId` (parse `coord_X_Y`, or a static location's `mapCoordinates`) via
   `deriveCellIdFromTile`, `localeCoords = subMapCoordinates`. On any failure leave
   `playerCell` null (old save still loads + plays on the grid; honest unknown, not a fake
   position). Mirrors the `migrateMapDataToWorldDataV2` call-site + idempotence pattern.

## Testing (TDD — failing test first for each)

- **state types/factories parity** — `createMockGameState().playerCell` is `null`;
  `initialState.playerCell` is `null` (the existing `factories.parity.test.ts` already
  enforces key parity; add explicit assertions).
- **`deriveCellIdFromTile`** — for a sample seed, a known land tile derives the SAME cell id
  that `getWorldforgeLocalForLocation` resolves for that tile (golden agreement with the
  untouched mapping); a bad/empty world returns `null` without throwing.
- **`MOVE_PLAYER` records the cell** — dispatching `MOVE_PLAYER` with a `coord_X_Y`
  newLocationId + subMapCoordinates produces `playerCell.cellId === deriveCellIdFromTile(...)`
  and `playerCell.localeCoords === newSubMapCoordinates`, AND leaves `currentLocationId` /
  `subMapCoordinates` byte-identical to today (compat regression guard).
- **`START_GAME_SUCCESS` threads the payload cell** — when payload carries `playerCell`, it is
  stored as-is and agrees with `entry3DAnchor.cellId`; without it, the cell is derived from
  `initialLocationId`.
- **save migration** — a pre-Stage-2 save (no `playerCell`) loads with `playerCell` backfilled
  from `currentLocationId` + `subMapCoordinates`; a save that already has `playerCell` is
  untouched (idempotent); a save whose location can't resolve loads with `playerCell: null`
  and still plays.
- **golden / regression** — full `src/systems/worldforge/` + `src/state/__tests__/` +
  `MapPane.test.tsx` suites stay green; `getTownTilesForGrid` + the Stage-1 cell-addressed
  entry tests unchanged (we touch neither mapping).

## Out of scope (Stage 3+)

- Flipping readers (movement/biome/NPC/discovery) to consume `playerCell`.
- Continuous-feet `localeCoords` and the `playerGroundPos` bridge.
- Making the cell *drive* the tile (inverting the derive direction).
- Deleting `coord_X_Y` / `subMapCoordinates` / the grid (Stage 6).
```
