# Grid Retirement — 2D View Retirement Plan (2026-07-01)

**Goal:** finish uncoupling the legacy 30×20 grid by retiring the two legacy 2D
screens (village view + submap) that still read grid coordinates, plus the
`mapCoordinates` field. Decision taken: **retire the 2D screens** (not rewire).

---

## STATUS

### ✅ Done + committed (master, verified green)
| Commit | What |
|---|---|
| `bc96534f` | Deleted `MAP_GRID_SIZE` constant (grid dimensions) |
| `db08e89e` | Deleted the grid↔atlas-cell coordinate bridge fns |
| `55afd879` | 3D entry seeds from player cell; deleted dead `gridCellCenterToWorldMeters` |
| `24481bf7` | **Slice 1a** — retired the 2D village view (`TownCanvas` + 13 files) |
| `94fdab8b` | **Slice 1b** — removed the dead village-view plumbing (21 files, +29/−270) |
| `09ebbf81` | **Slice 2** — retired the 2D submap view (48 files, +12/−6974) |
| `e5c85928` | **Slice 3** — removed the `Location.mapCoordinates` grid field (24 files) |

**The 30×20 grid itself is entirely gone from the running game.** Both legacy 2D
screens are deleted and the `mapCoordinates` field is removed. The ONLY remaining
grid-shaped remnant is the `subMapCoordinates`/`SUBMAP_DIMENSIONS` cluster (slice 4).

### Slice 3 outcome (done — commit `e5c85928`, subagent-executed)
Removed `mapCoordinates` from `types/world.ts`/`.d.ts`; cleaned readers
(`useGameActions` dropped `worldMapCoordinates`; `azgaarDerivedMapService` +
`mapService` dev-only anchor blocks → no-ops; `locationUtils` dropped the static
branch, **kept its `coord_` old-save back-compat parse**); fixed 5 `Location`
literals + ~11 test fixtures.
**Landmine handling:** `submapUtils.ts`'s `mapCoordinates` read lives in
`getPathDetails` ← `getSubmapTileInfo` (the LIVE shared export feeding the spell
`MaterialTagService` + 3D modal + services), so the function could NOT be deleted.
The read was in `isStartingLocationSubmap`, which — with the field always
undefined — already evaluated to always-false; it was replaced with an explicit
`const isStartingLocationSubmap = false` (exact behavior preserved) + unused
`LOCATIONS`/`STARTING_LOCATION_ID` imports dropped. Shared export intact (verified
via landmarkService + context tests, 72 tests green).
Note: FMG/Worldforge's globe `MapCoordinates` (lon/lat in generateAtlas/climate/
atlasDraw) is a DIFFERENT field — untouched, correctly.

### Slice 2 outcome (done — commit `09ebbf81`, subagent-executed)
Deleted the entire `components/Submap/` view (painters, pixi hook, data, 6 view
hooks), `useSubmapProceduralData`, `submapPathContinuity` + `submapActionContracts`,
the `inspect_submap_tile`/`INSPECT_SUBMAP_TILE`/`UPDATE_INSPECTED_TILE_DESCRIPTION`
actions + handlers + their dead Gemini/Ollama producers, and the
`inspectedTileDescriptions` GameState field. −6,974 lines.
**Deviations / new landmines folded in:**
- `submapUtils.ts` + `submapVisualsConfig.ts` KEPT (landmine #1 — shared with
  landmarkService / villageGenerator / ThreeDModal / spell MaterialTagService).
- **LANDMINE #4:** `SUBMAP_DIMENSIONS` (`config/mapConfig.ts`) NOT removable here —
  the KEPT spell `MaterialTagService.ts` uses it (position-bounds check alongside
  `getSubmapTileInfo`). Also consumed by `useGameInitialization`/`useVoyageArrival`/
  `appState` (which feed `subMapCoordinates`).
- `subMapCoordinates` GameState field NOT removed — a documented "Stage-6 legacy
  shadow" threaded through spawn / save / `playerCell.localeCoords` / migrations.
  Out of view-retirement scope; see slice 4.
- Plan's Submap file list was partly stale (no `SubmapPane.tsx`/`SubmapTile.tsx`/
  `__tests__` existed); `submapActionContracts` imports `pathfinding`, not
  `walkabilityUtils` as guessed.

---

### Slice 4a outcome (done — commit `c37b30cb`, subagent-executed)
Removed the dead `subMapCoordinates` GameState field + its action payloads
(`MOVE_PLAYER.newSubMapCoordinates`, `StartGameSuccessPayload.initialSubMapCoordinates`,
`INITIALIZE_DUMMY_PLAYER_STATE.initialSubMapCoordinates`) across all 4 `.ts`/`.d.ts`
defs; dropped the `SUBMAP_DIMENSIONS` imports from `useGameInitialization`/
`useVoyageArrival` that existed ONLY to compute the dead coord; start-town spawn now
sets `playerCell.localeCoords = null` (feet arrive from the ground session). 22 files.
**Save-compat finding:** it's a no-op for loading — the migration already derived
`playerCell` purely from `currentLocationId` (`parseCellLocationId`) and never read
`subMapCoordinates` (prior slices deleted the tile→cell reverse-map). So old saves
still position via `currentLocationId`; a fresh game spawns correctly. Field lived
only in `state.d.ts` (not `state.ts`) and NOT in `factories.ts` (plan list was stale).

---

## ✅✅ COMPLETE — grid entirely uncoupled (including slice 4b)
The world 30×20 grid is **entirely gone from live code** — final sweep shows all four
tokens (`MAP_GRID_SIZE` / `SUBMAP_DIMENSIONS` / `Location.mapCoordinates` /
`subMapCoordinates`) only in explanatory comments, both 2D screens deleted.
**10 grid-retire commits this session:** `bc96534f`, `db08e89e`, `55afd879`,
`24481bf7`, `94fdab8b`, `09ebbf81`, `e5c85928`, `c37b30cb`, `0dff8209` (+ earlier
`76c2c630`/`1f0b1d8a`). Spell agent's uncommitted work untouched throughout.

### Slice 4b outcome (done — commit `0dff8209`)
It turned out NOT to be blocked — the cell-native "what's underfoot" data already
existed. `generateLocal` (via `getWorldforgeLocalForCell`) already builds a
parent-cell-inheriting `LocalTerrain.materialIndex` (region heightfield + biome
surface classification) on demand from just `(worldSeed, cellId)` — both in
GameState, callable mid-cast, no 3D session needed. So the "child cells inherit
parent traits → materials" prerequisite was already satisfied by the local layer.
The rewire: `MaterialTagService.describeNearbyMaterials` now samples that
`materialIndex` at the caster's `playerCell.localeCoords` (5ft cells) + tactical
battle-map offset (falls back to window centre when `localeCoords` is null); the 8
`LocalTerrain` materials map to the existing spell terrain types. Deleted
`SUBMAP_DIMENSIONS` (last consumer gone) + a dead `appState` import.
**Smoke-verified** against a real atlas (a mountain cell → "Stone, Rock, Mineral").
Remaining: a live in-game spell-cast eyeball to confirm the material *feel* across
biomes (Remy). `getSubmapTileInfo` is now orphaned inside the kept `submapUtils`
lib (harmless; out of scope). Pre-existing stale (unrelated): 2 `useVoyageArrival.test`
`getTownTilesForGrid` asserts + the `GameLayoutErrorBoundary.test` failure.

### (historical) Slice 4b was thought BLOCKED on a prerequisite — it wasn't
`SUBMAP_DIMENSIONS` (`config/mapConfig.ts`) + its sole live consumer
`systems/spells/ai/MaterialTagService.ts` (uses it + `getSubmapTileInfo` as a
local-terrain-material sampling grid when a spell is cast — produces the "Verified
local material context" string that's part of the spell AI safety boundary).

**Why it can't be done yet (Remy, 2026-07-01):** the rewire needs a cell-native
"what's actually underfoot" terrain source to replace `getSubmapTileInfo`. That
doesn't exist until **the submap (child) cells inherit terrain traits from their
parent cell**. Until then, removing `SUBMAP_DIMENSIONS` has nothing to sample and
collapses `MaterialTagService` to the biome-only guess — a spell-AI REGRESSION, not
a replacement (would violate the "safely" clause). So 4b is BLOCKED on the
cell-trait-inheritance feature (related to [[voronoi-3d-world-goal]] /
[[open-region-wilderness-design]]'s "ask the place"), not merely awaiting a cast.

**To finish once cell trait inheritance lands:** sample local terrain/materials from
the child cell's inherited traits at the caster's position, keeping a real "verified"
path; then delete `SUBMAP_DIMENSIONS`. Verify with a live spell cast.

Also stale (pre-existing, unrelated): 2 `useVoyageArrival.test` assertions on
`getTownTilesForGrid(...,30,20)` + the `GameLayoutErrorBoundary.test` failure.

---

## SLICE 4 (original notes) — the `subMapCoordinates` / `SUBMAP_DIMENSIONS` cluster
The last submap-grid remnant. `subMapCoordinates` (a 30×20 submap tile coord) is
still a live GameState field feeding spawn (`useGameInitialization`), voyage
arrival (`useVoyageArrival`), save hydration (`appState`), and migrations. The
spell `MaterialTagService` uses `SUBMAP_DIMENSIONS` as tile bounds when sampling
material tiles at a caster position. Retiring this means: re-express the spell
material sampling off a grid, and remove `subMapCoordinates` from spawn/save/
migrations (needs a save migration). **High-risk, touches spells + save-compat —
do LAST, verify a fresh game + a spell cast.** Grep `subMapCoordinates` +
`SUBMAP_DIMENSIONS` for the full consumer set before starting.

### Slice 1b outcome (done — commit `94fdab8b`, subagent-executed)
Removed: `townState`+`townEntryDirection` GameState fields, 14 dead town/village
action types (across all 4 `.ts`/`.d.ts` defs) + their handlers, and trimmed
`townReducer` to just its live `OPEN_TEMPLE`/`CLOSE_TEMPLE` cases (landmine #2
handled). Kept `walkabilityUtils`/`types/town`/`templeUtils`.
**Deviations folded in:**
- `GamePhase.VILLAGE_VIEW` was NOT hard-deleted — the enum has a save-index
  compat invariant (later phases carry explicit ordinals). It was replaced with a
  reserved placeholder `RESERVED_RETIRED_VILLAGE_VIEW` holding ordinal 6, so the
  live `VILLAGE_VIEW` name is gone without renumbering COMBAT/WORLD3D_DEMO/etc.
  (A true hard delete + save migration is an optional follow-up.)
- `ENTER_VILLAGE` had a live producer in `services/gemini/encounters.ts:291`
  (Gemini encounter suggestions) that dead-ended at the removed phase — removed
  the producer branch (falls through to `gemini_custom_action`) + stale schema hints.
- Removed the `test_village` DevMenu button/union member (dead-ended too).
- Pre-existing (NOT introduced): `DevMenu.tsx(198)` `combat_messaging_demo` union
  error + `GameLayoutErrorBoundary.test.tsx` failure + `core.d.ts`/`actions.d.ts`
  already stale vs their `.ts` sources — all present at HEAD, left as-is.

---

## ⚠️ LANDMINES (verified — the auto-generated deletion map got these WRONG)
1. **`utils/spatial/submapUtils.ts` is shared infrastructure, NOT deletable.**
   Its exports feed kept systems: `createSeededRandom` → `landmarkService`,
   `villageGenerator`; `simpleHash` → 3D `ThreeDModal` (+ barrel alias); 
   `getSubmapTileInfo` → **spell system** `MaterialTagService`. Deleting it breaks
   spells + the 3D modal + 2 services.
2. **`state/reducers/townReducer.ts` is the SOLE handler of `OPEN_TEMPLE`/`CLOSE_TEMPLE`**
   (lines 119-152), which are LIVE (dispatched by `actionHandlers.ts:512` + DevMenu).
   → **Trim** townReducer to just the temple cases; do NOT delete it.
3. **`walkabilityUtils` + `types/town.ts` stay** — used by `Submap/useQuickTravel`,
   `submapActionContracts`, and generic pathfinding, far beyond the retired view.

---

## SLICE 1b — village-view dead-state cleanup (fragile; dead-code, not grid)
The 2D village view is already deleted (1a); this removes its now-unreachable
plumbing. It's a ~12-file coordinated edit across the dual `.ts`/`.d.ts` action
definitions, threading around the live temple handlers.

**Remove:**
- `GamePhase.VILLAGE_VIEW` — `types/core.ts` + `types/core.d.ts`; refs in
  `hooks/useAutoSave.ts:15`, `hooks/useHistorySync.ts:27`,
  `App.tsx:1059` (`test_village` dispatch),
  `components/__tests__/GameLayoutErrorBoundary.test.tsx:16,25,38`.
- GameState fields `townState` + `townEntryDirection` — `types/state.ts:409,411`,
  `types/state.d.ts:219,220`, `state/initialState.ts:250,251`,
  `utils/core/factories.ts:619,620 + 807,808`.
- Dead action types (in `state/actionTypes.ts` + `.d.ts` AND `types/actions.ts` +
  `.d.ts`): `ENTER_TOWN`, `MOVE_IN_TOWN`, `STOP_MOVING_IN_TOWN`,
  `SET_TOWN_VIEWPORT`, `EXIT_TOWN`, `SET_TOWN_ENTRY_DIRECTION`, `ENTER_VILLAGE`,
  `APPROACH_VILLAGE`, `OBSERVE_VILLAGE`, `APPROACH_TOWN`, `OBSERVE_TOWN`
  (+ `EXIT_VILLAGE`/`VISIT_GENERAL_STORE`/`VISIT_BLACKSMITH` — verify dead first).
- Their handlers in `hooks/actions/actionHandlers.ts`.
- **Trim** `townReducer.ts`: delete the `ENTER_TOWN`/`MOVE_IN_TOWN`/
  `STOP_MOVING_IN_TOWN`/`SET_TOWN_VIEWPORT`/`EXIT_TOWN`/`SET_TOWN_ENTRY_DIRECTION`
  cases + the `walkabilityUtils`/`types/town` imports; **KEEP** `OPEN_TEMPLE`/
  `CLOSE_TEMPLE` + their imports (`generateVillageTemple`, `VillagePersonality`).

**Keep:** `walkabilityUtils`, `types/town.ts`, `templeUtils`, `realmsmith` types.
**Gate:** `tsc` clean + run the reducer/temple/state tests before commit.

---

## SLICE 2 — retire the 2D submap VIEW (keep shared helpers)
Delete the submap *screen*, keep the shared utilities (landmine #1).

**Delete:** `components/Submap/` (SubmapPane + `SubmapTile` + `painters/` + pixi
`hooks/usePixiApplication` + `submapData.ts` + `submapVisuals.ts` +
`useDayNightOverlay`/`useInspectableTiles`/`useQuickTravel`/`useSubmapGlossaryItems`/
`useSubmapGrid`/`useTileHintGenerator`), `hooks/useSubmapProceduralData.ts`,
`utils/spatial/submapPathContinuity.ts`, `config/submapVisualsConfig.ts`
(if villageGenerator's `villageBuildingVisuals` need is moved/kept), the
`inspect_submap_tile` + `UPDATE_INSPECTED_TILE_DESCRIPTION` actions/handlers,
`SUBMAP_DIMENSIONS` (`config/mapConfig.ts`), `subMapCoordinates` state field.

**KEEP (landmine #1):** `utils/spatial/submapUtils.ts` — it's a utility lib now.
Optionally rename its shared exports out of "submap" naming into a neutral home.
Verify each `components/Submap/*` file's importers before deleting (some are used
by kept code, e.g. `submapVisuals.ts` imports `useSubmapProceduralData`).

---

## SLICE 3 — remove the `mapCoordinates` grid field
Once the submap view is gone, remove `Location.mapCoordinates`
(`types/world.ts` + `.d.ts`) and clean its remaining readers:
`services/azgaarDerivedMapService.ts`, `services/mapService.ts`,
`utils/spatial/locationUtils.ts` (keep the legacy `coord_` parse for old-save
back-compat), `hooks/useGameActions.ts`, `useSubmapProceduralData`/`submapUtils`
(gone by slice 2).

---

## Constraints (every slice)
Work in master (no branches/worktrees). Edit on a clean tree, commit
**my-files-only** (the concurrent spell agent's uncommitted work stays untouched).
`tsc` clean on touched files + targeted tests green before each commit. Verify
every deletion's importers first — the auto map has been wrong 3×.
