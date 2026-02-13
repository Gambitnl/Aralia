# World Map Rewire Mapping (Azgaar Integration)

**Date**: 2026-02-12  
**Status**: Active mapping artifact (Stage R1 implemented, parity validation in progress)

## Goal

Define exactly what the current world map is coupled to, so we can replace the renderer with Azgaar runtime output without breaking travel, submap generation, persistence, or state transitions.

## Decouple Answer (Plain)

The old world map should be decoupled in two steps, not all at once:

1. **Renderer decouple first**: swap `MapPane` display from square-tile UI to Azgaar atlas UI while preserving the existing gameplay contracts (`MapData`, `MOVE_PLAYER`, `worldSeed`, save/load).
2. **Grid-UI decouple second**: remove legacy grid-only UI code (`MapTile`-driven rendering and related assumptions) after click-to-cell travel and parity checks are passing.

This avoids breaking movement/state logic while the visual layer changes.

## Current Coupling Inventory

### 1) World map render and map modal shell

- `src/components/layout/GameModals.tsx:128`
- `src/components/layout/GameModals.tsx:131`
- `src/components/MapPane.tsx:17`
- `src/components/MapPane.tsx:65`
- `src/components/MapPane.tsx:130`
- `src/components/MapPane.tsx:223`
- `src/components/MapPane.tsx:268`
- `src/components/MapPane.tsx:310`

Current coupling:
- World map visibility and rendering is hard-wired to `MapPane`.
- `MapPane` now has two render paths: Azgaar atlas (default) and legacy grid fallback.

Rewire action:
- Keep `GameModals` mounting contract unchanged.
- Keep atlas as default and retain `onTileClick` callback bridge during transition.

Decouple stage:
- **Stage R1 complete** (renderer swap), **R2 pending** (legacy cleanup).

### 2) Travel interaction from world map clicks

- `src/App.tsx:438`
- `src/App.tsx:456`
- `src/App.tsx:463`
- `src/App.tsx:472`

Current coupling:
- `handleTileClick` in `App.tsx` directly mutates map discovery/player-current flags on tile coordinates and dispatches `MOVE_PLAYER`.
- Assumes direct grid click semantics.

Rewire action:
- Keep `MOVE_PLAYER` behavior and discovery mutation semantics.
- Add a click bridge in `MapPane` that converts atlas click -> hidden cell (`x,y`) -> existing `onTileClick`.

Decouple stage:
- **Stage R1** for bridge, **Stage R2** for cleanup/refactor.

### 3) Map generation source and world seed entry points

- `src/services/mapService.ts:24`
- `src/services/mapService.ts:35`
- `src/services/mapService.ts:45`
- `src/hooks/useGameInitialization.ts:97`
- `src/hooks/useGameInitialization.ts:154`
- `src/hooks/useGameInitialization.ts:215`
- `src/hooks/useGameInitialization.ts:256`

Current coupling:
- New game/start flows call `generateMap(...)`.
- `mapService` routes generation through Azgaar-derived backend with legacy fallback.

Rewire action:
- Preserve `generateMap` signature.
- Evolve output data to include richer Azgaar render payload while maintaining `MapData.tiles` compatibility until full migration.

Decouple stage:
- **Stage G1** (backend maturity) parallel to renderer swap.

### 4) Type contracts and compatibility layer

- `src/types/world.ts:221`
- `src/types/world.ts:239`
- `src/types/world.ts:241`
- `src/types/world.ts:242`
- `src/state/actionTypes.ts:18`
- `src/state/actionTypes.ts:26`
- `src/state/actionTypes.ts:32`

Current coupling:
- `MapData` + `MapTile[][]` shape is depended on broadly by actions/reducers/components.
- `azgaarWorld?` exists as optional metadata, not yet primary runtime contract.

Rewire action:
- Keep `MapData.tiles` stable in transition.
- Expand `azgaarWorld` payload to drive renderer; only remove grid assumptions after travel/save/submap parity is complete.

Decouple stage:
- **Stage C1** (compatibility contract), later **C2** (grid assumption removal).

### 5) Reducer/state update logic

- `src/state/appState.ts:99`
- `src/state/appState.ts:161`
- `src/state/appState.ts:452`
- `src/state/appState.ts:494`
- `src/state/appState.ts:589`
- `src/state/reducers/worldReducer.ts:24`

Current coupling:
- Game lifecycle (new game/load/move) carries `mapData` and `worldSeed`.
- `MOVE_PLAYER` and `SET_MAP_DATA` are canonical update points.

Rewire action:
- Keep these reducer contracts stable.
- Do not re-plumb reducer action shapes during renderer migration.

Decouple stage:
- **No decouple in R1**; revisit after renderer + click bridge parity.

### 6) Persistence and autosave

- `src/services/saveLoadService.ts:84`
- `src/services/saveLoadService.ts:101`
- `src/services/saveLoadService.ts:201`
- `src/services/saveLoadService.ts:220`
- `src/services/saveLoadService.ts:248`

Current coupling:
- Full `GameState` (including `mapData`, `worldSeed`, auto-save preference path via app state) is serialized/deserialized.

Rewire action:
- Preserve save compatibility and seed persistence while introducing richer map payload.
- If payload size grows, add guarded compression/serialization strategy in a dedicated phase.

Decouple stage:
- **No decouple in R1**; strict compatibility requirement.

### 7) Submap/minimap dependency on world coordinates

- `src/components/Submap/SubmapPane.tsx:70`
- `src/components/Submap/SubmapPane.tsx:74`
- `src/components/Submap/SubmapPane.tsx:166`
- `src/hooks/useSubmapProceduralData.ts:68`
- `src/hooks/useSubmapProceduralData.ts:121`
- `src/components/Minimap.tsx:176`

Current coupling:
- Submap/minimap generation uses world cell coords and biome lookup from `mapData.tiles`.
- Continuity helpers assume stable hidden cell coordinates.

Rewire action:
- Keep hidden world cell model intact (even if atlas is seamless visually).
- Atlas click must resolve to stable hidden cell coords used by submap/minimap logic.

Decouple stage:
- **Not decoupled** in renderer phase; this is a protected contract.

## Decouple Stage Gates

### Stage R1 (required before removing old grid UI)

Criteria:
- Map modal renders Azgaar atlas surface as default world map view.
- Player can click atlas and travel works via existing movement pipeline.
- Discovery/player-current updates still function.
- Save/load preserves same location and world seed behavior.

Do not remove yet:
- `MapData.tiles` compatibility.
- `MOVE_PLAYER` / `SET_MAP_DATA` payload contracts.
- Submap hidden cell anchoring.

### R1 Incident Log (Resolved)

1. **Base path 404**
- Symptom: `GET /vendor/azgaar/index.html ... 404`
- Cause: hardcoded root-relative embed path while app runs under Vite base `/Aralia/`.
- Fix: iframe URL now resolves via `import.meta.env.BASE_URL`.

2. **TypeScript module 404s inside iframe**
- Symptom: requests for `utils/index.ts`, `modules/index.ts`, `renderers/index.ts` with follow-on runtime reference errors.
- Cause: vendored Azgaar source HTML (`src/index.html`) instead of runtime-built bundle.
- Fix: built Azgaar runtime (`npm run build` in `.tmp/azgaar-src`) and replaced vendored entry/assets with `dist` output.

3. **Stale cached embed HTML**
- Symptom: browser continued using prior broken iframe entry.
- Fix: added runtime cache-busting query token on iframe URL.

4. **Absolute built module path mismatch**
- Symptom: `GET /Fantasy-Map-Generator/index-*.js 404` from iframe page.
- Cause: built Azgaar HTML references module bundle with deployment-specific absolute base.
- Fix: patched vendored Azgaar runtime HTML to use relative module path (`./index-*.js`) for local embedding.

### Stage R2 (legacy grid UI cleanup)

Criteria:
- R1 stable under smoke tests and save/load cycle.
- Atlas click-to-cell bridge verified on edge/near-border clicks.
- No regressions in quick travel, submap entry, and discovery updates.

Actions:
- Remove or archive legacy tile-grid renderer paths.
- Reduce duplicated biome color/icon mapping only if atlas renderer fully owns visual style.

## Rewire Checklist (Execution)

1. Done: Add Azgaar runtime map host in `MapPane` with game-safe UI mode (tooling hidden).
2. Done: Implement atlas click -> hidden cell resolver (current version is positional approximation).
3. Done: Keep `onTileClick(x,y,tile)` bridge active until `App.tsx` travel handler is migrated.
4. Done: Added main-menu world-map entry and pre-run world-generation controls with lock policy (`save exists` or `active run in memory` => regeneration blocked).
5. Pending: Verify `MOVE_PLAYER` and discovery updates from atlas interactions across center/edge/coast clicks.
6. Pending: Run save/load compatibility check (new save + reload + movement + reload).
7. Pending: Validate submap entry still uses correct world coordinates and biome context.
8. Pending: Remove legacy grid rendering paths only after parity checks pass.
9. Backlog (non-gating): Add locked-mode interception for all Azgaar mutating tools still exposed via embedded menus (especially `Edit Burg` regeneration options).
10. Backlog (non-gating): Audit `Burgs Overview` and connected editors for map-mutating operations and gate them behind the same world-generation lock policy.
11. Backlog (non-gating): Implement category-level lock policy for `Regenerate`, `Add`, and `Create` tool actions; preserve read-only map/layer inspection.

## Regression Risks To Watch

- Click mismatch near coast/mountains causing invalid cell travel targets.
- Desync between atlas visuals and `mapData.tiles` biome IDs.
- Save payload growth causing localStorage stress.
- Submap continuity breaks if hidden cell mapping changes unexpectedly.
- Azgaar runtime asset drift if vendor files are refreshed without rebuilding and recopying runtime bundle.
