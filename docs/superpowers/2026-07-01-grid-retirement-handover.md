# Handover — 30×20 Grid Retirement (2026-07-01)

## TL;DR
**Status: COMPLETE.** The legacy 30×20 world grid is entirely gone from live code.
10 commits this session; a final sweep shows every grid token (`MAP_GRID_SIZE`,
`SUBMAP_DIMENSIONS`, `Location.mapCoordinates`, `subMapCoordinates`) only in
explanatory comments. The world is fully Voronoi-cell-native.

**The only open item is a human check:** cast a spell in a few different biomes
in-game and confirm the "Materials present here: …" line reads sensibly. The
mechanism is proven (smoke-tested); this just confirms the *feel*.

Companion doc (per-slice detail): `docs/superpowers/plans/2026-07-01-grid-2d-view-retirement-plan.md`.

---

## What the goal was
> "safely deprecate and uncouple the 30×20 grid entirely from the aralia app.
> implement new systems that replace it to fit the new world map system."

The legacy world was addressed by a 30×20 square grid (`mapData.tiles`,
`coord_X_Y` ids, `MAP_GRID_SIZE`, submap tiling). The new world is the Worldforge
Voronoi atlas — places are **cells** (`playerCell.cellId`), positions are
continuous **Locale feet** (`playerCell.localeCoords`). This program removed the
last of the old grid and pointed every remaining reader at the cell-native systems.

---

## Commits (this session, all on `master`)
| Commit | What |
|---|---|
| `1f0b1d8a` | MapPane fully cell-native; hidden-site pins keyed by `cellId` |
| `76c2c630` | World3DWrapper 3D entry fully cell-native |
| `bc96534f` | Deleted `MAP_GRID_SIZE` constant |
| `db08e89e` | Deleted the grid↔atlas-cell coordinate bridge fns |
| `55afd879` | 3D entry seeds from the player cell; deleted dead `gridCellCenterToWorldMeters` |
| `24481bf7` | **Slice 1a** — retired the 2D village view (`TownCanvas` + 13 files) |
| `94fdab8b` | **Slice 1b** — removed dead village-view plumbing; trimmed `townReducer` to its live temple cases |
| `09ebbf81` | **Slice 2** — retired the 2D submap view (−6,974 lines) |
| `e5c85928` | **Slice 3** — removed `Location.mapCoordinates` |
| `c37b30cb` | **Slice 4a** — removed the dead `subMapCoordinates` shadow field |
| `0dff8209` | **Slice 4b** — spell material sampling goes cell-native; deleted `SUBMAP_DIMENSIONS` |

Slices 1b–4a were executed by **sequential subagents** (one at a time), each
committing only its own files.

---

## The replacement systems (what the grid became)
- **Location identity:** `coord_X_Y` → `cell_<cellId>` (`utils/location/cellLocationId.ts`).
  Legacy `coord_` parse kept for old-save back-compat.
- **Player position:** `GameState.playerCell = { cellId, localeCoords }` where
  `localeCoords` is continuous Locale feet (5 ft/cell, NW-origin) from the ground
  session. The old `subMapCoordinates` tile shadow is gone.
- **Biome:** `biomeIdForCell(worldSeed, cellId)` (`worldforge/local/biomeForCell.ts`).
- **Local terrain + materials:** `getWorldforgeLocalForCell(worldSeed, cellId)` →
  `generateLocal` builds a `LocalTerrain` (`materialIndex` over 5 ft cells:
  `grass/dirt/rock/sand/wetland/water/paved/floor`), inheriting the parent cell's
  height (region heightfield) + biome. Pure, cached, on-demand — no 3D session
  needed. This is what the streamed 3D ground renders from AND what spell material
  sampling now reads.
- **3D entry / spawn / travel / hidden sites:** all keyed off `cellId`.

---

## ⚠️ The 4 landmines (the auto-generated deletion map was wrong 4×)
Verify-before-cut caught each; trust nothing without grepping:
1. **`utils/spatial/submapUtils.ts` is shared infra, NOT deletable** — its
   `createSeededRandom` / `simpleHash` / `getSubmapTileInfo` feed `landmarkService`,
   `villageGenerator`, the 3D `ThreeDModal`, and the spell system. **KEPT.**
2. **`state/reducers/townReducer.ts` is the sole live handler of `OPEN_TEMPLE` /
   `CLOSE_TEMPLE`** — trimmed to those cases, NOT deleted.
3. **`walkabilityUtils` + `types/town.ts` stay** — used well beyond the retired views.
4. **`SUBMAP_DIMENSIONS` was used live by the spell `MaterialTagService`** — couldn't
   be deleted until slice 4b rewired that sampling (see below).

---

## Slice 4b in detail (the last and subtlest piece)
`MaterialTagService.describeNearbyMaterials(position, gameState)` gives the spell AI
its "what's underfoot" context (e.g. for "Meld into Stone"). It used to feed the
caster's **battle-map** position into the 30×20 `SUBMAP_DIMENSIONS` grid via
`getSubmapTileInfo` — a legacy conflation.

It now:
1. `getWorldforgeLocalForCell(worldSeed, playerCell.cellId)` → `LocalTerrain.materialIndex`.
2. Locates the caster: `localeCoords` (5 ft cells) + tactical battle-map offset
   (relative to `BATTLE_MAP_DIMENSIONS` centre). Falls back to the window centre
   when `localeCoords` is null (pre-ground-session).
3. Maps the 8 `LocalTerrain` materials → existing spell terrain types →
   `getMaterialsFromTerrainType`.

Smoke-verified against a real atlas (a mountain cell → "Stone, Rock, Mineral"),
both with and without `localeCoords`. `getSubmapTileInfo` is now orphaned inside the
kept `submapUtils` lib (harmless).

**Key lesson:** the "child cells must inherit parent traits first" prerequisite that
looked like a blocker was already built in the local layer — the fix was wiring, not
new infrastructure. Verify what exists before assuming a blocker.

---

## Open items
1. **Live spell-cast eyeball — DONE 2026-07-01 (biome sweep).** The exact caster-facing
   line was generated for real atlas cells in EVERY land biome on two world seeds
   (12345, 98765) via `MaterialTagService.describeNearbyMaterials` against the real
   cell-native terrain — the same string the in-game cast reads. All biomes read
   sensibly (desert→Sand, forest→Wood/Plant Matter/Leaves, wetland→Plant Matter/Mud/
   Water, water→Water). The sweep exposed and fixed two wording-table gaps in
   `inferMaterialsFromBiome`: jungle biomes and tundra fell through to the generic
   "Dirt, Grass, Wood" default; jungle now reads Wood/Plant Matter/Vines/Dirt and
   tundra Frozen Earth/Stone/Lichen/Ice (glacier→Ice/Snow/Stone, matched before
   'mountain' so `mountain_glacier` reads icy). Also repaired
   `MaterialTagService.test.ts`, which commit `f2a9f800` had left syntactically
   broken (`'forest_clearing'(makeWorldTile(...))`); it now tests the cell-native
   path against the real atlas. 3/3 tests green; no tsc errors in `systems/spells/ai`.
   **New finding (separate task):** the slope-based `rock` material in
   `generateLocal` NEVER fires in practice — 0 rock across 10.8M sampled 5-ft cells
   spanning h20–88 on seed 12345 (`ROCK_SLOPE` 0.0035 is above real gradients), and
   neither test seed has Glacier land (the only biome whose ground is rock). So the
   verified path can essentially never report "Stone, Rock, Mineral" — Meld into
   Stone can't find stone in mountains. Fix belongs in terrain-material tuning
   (affects 3D ground rendering too, needs its own visual eyeball).
   **→ FIXED 2026-07-01 (rock-slope task):** slope distributions turned out to be
   detail-noise dominated and nearly identical at every altitude (p50≈6e-4,
   p99≈1.6e-3, max≈2.6e-3), so slope alone can never mark mountains. `generateLocal`
   now uses `ROCK_SLOPE 0.0016` (p99 → steepest ~1% outcrops anywhere) PLUS an
   altitude rock band: solid rock above `ROCK_LINE 0.65` (FMG h≈65), mixing in from
   `0.50` up, dithered by the ~60ft world noise into coherent patches. Re-measured:
   rock 0.00% → 8.38% (seed 12345) / 9.20% (seed 98765) over the same 30-cell
   height spread; biome sweep now reports "Stone, Rock, Mineral" on h≥65 cells and
   the h=88 peak at every probed offset. 3 new unit tests
   (`generateLocal.test.ts` altitude/slope block), golden snapshot re-frozen,
   3D ground view eyeballed at gx7/gy8 (h=88, bare rock) and gx15/gy9 (h=59,
   rock/grass patches) — captures in `.agent/3d-visual-quality/captures/rockfix-*`.
2. **Optional polish (non-grid, low value):** `GamePhase.VILLAGE_VIEW` is a reserved
   placeholder ordinal (`RESERVED_RETIRED_VILLAGE_VIEW`) kept to preserve save-index
   compatibility — a true hard-delete would need a save migration.
3. **Pre-existing, unrelated (NOT from this work):** 2 stale `useVoyageArrival.test`
   assertions on `getTownTilesForGrid(...,30,20)`, the `GameLayoutErrorBoundary.test`
   failure, and `core.d.ts`/`actions.d.ts` already divergent from their `.ts` sources.

---

## Concurrent-agent note (important for whoever works next)
A **spell/combat agent** had UNCOMMITTED work in the tree throughout this session:
`commands/effects/SummoningCommand.ts`, `UtilityCommand.ts`,
`commands/factory/AbilityCommandFactory.ts`, `types/combat.ts`, `types/spells.ts`,
`spellAttackMetadata.ts`, `hooks/combat/useTurnManager.ts`/`useTurnOrder.ts`, some
spell docs, and untracked `*LiveData.test.ts` files. **None of it was committed,
staged, or modified** — every slice staged its own files by explicit path. That work
is still uncommitted in the tree. The large residual `tsc` error surface (~500
errors) is theirs, not this program's — filter it out when typechecking.

---

## How to verify (commands)
- Typecheck: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
  (grep for your files; ignore the spell agent's error surface).
- Tests: `node node_modules/vitest/vitest.mjs run <files>`.
- Grid gone: `grep -rnE "MAP_GRID_SIZE|SUBMAP_DIMENSIONS|\.mapCoordinates|subMapCoordinates" src --include=*.ts --include=*.tsx | grep -v __tests__`
  → only comment lines should return.
- Live: run the app, cast a spell in different biomes, read the material context.
