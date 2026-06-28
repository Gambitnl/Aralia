# Grid↔Atlas Bridge Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the atlas cell id the anchor authority for 3D entry so "click a cell, enter that exact cell" holds, routing every cell↔tile conversion through one module.

**Architecture:** The clicked Worldforge atlas cell is carried intact (via a new `entry3DAnchorCell` GameState field) from `MapPane` → `App` → `World3DWrapper` → a new cell-first generator entrypoint `getWorldforgeLocalForCell`. The grid tile becomes a value *derived* from the cell (legacy bookkeeping only). The duplicated/forked coordinate functions collapse into `gridAtlasBridge.ts` with one land rule.

**Tech Stack:** TypeScript, React, Vitest, React Three Fiber. Tests run with `npx vitest run <file>`. Typecheck: `npm run typecheck`. Lint: `npm run lint`.

> **Project note (overrides skill default):** This repo auto-commits a daily snapshot at 2am; the user's standing directive is *never commit manually — leave work in the tree*. Each task therefore ends with a **verification checkpoint** (run tests/typecheck) instead of a `git commit`. Do not run `git commit`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/systems/worldforge/local/gridAtlasBridge.ts` | Single source of truth for grid↔atlas mapping + land rule | Modify |
| `src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts` | Unit tests for the above | Modify |
| `src/systems/worldforge/bridge/legacySubmapBridge.ts` | Generator entrypoints; delegate reverse mapping to shared module | Modify |
| `src/systems/worldforge/bridge/__tests__/cellEntry.test.ts` | Tests for cell-first entrypoint | Create |
| `src/types/state.ts` | `entry3DAnchorCell` field on GameState | Modify |
| `src/state/actionTypes.ts` | `SET_ENTRY_3D_ANCHOR_CELL` action | Modify |
| `src/state/appState.ts` | Reducer case for the action | Modify |
| `src/state/initialState.ts` | Default `entry3DAnchorCell: null` | Modify |
| `src/utils/core/factories.ts` | Default `entry3DAnchorCell: null` (both factories) | Modify |
| `src/state/__tests__/entry3DAnchorCell.test.ts` | Reducer test | Create |
| `src/components/MapPane.tsx` | Pass exact anchor cell; use shared helpers; drop burg-snap hack | Modify |
| `src/App.tsx` | Dispatch anchor cell on Enter-3D | Modify |
| `src/hooks/useWorldViewMode.ts` | Clear anchor cell on 3D exit | Modify |
| `src/components/World3D/World3DWrapper.tsx` | Branch on anchor cell → cell-first entrypoint | Modify |

---

## Task 1: Shared land rule + land-aware reverse mapping in `gridAtlasBridge.ts`

**Files:**
- Modify: `src/systems/worldforge/local/gridAtlasBridge.ts`
- Test: `src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts` (extend the import on line 2-8 to include `snapToLandCell` and `legacyGridToLandAtlasCell`):

```ts
// Append inside the top-level describe('gridAtlasBridge', ...) block.

// A 2x2 atlas where cell 1 is water (h < 20) and cell 3's site is nearest to it.
const landAtlas = {
  graphWidth: 100,
  graphHeight: 100,
  pack: { cells: { p: [[25, 25], [75, 25], [25, 75], [60, 40]], h: [50, 5, 50, 50] } },
} as any;

it('snapToLandCell returns the cell unchanged when it is already land', () => {
  expect(snapToLandCell(landAtlas, 0)).toBe(0);
  expect(snapToLandCell(landAtlas, 3)).toBe(3);
});

it('snapToLandCell snaps a water cell to the nearest land cell by site distance', () => {
  // cell 1 site (75,25) → nearest land site is cell 3 (60,40): d=15²+15²=450,
  // beats cell 0 (25,25): d=50²=2500.
  expect(snapToLandCell(landAtlas, 1)).toBe(3);
});

it('legacyGridToLandAtlasCell resolves a grid cell to the nearest LAND atlas cell', () => {
  // grid cell {1,0} projects to graph point (75,25) → nearest cell is water cell 1,
  // but the land-aware lookup must return the nearest LAND cell (3).
  expect(legacyGridToLandAtlasCell(landAtlas, { x: 1, y: 0 }, gridSize)).toBe(3);
  // grid cell {0,0} → (25,25) is land cell 0 already.
  expect(legacyGridToLandAtlasCell(landAtlas, { x: 0, y: 0 }, gridSize)).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts`
Expected: FAIL — `snapToLandCell is not exported` / `legacyGridToLandAtlasCell is not exported`.

- [ ] **Step 3: Implement the helpers**

In `src/systems/worldforge/local/gridAtlasBridge.ts`, replace the existing `nearestCell` function (lines 34-48) with a predicate-aware version, and add the two new exports after `legacyGridToAtlasCell` (after line 58):

```ts
/** Nearest Voronoi cell id to a graph point, optionally filtered by predicate. */
function nearestCell(
  atlas: FmgAtlasResult,
  gx: number,
  gy: number,
  accept?: (cellId: number) => boolean,
): number {
  const p = atlas.pack.cells.p;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (!c) continue;
    if (accept && !accept(i)) continue;
    const dx = c[0] - gx;
    const dy = c[1] - gy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** True if an atlas cell is land (FMG height convention: h >= 20). */
function isLandCell(atlas: FmgAtlasResult, cellId: number): boolean {
  const h = (atlas.pack.cells as { h?: ArrayLike<number> }).h;
  return (h?.[cellId] ?? 0) >= 20;
}

/**
 * Snap an atlas cell to the nearest LAND cell (FMG h >= 20). Returns the cell
 * unchanged if it is already land. Used at click time, when a specific clicked
 * cell must resolve to walkable ground for 3D entry. Returns the input cell id
 * if there is no site or no land cell (caller decides).
 */
export function snapToLandCell(atlas: FmgAtlasResult, cellId: number): number {
  if (cellId < 0 || isLandCell(atlas, cellId)) return cellId;
  const site = atlas.pack.cells.p?.[cellId];
  if (!site) return cellId;
  const nearest = nearestCell(atlas, site[0], site[1], (i) => isLandCell(atlas, i));
  return nearest >= 0 ? nearest : cellId;
}

/**
 * Map a legacy grid cell → the nearest LAND atlas cell to its proportional
 * graph point. This is the reverse mapping the 3D generator uses (it needs
 * walkable ground), as opposed to legacyGridToAtlasCell which takes the nearest
 * of ALL cells (used by the player marker).
 */
export function legacyGridToLandAtlasCell(
  atlas: FmgAtlasResult,
  cell: GridCoord,
  gridSize: GridSize,
): number {
  const [gx, gy] = gridCellToGraphPoint(cell, gridSize, atlas);
  return nearestCell(atlas, gx, gy, (i) => isLandCell(atlas, i));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 5: Verification checkpoint (no commit)**

Run: `npm run typecheck`
Expected: no new type errors in `gridAtlasBridge.ts`.

---

## Task 2: Cell-first generator entrypoint + delegate the reverse mapping

**Files:**
- Modify: `src/systems/worldforge/bridge/legacySubmapBridge.ts`
- Test: `src/systems/worldforge/bridge/__tests__/cellEntry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/systems/worldforge/bridge/__tests__/cellEntry.test.ts`:

```ts
/**
 * @file cellEntry.test.ts
 * Verifies the cell-first 3D entrypoint anchors EXACTLY on the requested atlas
 * cell, and that the tile-based entrypoint delegates to it via the shared,
 * land-aware reverse mapping (no neighbour drift, no forked land rule).
 */
import { describe, it, expect } from 'vitest';
import {
  getBridgeAtlas,
  getWorldforgeLocalForCell,
  getWorldforgeLocalForLocation,
  legacyTileToAtlasCell,
} from '../legacySubmapBridge';
import { legacyGridToLandAtlasCell } from '../../local/gridAtlasBridge';

const firstLandCell = (atlas: ReturnType<typeof getBridgeAtlas>): number => {
  const h = atlas.pack.cells.h;
  for (let i = 0; i < h.length; i++) if (h[i] >= 20) return i;
  throw new Error('no land cell');
};

describe('getWorldforgeLocalForCell (cell-first 3D entry)', () => {
  it('anchors exactly on the requested cell (no drift)', () => {
    const atlas = getBridgeAtlas(42);
    const cell = firstLandCell(atlas);
    expect(getWorldforgeLocalForCell(42, cell).anchorCellId).toBe(cell);
  });

  it('tile entrypoint delegates through the shared land-aware reverse mapping', () => {
    const atlas = getBridgeAtlas(42);
    const cols = 25, rows = 16;
    const tile = { x: 16, y: 4 };
    const viaLocation = getWorldforgeLocalForLocation(42, tile.x, tile.y, cols, rows).anchorCellId;
    const viaShared = legacyGridToLandAtlasCell(atlas, tile, { cols, rows });
    expect(viaLocation).toBe(viaShared);
    expect(legacyTileToAtlasCell(atlas, tile.x, tile.y, cols, rows)).toBe(viaShared);
    expect(atlas.pack.cells.h[viaLocation]).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/cellEntry.test.ts`
Expected: FAIL — `getWorldforgeLocalForCell is not exported`.

- [ ] **Step 3: Refactor `legacyTileToAtlasCell` to delegate**

In `src/systems/worldforge/bridge/legacySubmapBridge.ts`, add the import near the top (after the existing imports):

```ts
import { legacyGridToLandAtlasCell } from '../local/gridAtlasBridge';
```

Replace the body of `legacyTileToAtlasCell` (the function at lines 146-173) with a delegation that preserves the "nearest land cell to the tile-center point" behavior:

```ts
export function legacyTileToAtlasCell(
  atlas: FmgAtlasResult,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): number {
  const best = legacyGridToLandAtlasCell(
    atlas,
    { x: worldMapX, y: worldMapY },
    { cols: worldMapWidth, rows: worldMapHeight },
  );
  if (best < 0) throw new Error('Bridge: atlas has no land cells');
  return best;
}
```

> Note: `legacyGridToLandAtlasCell` uses `atlas.graphWidth` (= `FMG_WIDTH` = 960 for the bridge atlas), so this is behavior-identical to the old inline `FMG_WIDTH` projection. Confirm the type of `atlas` parameter matches — if the signature uses `FmgWorldResult`, keep it; `FmgWorldResult` carries `graphWidth`/`graphHeight`/`pack`.

- [ ] **Step 4: Extract `getWorldforgeLocalForCell`**

In the same file, replace `getWorldforgeLocalForLocation` (lines 188-227) with the split below:

```ts
/**
 * Cell-first bridge entrypoint: deterministic L2 LocalArtifact anchored on an
 * EXACT atlas cell. This is the authoritative 3D-entry path — the clicked cell
 * is honored without a lossy tile round-trip. Same inputs → byte-identical
 * terrain, every call, every session.
 */
export function getWorldforgeLocalForCell(
  worldSeed: number,
  anchorCellId: number,
): BridgeLocalResult {
  const atlas = getBridgeAtlas(worldSeed);

  const regionKey = `${worldforgeSeedString(worldSeed)}/cell:${anchorCellId}`;
  let region = regionCache.get(regionKey);
  if (!region) {
    region = generateRegion(atlas, anchorCellId, rootSeedPath(worldSeed), {
      feetPerPixel: FEET_PER_FMG_PIXEL,
      resolutionFt: 100,
      world: atlas,
    });
    regionCache.set(regionKey, region);
  }

  const biomeId = Number(
    (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[anchorCellId] ?? 6,
  );

  const center = {
    x: region.bounds.x + region.bounds.width / 2,
    y: region.bounds.y + region.bounds.height / 2,
  };
  const localKey = `${regionKey}/local:${Math.round(center.x)}-${Math.round(center.y)}`;
  let local = localCache.get(localKey);
  if (!local) {
    local = generateLocal(region, center, region.seedPath, { biomeId });
    localCache.set(localKey, local);
  }

  return { local, region, anchorCellId, biomeId };
}

/**
 * Tile-based bridge entrypoint (party-location / dev-override / WF_TOWN entries
 * that have no clicked cell). Resolves the tile to its anchoring atlas LAND
 * cell via the shared land-aware reverse mapping, then delegates.
 */
export function getWorldforgeLocalForLocation(
  worldSeed: number,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): BridgeLocalResult {
  const atlas = getBridgeAtlas(worldSeed);
  const anchorCellId = legacyTileToAtlasCell(
    atlas, worldMapX, worldMapY, worldMapWidth, worldMapHeight,
  );
  return getWorldforgeLocalForCell(worldSeed, anchorCellId);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/systems/worldforge/bridge/__tests__/cellEntry.test.ts src/systems/worldforge/bridge/__tests__/townTiles.test.ts`
Expected: PASS — new cell-entry tests pass AND the existing `townTiles` tests still pass (proving the delegation preserved behavior).

- [ ] **Step 6: Verification checkpoint (no commit)**

Run: `npm run typecheck`
Expected: no new type errors.

---

## Task 3: `entry3DAnchorCell` GameState field + action

**Files:**
- Modify: `src/types/state.ts:408`
- Modify: `src/state/actionTypes.ts:362-365`
- Modify: `src/state/appState.ts:903-907`
- Modify: `src/state/initialState.ts:333`
- Modify: `src/utils/core/factories.ts:620,772`
- Test: `src/state/__tests__/entry3DAnchorCell.test.ts`

- [ ] **Step 1: Write the failing reducer test**

Create `src/state/__tests__/entry3DAnchorCell.test.ts`:

```ts
/**
 * @file entry3DAnchorCell.test.ts
 * The exact atlas cell clicked for 3D entry rides on GameState so World3DWrapper
 * can anchor on it without a lossy tile round-trip.
 */
import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase, GameState } from '../../types';
import { createMockPlayerCharacter } from '../../utils/factories';

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    party: [createMockPlayerCharacter()],
    phase: GamePhase.PLAYING,
    entry3DAnchorCell: null,
    ...overrides,
  }) as unknown as GameState;

describe('entry3DAnchorCell', () => {
  it('SET_ENTRY_3D_ANCHOR_CELL stores the cell id', () => {
    const next = appReducer(makeState(), { type: 'SET_ENTRY_3D_ANCHOR_CELL', payload: 1234 });
    expect(next.entry3DAnchorCell).toBe(1234);
  });

  it('SET_ENTRY_3D_ANCHOR_CELL with null clears it', () => {
    const next = appReducer(
      makeState({ entry3DAnchorCell: 1234 }),
      { type: 'SET_ENTRY_3D_ANCHOR_CELL', payload: null },
    );
    expect(next.entry3DAnchorCell).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/__tests__/entry3DAnchorCell.test.ts`
Expected: FAIL — action type not assignable / reducer returns unchanged state.

- [ ] **Step 3: Add the type field**

In `src/types/state.ts`, after line 408 (`playerWorldPos: PlayerWorldPosition | null;`) add:

```ts
  /** Exact Worldforge atlas cell to anchor the next 3D entry on (null when not entering by click). */
  entry3DAnchorCell: number | null;
```

- [ ] **Step 4: Add the action type**

In `src/state/actionTypes.ts`, after line 364 (`| { type: 'SET_WORLD_VIEW_MODE'; payload: WorldViewMode }`) add:

```ts
  | { type: 'SET_ENTRY_3D_ANCHOR_CELL'; payload: number | null }
```

- [ ] **Step 5: Add the reducer case**

In `src/state/appState.ts`, after the `CLEAR_PLAYER_WORLD_POS` case (line 906-907) add:

```ts
        case 'SET_ENTRY_3D_ANCHOR_CELL':
            return { ...state, entry3DAnchorCell: action.payload };
```

- [ ] **Step 6: Add the defaults in all three state factories**

In `src/state/initialState.ts`, after line 333 (`playerWorldPos: null,`) add:

```ts
    entry3DAnchorCell: null,
```

In `src/utils/core/factories.ts`, add `entry3DAnchorCell: null,` immediately after BOTH `playerWorldPos: null,` lines (at lines 620 and 772).

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/state/__tests__/entry3DAnchorCell.test.ts`
Expected: PASS.

- [ ] **Step 8: Verification checkpoint (no commit)**

Run: `npm run typecheck`
Expected: no errors (all GameState constructors now supply the field).

---

## Task 4: MapPane — pass the exact anchor cell, drop the burg-snap hack

**Files:**
- Modify: `src/components/MapPane.tsx:58, 538-603`

This task changes the click handler so `onEnter3DAtCell` receives the authoritative atlas cell id. The `onEnter3DAtCell` prop signature gains a 4th argument.

- [ ] **Step 1: Extend the import**

In `src/components/MapPane.tsx` line 58, add `snapToLandCell` and `atlasCellToLegacyGrid` to the existing import from `gridAtlasBridge`:

```ts
import { legacyGridToAtlasCell, gridCellToAtlasSite, spreadColocatedPoints, snapToLandCell, atlasCellToLegacyGrid } from '@/systems/worldforge/local/gridAtlasBridge';
```

- [ ] **Step 2: Extend the `onEnter3DAtCell` prop type**

In `src/components/MapPane.tsx` line 75, change:

```ts
  onEnter3DAtCell?: (x: number, y: number, tile: MapTileType) => void;
```
to:
```ts
  onEnter3DAtCell?: (x: number, y: number, tile: MapTileType, anchorCellId: number) => void;
```

- [ ] **Step 3: Rewrite the enter3d branch of `handleWorldforgePick`**

In `src/components/MapPane.tsx`, replace the enter3d block (lines 545-568) with the cell-authoritative version below. It land-snaps the clicked cell once, derives the bookkeeping tile from the shared forward function, and drops the `getTownTilesForGrid` burg-snap hack entirely:

```ts
    if (interactionMode === 'enter3d' && allow3DEntry && onEnter3DAtCell) {
      // The clicked cell is the anchor authority. Land-snap it once (water → nearest
      // land, so 3D always opens on walkable ground), then derive the legacy grid
      // tile from that exact cell via the shared forward mapping. No proportional
      // re-projection, no burg-snap hack: getWorldforgeLocalForCell honors the cell
      // and the ground-world spawn logic already lands the player on its town.
      const anchorCellId = snapToLandCell(worldforgeAtlas, info.i);
      const gridTile = atlasCellToLegacyGrid(
        worldforgeAtlas, anchorCellId, { cols: gridSize.cols, rows: gridSize.rows },
      ) ?? { x: tx, y: ty };
      const tile = projectedTiles[gridTile.y]?.[gridTile.x];
      if (!tile) return;
      onEnter3DAtCell(gridTile.x, gridTile.y, tile, anchorCellId);
      return;
    }
```

- [ ] **Step 4: Update `handleEnter3DHere` (drill leaf) to pass the focus cell**

In `src/components/MapPane.tsx`, replace `handleEnter3DHere` (lines 593-603) with a version that passes the real focus cell as the anchor:

```ts
  const handleEnter3DHere = useCallback(() => {
    if (!worldforgeAtlas || !onEnter3DAtCell) return;
    const cellId = submapStack[0]?.neighbourhood?.focusCellId;
    if (cellId == null) return;
    const anchorCellId = snapToLandCell(worldforgeAtlas, cellId);
    const gridTile = atlasCellToLegacyGrid(
      worldforgeAtlas, anchorCellId, { cols: gridSize.cols, rows: gridSize.rows },
    );
    if (!gridTile) return;
    const tile = projectedTiles[gridTile.y]?.[gridTile.x];
    if (tile) onEnter3DAtCell(gridTile.x, gridTile.y, tile, anchorCellId);
  }, [worldforgeAtlas, onEnter3DAtCell, submapStack, gridSize.cols, gridSize.rows, projectedTiles]);
```

- [ ] **Step 5: Remove the now-unused `getTownTilesForGrid` import if MapPane no longer references it**

Run: `npx vitest run` is not needed here. Instead grep:
Run: `grep -n "getTownTilesForGrid" src/components/MapPane.tsx`
Expected: no remaining references. If any remain (other than the deleted block), leave the import; otherwise remove the `getTownTilesForGrid` import line to avoid an unused-import lint error.

- [ ] **Step 6: Verification checkpoint (no commit)**

Run: `npm run typecheck && npx eslint src/components/MapPane.tsx`
Expected: no type errors; no unused-import errors.

---

## Task 5: App — dispatch the anchor cell; clear it on 3D exit

**Files:**
- Modify: `src/App.tsx:761-790, 1468`
- Modify: `src/hooks/useWorldViewMode.ts:59-61`

- [ ] **Step 1: Accept and dispatch the anchor cell in `handleEnter3DAtCell`**

In `src/App.tsx`, change the signature on line 761 to accept the anchor cell and dispatch it. Replace lines 761 and the dispatch block (781-785):

```ts
  const handleEnter3DAtCell = useCallback((x: number, y: number, tile: MapTile, anchorCellId?: number) => {
```

Then, immediately after the existing `SET_PLAYER_WORLD_POS` dispatch (lines 781-784), add:

```ts
    dispatch({ type: 'SET_ENTRY_3D_ANCHOR_CELL', payload: anchorCellId ?? null });
```

- [ ] **Step 2: Verify the prop wiring already matches**

Run: `grep -n "onEnter3DAtCell={handleEnter3DAtCell}" src/App.tsx`
Expected: line ~1468 unchanged — the handler reference is passed straight through, and the widened signature is compatible.

- [ ] **Step 3: Clear the anchor cell when leaving 3D**

In `src/hooks/useWorldViewMode.ts`, find where `CLEAR_PLAYER_WORLD_POS` is dispatched on exit (line 60). Add a sibling dispatch right after it:

```ts
    dispatch({ type: 'CLEAR_PLAYER_WORLD_POS' });
    dispatch({ type: 'SET_ENTRY_3D_ANCHOR_CELL', payload: null });
```

> If `useWorldViewMode.ts` line 60 sits inside a non-3D-exit path, instead place the clear in the same callback that performs the atlas-return (the one calling `CLEAR_PLAYER_WORLD_POS`). The contract: whenever `playerWorldPos` is cleared on returning to the atlas, `entry3DAnchorCell` is cleared too.

- [ ] **Step 4: Verification checkpoint (no commit)**

Run: `npm run typecheck`
Expected: no errors. Also confirm `GameModals` passes the prop through unchanged:
Run: `grep -n "onEnter3DAtCell" src/components/layout/GameModals.tsx`
Expected: type on line ~99 is structurally compatible; if TypeScript flags the narrower `(x,y,tile)` type, widen the `GameModals` prop type to `(x: number, y: number, tile: MapTile, anchorCellId: number) => void` to match MapPane.

---

## Task 6: World3DWrapper — anchor on the exact cell when present

**Files:**
- Modify: `src/components/World3D/World3DWrapper.tsx:214-251`

- [ ] **Step 1: Read the anchor cell from state and branch the bridge call**

In `src/components/World3D/World3DWrapper.tsx`, inside the async ground-entry block, after the dynamic imports resolve (after line 218) and after `wfSeed`/`rows`/`cols` are computed (line 222-224), add the anchor read:

```ts
        const anchorCellId = (state as { entry3DAnchorCell?: number | null }).entry3DAnchorCell ?? null;
```

Then replace the bridge resolution (lines 248-251) so an explicit anchor cell takes the exact path, and `coords` (still needed for bookkeeping/spawn-matching) is derived from that cell:

```ts
        let bridged: ReturnType<typeof bridge.getWorldforgeLocalForLocation> | null = null;
        if (anchorCellId != null && wfSeed != null) {
          // EXACT cell-first entry (atlas/drill click). Honor the clicked cell;
          // derive the legacy tile only for bookkeeping (currentLocation, saved
          // ground-pos matching) via the shared forward mapping.
          bridged = bridge.getWorldforgeLocalForCell(wfSeed, anchorCellId);
          const atlas = bridge.getBridgeAtlas(wfSeed);
          coords = adapterAtlasCellToTile(atlas, anchorCellId, cols, rows) ?? coords;
        } else if (coords && wfSeed != null) {
          bridged = bridge.getWorldforgeLocalForLocation(
            wfSeed, coords.x, coords.y, cols, rows,
          );
        }
        if (bridged && coords && wfSeed != null) {
```

> The original `if (coords && wfSeed != null) {` opening brace on line 248 is now replaced by the `if (bridged && coords ...)` line above. Ensure the matching closing brace at the end of that block is preserved (no change to its position).

- [ ] **Step 2: Import the shared forward mapping**

At the top of `src/components/World3D/World3DWrapper.tsx`, add a static import (the file already statically imports React/config; the FMG-stack bridge stays dynamic, but `atlasCellToLegacyGrid` is a tiny pure function safe to import statically):

```ts
import { atlasCellToLegacyGrid as adapterAtlasCellToTile } from '../../systems/worldforge/local/gridAtlasBridge';
```

> Aliased to `adapterAtlasCellToTile` to avoid any name collision and signal intent (cell → bookkeeping tile). It takes `(atlas, cellId, { cols, rows })` and returns `{ x, y } | null`. Adjust the call in Step 1 to pass `{ cols, rows }`:
> `adapterAtlasCellToTile(atlas, anchorCellId, { cols, rows })`.

(Correct the Step 1 call accordingly: `coords = adapterAtlasCellToTile(atlas, anchorCellId, { cols, rows }) ?? coords;`)

- [ ] **Step 3: Confirm the effect dependency list includes the anchor**

Find the dependency array of the `useEffect`/async block that runs this code (search downward for the closing `}, [` of the effect). Add `state.entry3DAnchorCell` to the dependency list if the effect lists individual `state.*` fields; if it depends on the whole `state`, no change needed.

Run: `grep -n "entry3DAnchorCell\|playerWorldPos" src/components/World3D/World3DWrapper.tsx`
Expected: the anchor read is present; verify the surrounding effect re-runs when it changes.

- [ ] **Step 4: Verification checkpoint (no commit)**

Run: `npm run typecheck`
Expected: no errors.

---

## Task 7: Full verification + visual inspection

**Files:** none (verification only)

- [ ] **Step 1: Run the full affected test set**

Run:
```bash
npx vitest run src/systems/worldforge/local/__tests__/gridAtlasBridge.test.ts \
  src/systems/worldforge/bridge/__tests__/cellEntry.test.ts \
  src/systems/worldforge/bridge/__tests__/townTiles.test.ts \
  src/state/__tests__/entry3DAnchorCell.test.ts \
  src/state/__tests__/worldViewModeLegacy3d.test.ts
```
Expected: all PASS.

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npm run typecheck && npm run lint`
Expected: no new errors introduced by this change.

- [ ] **Step 3: Visual inspection (Remy's standing rule — render and eyeball, goldens are not enough)**

Start the dev server and verify the end-to-end behavior in the browser:
1. `preview_start` the app, load a game into the World Map (atlas) view.
2. In **Enter-3D** mode, click a **burg cell** → confirm the player spawns ON the town (walls/buildings around them), not in adjacent wilderness.
3. Click a **non-burg inland land cell** → confirm 3D opens on that cell's terrain (not a neighbour). Cross-check by reading the `[wf]`/entry console line if present, or by comparing the 2D drill terrain of that cell to the 3D ground.
4. Click a **coastal/water-adjacent cell** → confirm it snaps to land and opens on ground (no ocean spawn).
5. Exit to atlas, re-enter a different cell → confirm the new cell is honored (anchor cleared on exit).

Capture a screenshot of cases 2 and 3 to `.agent/scratch/` (gitignored) as proof.

- [ ] **Step 4: Update memory**

Update the `worldforge-canonical-town` / coordinate-bridge memory notes to record that the click→3D bridge is now cell-authoritative (the `entry3DAnchorCell` transport), the burg-snap hack is removed, and `gridAtlasBridge.ts` is the single grid↔atlas mapping module with `snapToLandCell` / `legacyGridToLandAtlasCell`.

---

## Self-Review Notes

- **Spec coverage:** Task 1 (snapToLandCell + land-aware reverse) ✓; Task 2 (cell-first entrypoint + delegation, kills the forked land rule) ✓; Task 3 (entry3DAnchorCell transport) ✓; Task 4 (MapPane exact anchor + drop burg-snap + dedupe inline projection) ✓; Task 5 (App dispatch + clear on exit) ✓; Task 6 (World3DWrapper exact branch) ✓; Testing section ✓.
- **Type consistency:** `getWorldforgeLocalForCell(worldSeed, anchorCellId)`, `snapToLandCell(atlas, cellId)`, `legacyGridToLandAtlasCell(atlas, cell, gridSize)`, `atlasCellToLegacyGrid(atlas, cellId, gridSize)`, `onEnter3DAtCell(x, y, tile, anchorCellId)`, action `SET_ENTRY_3D_ANCHOR_CELL` payload `number | null`, field `entry3DAnchorCell: number | null` — used consistently across tasks.
- **Known verification dependency:** Task 6 assumes the bridge atlas exposes `graphWidth === FMG_WIDTH (960)` so `atlasCellToLegacyGrid` matches the bridge's projection convention — confirmed against `generateAtlas.ts:196` / bridge `FMG_WIDTH = 960`.
