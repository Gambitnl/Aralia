# Stage 3 — Locale Movement (2D + 3D synced) — Design

**Date:** 2026-06-29
**Status:** Approved (design) — implementing the SAFE ADDITIVE FOUNDATION
**Program:** [Cell-native world umbrella](2026-06-29-cell-native-world-umbrella.md), Stage 3
**Foundations:**
[Stage 1 grid↔atlas bridge](2026-06-27-grid-atlas-bridge-unification-design.md) (IMPLEMENTED),
[Stage 2 position model](2026-06-29-stage2-position-model-design.md) (IMPLEMENTED)

## Goal

The player moves around inside a town's zoomed-in **Locale**, and the 2D Locale view
and the 3D ground view are **TWO SYNCED VIEWS of ONE movement state** — move in either,
the other reflects it. This begins replacing the legacy compass / `subMapCoordinates`
stepping, **without removing it** (that is Stage 6).

Per the umbrella, this stage's foundation is THREE things, all ADDITIVE:

1. Widen `PlayerCell.localeCoords` to **continuous Locale FEET**, backed by the existing
   `playerGroundPos` meters (resolves band-aid **BA-3**).
2. A single shared **Locale position** that BOTH the 3D ground (already moves the player)
   and a 2D Locale view read/write, so they stay in sync — ONE state, two views.
3. A 2D Locale view with **click-to-move** that updates that same shared position.

## Scoping — additive, not a rip-out (hard)

- The compass (`CompassPane`) and `subMapCoordinates` / `MOVE_PLAYER` stepping stay fully
  functional. The legacy submap grid (`SUBMAP_DIMENSIONS = 30×20`) is untouched.
- `coord_X_Y` stays the legacy driver; the cell is NOT flipped to the source of truth
  (Stage 6 does that by elimination).
- We do NOT touch `legacyTileToAtlasCell`, `getTownTilesForGrid`, or `atlasCellToLegacyGrid`
  behaviour (Stage 1 lesson). The new Locale position is derived from the *already-written*
  `playerGroundPos`, never from re-mapping cells↔tiles.
- NO fallback layers: one real path, fail honestly. Where a value is genuinely unknown
  (no ground session yet) we store `null`, which is honest "unknown", not a fake position.

## The existing movement state we are unifying around

Today the 3D ground already has a real, continuous, live movement state:

- `World3DWrapper.handleGroundPositionChange(x, z)` fires as the camera walks and dispatches
  `SET_PLAYER_GROUND_POS` with `{ tileX, tileY, xM, zM }` — **meters within the ground
  world** (the Locale). Throttled to ~10 Hz.
- `worldReducer` stores it verbatim in `GameState.playerGroundPos: PlayerGroundPosition | null`.
- The ground world (`GroundWorld`) has `cols`, `rows`, `extentMetersX`, `extentMetersZ`,
  where `extentMetersX = cols × GROUND_METERS_PER_CELL` and `GROUND_METERS_PER_CELL = 1.524`
  (one ground cell = 5 ft = 0.3048 × 5 m). So the Locale's physical size in feet is
  `cols × 5` by `rows × 5`.
- Canonical unit shim already exists: `src/systems/worldforge/units.ts` — `feetFromMeters`
  (× 1/0.3048) and `metersFromFeet` (× 0.3048), exact international foot.

So `playerGroundPos` IS the live Locale position. It is already the single state the 3D view
writes. Stage 3's job is to (a) express it in Locale feet on `playerCell.localeCoords`, and
(b) give the 2D Locale view a way to read AND write that same state.

## (a) Shared Locale-position representation + the playerGroundPos↔localeCoords bridge

### Representation

`PlayerCell.localeCoords` is widened from "submap sub-tile `{x,y}`" to **continuous Locale
feet `{ x, y }`**, where:

- `x` = feet east from the Locale's west edge (= `feetFromMeters(playerGroundPos.xM)`),
- `y` = feet south from the Locale's north edge (= `feetFromMeters(playerGroundPos.zM)`).

The structural type `{ x: number; y: number } | null` is **unchanged** — Stage 2 deliberately
kept it loose precisely so this widening needs **no second save migration**. Only the
*semantics* (and the producer) change: integers-as-sub-tiles → continuous feet.

> Why feet, not meters or sub-tiles: Worldforge is feet-canon (SPEC §4, decision #12); the
> umbrella's end-state names `locale: { xFt, yFt }`. Feet is the one unit the 2D Locale
> renderer, the submap engine, and the atlas artifacts already share. Meters live only at
> the World3D boundary; we convert once, here, via the canonical `units.ts` shim.

### The bridge module

New pure module `src/systems/worldforge/local/localePosition.ts`:

```ts
/** One ground/Locale cell is 5 ft (mirrors GROUND_METERS_PER_CELL = 1.524 m). */
export const LOCALE_CELL_FT = 5;

/** playerGroundPos (tile-local meters) → Locale-local feet {x,y}. Pure, exact. */
export function groundPosToLocaleFeet(pos: { xM: number; zM: number }): { x: number; y: number };

/** Locale-local feet {x,y} → ground meters {xM,zM} for a 3D spawn / camera move. Pure, exact. */
export function localeFeetToGroundMeters(feet: { x: number; y: number }): { xM: number; zM: number };

/** Clamp a Locale-feet position to a ground world's extent (cols/rows × 5 ft). */
export function clampLocaleFeet(
  feet: { x: number; y: number },
  extent: { cols: number; rows: number },
): { x: number; y: number };
```

`groundPosToLocaleFeet` = `{ x: feetFromMeters(xM), y: feetFromMeters(zM) }`.
`localeFeetToGroundMeters` = `{ xM: metersFromFeet(x), zM: metersFromFeet(y) }`.
Round-trip is exact to floating-point tolerance (the test asserts this).

This module is the **single bridge** between the meters domain (3D) and the feet domain
(2D Locale + `localeCoords`). It introduces no new mapping of cells↔tiles and never calls
the protected Stage-1 functions.

### Where the cell rides along

`localeCoords` is *Locale-local* (relative to the current ground world / Locale), not world
space — exactly as `subMapCoordinates` was tile-local. The owning cell is `playerCell.cellId`,
which Stage 2 already records. So `{ cellId, localeCoords }` together name "which Locale +
where in it" — the umbrella's `{ cellId, locale: { xFt, yFt } }` presence model, now with the
real continuous feet field populated.

## (b) How 2D Locale view and 3D ground stay in sync — ONE state, two views

The single shared state is **`GameState.playerGroundPos`** (the live truth), mirrored into
**`playerCell.localeCoords`** as feet (the canonical-presence shadow). Both views bind to it:

```
                 ┌─────────────────────────────────────────────┐
                 │  GameState.playerGroundPos {tileX,tileY,xM,zM}│  ← single shared state
                 │  GameState.playerCell.localeCoords {x,y} feet │     (feet mirror)
                 └───────────────▲───────────────────▲──────────┘
       SET_PLAYER_GROUND_POS     │                   │   SET_PLAYER_GROUND_POS
       (3D camera walk, ~10Hz)   │                   │   (2D click-to-move)
                 ┌───────────────┴───┐         ┌─────┴───────────────┐
                 │  3D ground view   │         │  2D Locale view     │
                 │  (World3DWrapper) │         │  (LocaleMovePane)   │
                 │  writes via       │         │  reads marker from  │
                 │  handleGround…    │         │  playerGroundPos;   │
                 │  reads spawn from │         │  click → feet →     │
                 │  playerGroundPos  │         │  meters → dispatch  │
                 └───────────────────┘         └─────────────────────┘
```

- **3D → state:** unchanged path. `handleGroundPositionChange` already dispatches
  `SET_PLAYER_GROUND_POS`. Stage 3 extends the **reducer** so that this same action ALSO
  updates `playerCell.localeCoords` (feet) — so a 3D walk keeps the canonical feet in sync
  automatically. No new producer, no new action type.
- **2D → state:** the new 2D Locale view dispatches the **same** `SET_PLAYER_GROUND_POS`
  action (converting the clicked feet → meters via the bridge, stamping the current
  `tileX/tileY` from the active `playerGroundPos`). Because both views write the one action,
  the reducer is the single sync point.
- **state → 3D:** the 3D ground spawn already reads `playerGroundPos` when its `tileX/tileY`
  match the entry tile (`World3DWrapper` line ~388, the "saved ground position" branch). So a
  position set by a 2D click, then Enter-3D, spawns the camera there — no new wiring. (Live
  in-session 3D camera teleport from a 2D click while *already* in 3D is OUT OF SCOPE for the
  foundation; the views sync through state on entry/exit, which is the umbrella's "two views
  of one state" at the state layer. A live camera-follow subscription is a Stage 3 polish /
  Stage 5 concern noted under Open Risks.)
- **state → 2D:** the 2D view renders the player marker from `playerGroundPos` (converted to
  feet), so a 3D walk moves the 2D marker.

### Why extend `SET_PLAYER_GROUND_POS` rather than add a new action

`playerGroundPos` is already THE Locale movement signal, written by the only live producer.
Mirroring it into `localeCoords` inside the same reducer case keeps the two fields atomically
consistent (no window where ground meters and locale feet disagree) and avoids a speculative
second action with no second producer (no-fallback / build-one-real-path). The feet mirror is
a **derived shadow** of `playerGroundPos` — a band-aid logged below, removed at Stage 6 when
the cell becomes the sole truth.

## (c) The 2D Locale view + its move input

**Reuse, don't reinvent.** The existing 2D drill views (`SubmapSvgView`,
`NeighbourhoodSvgView`, `TownPlanView`) are **click-to-DRILL** (descend tiers), keyed on
Voronoi sub-cell *indices*, with a gold "player sub-cell" highlight. They are not a
click-to-move surface and re-purposing their click handler would break drilling.

Stage 3 adds a **separate, minimal `LocaleMovePane`** — a small SVG view of the *current
Locale's extent in feet* with:

- a footprint rectangle sized `cols×5 ft × rows×5 ft` (read from the active ground world via a
  lightweight `localeExtent` prop: `{ cols, rows }`),
- a **player marker** at `groundPosToLocaleFeet(playerGroundPos)` (the gold dot),
- **click-to-move**: a click maps screen px → Locale feet (inverse of the fit transform),
  clamps to extent, and dispatches `SET_PLAYER_GROUND_POS` with the converted meters + the
  current `tileX/tileY`. This is the move input.

`LocaleMovePane` is a pure presentational component (props: `localeExtent`,
`groundPos`, `onMoveTo(feetX, feetY)`); the container wires `onMoveTo` to the dispatch. It is
mounted as an OPTIONAL panel inside the 3D HUD's existing "Cell Map" affordance path
(`World3DWrapper` already has `onOpenCellMap`); we add a compact Locale move panel there so
the player can click-to-reposition while the 3D scene is active and watch both stay in sync on
re-entry. **It does not replace** the compass or the drill views.

> Minimal-surface rule: the foundation ships the pane + the wiring + the bridge + the reducer
> mirror, all behind the existing ground-mode gating. No new top-level routes, no compass
> changes, no drill-view changes.

## Components & Changes

1. **`src/systems/worldforge/local/localePosition.ts`** (NEW) — the meters↔feet bridge
   (`groundPosToLocaleFeet`, `localeFeetToGroundMeters`, `clampLocaleFeet`, `LOCALE_CELL_FT`).
   Pure; depends only on `units.ts`.

2. **`src/state/reducers/worldReducer.ts`** — `SET_PLAYER_GROUND_POS` case ALSO mirrors the
   new position into `playerCell.localeCoords` as feet (preserving `playerCell.cellId`). On a
   `null` clear, leave `playerCell` untouched (the cell presence outlives a transient ground
   anchor clear). `// GRID-RETIRE: BA-3 feet mirror`.

3. **`src/types/state.ts`** — update the `PlayerCell.localeCoords` doc comment: Stage 3 makes
   it continuous Locale feet backed by `playerGroundPos` (the structural type is unchanged).

4. **`src/components/World3D/LocaleMovePane.tsx`** (NEW) — the click-to-move 2D Locale view
   (pure presentational; `localeExtent`, `groundPos`, `onMoveTo`).

5. **`src/components/World3D/World3DWrapper.tsx`** — mount `LocaleMovePane` (optional, ground
   mode only) wired to `groundRef.current` extent + `state.playerGroundPos`; `onMoveTo`
   converts feet→meters via the bridge and dispatches `SET_PLAYER_GROUND_POS` with the active
   tile. No change to `handleGroundPositionChange` (the reducer now does the feet mirror).

6. **`src/state/appState.ts`** — the existing `MOVE_PLAYER` / `START_GAME_SUCCESS` writers
   keep recording `playerCell` from the legacy tile (Stage 2 behaviour). They set
   `localeCoords` from `subMapCoordinates` (integers) — which is now semantically a *coarse*
   locale position, still valid as a position, superseded by `playerGroundPos`-derived feet
   the moment a ground session reports one. **No change needed** to those writers for the
   foundation; the reducer mirror keeps feet authoritative once 3D/2D moves occur.
   (Documented as the BA-3 boundary: until Stage 6, two producers can write `localeCoords` —
   the legacy tile path in integers and the ground path in feet. The ground path wins whenever
   a Locale session is active, which is the only time continuous feet are meaningful.)

## Testing (TDD — failing test first for each)

- **`localePosition` bridge** — `groundPosToLocaleFeet({xM:0,zM:0}) === {x:0,y:0}`;
  `groundPosToLocaleFeet({xM:0.3048,zM:0.3048})` ≈ `{x:1,y:1}`; round-trip
  `localeFeetToGroundMeters(groundPosToLocaleFeet(p)) ≈ p` for sampled meters; `clampLocaleFeet`
  clamps to `[0, cols×5] × [0, rows×5]`.
- **reducer feet mirror** — dispatching `SET_PLAYER_GROUND_POS` with `{tileX,tileY,xM,zM}` on a
  state that has a `playerCell` produces `playerCell.localeCoords ≈ feetFromMeters(xM/zM)` AND
  leaves `playerGroundPos` byte-identical to today (compat guard) AND preserves
  `playerCell.cellId`. A `null` clear leaves `playerCell` untouched. When `playerCell` is null,
  the mirror is a no-op (no crash, cell stays null — honest unknown).
- **`LocaleMovePane` click-to-move** — a click at a known screen point invokes `onMoveTo` with
  the inverse-transformed Locale feet, clamped to extent; the player marker renders at
  `groundPosToLocaleFeet(groundPos)`.
- **sync (state-level)** — a sequence [3D walk dispatch] then [2D click dispatch] leaves
  `playerGroundPos` and `playerCell.localeCoords` mutually consistent after each (the reducer
  is the single sync point).
- **golden / regression** — full `src/systems/worldforge/`, `src/state/__tests__/`,
  `MapPane.test.tsx`, and the touched `worldReducer` suite stay green; compass/submap movement
  tests unchanged; Stage-1/2 cell-addressed entry + `getTownTilesForGrid` untouched.

## DEFERRED to Stage 6 (explicit)

- **Removing the compass** (`CompassPane`) and the `MOVE_PLAYER` submap stepping.
- **Removing `subMapCoordinates`** as a position field and as a `localeCoords` producer (the
  dual-producer band-aid BA-5 below collapses when the integer path is deleted).
- **Making the cell drive the tile** (inverting the derive direction) — Stage 6.
- **Deleting the 30×20 submap grid** and `mapData.tiles`.

## DEFERRED to Stage 4/5 (explicit, not this foundation)

- **Atlas fast-travel as the inter-cell mover** (Stage 4).
- **Live 3D camera-follow** of a 2D click *while already in 3D* (a render-loop subscription
  pushing `playerGroundPos` into the FreeRoam camera). The foundation syncs the two views
  through state at entry/exit, which satisfies "one state, two views" at the data layer; a
  live camera teleport is polish that risks the entry-feedback loop documented in
  `World3DWrapper` (`frozenEntry`). Tracked under Open Risks.
- **Seamless edge-crossing / streaming adjacent Locales** (Stage 5).

## Band-Aid Ledger updates (umbrella)

- **BA-3 RESOLVED → re-scoped.** `localeCoords` is now continuous Locale feet backed by
  `playerGroundPos` (the bridge + reducer mirror). The "submap sub-tile" interpretation is
  retired for the ground path.
- **BA-5 (new).** `playerCell.localeCoords` has **two producers** until Stage 6: the legacy
  tile path (`appState` writers, integer sub-tile units) and the ground path (`worldReducer`
  `SET_PLAYER_GROUND_POS`, feet). The ground path is authoritative whenever a Locale session
  is active. Tagged `// GRID-RETIRE: BA-5 dual localeCoords producer`. Removed at Stage 6 when
  `subMapCoordinates` / the integer path is deleted, leaving feet as the sole producer.

## Open risks for Stage 4 (atlas fast-travel)

- **`localeCoords` reset on inter-cell travel.** Atlas fast-travel will change `playerCell.cellId`
  to a new Locale; the feet `localeCoords` from the old Locale are meaningless there and must be
  reset (e.g. to the new Locale's spawn/center) — Stage 4 must clear or re-anchor `localeCoords`
  on cell change, mirroring how `MOVE_PLAYER` already nulls `entry3DAnchor`.
- **Units at the atlas boundary.** Atlas travel reasons in world space / cell ids, not Locale
  feet. The bridge module keeps feet strictly Locale-local; Stage 4 must NOT leak Locale feet
  into atlas/world coordinates (the Stage-1 lossy-projection trap in a new guise).
- **Two-producer window.** Until Stage 6, BA-5 means a reader of `localeCoords` could see either
  integer sub-tiles (legacy tile path) or feet (ground path). Stage 4+ readers must treat
  `localeCoords` as authoritative ONLY alongside an active ground/Locale session; otherwise read
  the cell + legacy fields. Documented to avoid a reader assuming a single unit.
