# Next-gen combat map — deliverable 1: Pixi visual prototype — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PixiJS v8 (WebGPU-first) board behind `?pixiboard=1` that renders one real battlefield — painted ground + combatant tokens + soft fog — with pan/zoom that stays crisp, ending at Remy's eyeball gate.

**Architecture:** The existing DOM board stays the default and is untouched in behavior. Two pieces of its rendering (ground painting, fog raster) are extracted into shared pure modules so the Pixi board shows the *same approved art* on the new engine. A new `PixiBattleBoard` component builds the layered Pixi scene; a thin harness swaps it in for the center board pane when the URL has `?pixiboard=1`. No interaction (clicks/targeting) in this deliverable — it is a look prototype.

**Tech Stack:** React 19, TypeScript, PixiJS 8.14.3 (already installed; `vendor-pixi` chunk already in `vite.config.ts`), Vitest 4 (jsdom), Playwright headless for proof shots.

## Global Constraints

- **NO git commits.** Work only in master, leave everything uncommitted — a 2am snapshot commits daily. Every "commit" step in the usual template is replaced by a verification step.
- **Agora locks:** before modifying `src/components/Combat/CombatView.tsx`, run `curl -s http://localhost:4319/locks` — if it is held by another agent, coordinate via the `agora-coordination` skill instead of editing.
- **Do not change combat mechanics:** no edits to the combat engine, `types/combat.ts`, hooks, or reducers.
- **Existing BattleMap suites must stay green:** `npx vitest run src/components/BattleMap` (55+ tests). The extraction tasks refactor `BattleMapGroundCanvas.tsx` / `BattleMapFogCanvas.tsx` internals without changing their props or rendered output.
- **Touched files must be tsc-clean.** Repo-wide pre-existing errors are background noise (memory `known-preexisting-issues`); check only files this plan touches: `npx tsc --noEmit 2>&1 | grep -E "groundPainter|fogModel|cameraMath|tokenViewModel|PixiBattleBoard|PixiBoardPrototype|BattleMapGroundCanvas|BattleMapFogCanvas|CombatView"` must print nothing.
- **jsdom cannot run Pixi or canvas 2D.** Unit tests cover only the pure modules (tasks 1–4). The Pixi component itself is verified by typecheck + headless screenshots (task 7).
- **Plain English, US spelling** in all comments and docs.
- The prototype board is display-only. The default (no flag) path must behave exactly as today at every task boundary.

---

### Task 1: Extract the ground painter into a shared module

The Pixi board must show the same approved painted ground. Extract the drawing code from `BattleMapGroundCanvas.tsx` into a module both renderers call.

**Files:**
- Create: `src/components/BattleMap/groundPainter.ts`
- Modify: `src/components/BattleMap/BattleMapGroundCanvas.tsx`
- Test: `src/components/BattleMap/__tests__/groundPainter.test.ts`

**Interfaces:**
- Consumes: `BattleMapData` from `src/types/combat`.
- Produces (used by Task 5):
  - `type Ground = 'grass' | 'dirt' | 'water' | 'stone' | 'sand'`
  - `terrainToGround(terrain: string): Ground`
  - `type GroundTextures = { grass: HTMLImageElement | null; dirt: HTMLImageElement | null }`
  - `loadGroundTextures(): Promise<GroundTextures>` (module-level decode cache preserved)
  - `paintGround(ctx: CanvasRenderingContext2D, mapData: BattleMapData, tileSize: number, textures: GroundTextures, res: number): void` — assumes the caller has sized the canvas to `(W*tileSize*res, H*tileSize*res)` and set `ctx.setTransform(res,0,0,res,0,0)`; draws the complete ground (grass base, patches, road, water sheet + feather + banks, per-cell overpaint, foliage, vignette, dapples, time-of-day tint).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/BattleMap/__tests__/groundPainter.test.ts
import { describe, it, expect } from 'vitest';
import { terrainToGround } from '../groundPainter';

describe('terrainToGround', () => {
  it('maps every mechanical terrain to a paint ground', () => {
    expect(terrainToGround('grass')).toBe('grass');
    expect(terrainToGround('mud')).toBe('grass');
    expect(terrainToGround('difficult')).toBe('grass');
    expect(terrainToGround('water')).toBe('water');
    expect(terrainToGround('wall')).toBe('stone');
    expect(terrainToGround('rock')).toBe('dirt');
    expect(terrainToGround('stone')).toBe('dirt');
    expect(terrainToGround('floor')).toBe('dirt');
    expect(terrainToGround('sand')).toBe('sand');
  });
  it('defaults unknown terrain to grass', () => {
    expect(terrainToGround('???')).toBe('grass');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BattleMap/__tests__/groundPainter.test.ts`
Expected: FAIL — `Cannot find module '../groundPainter'`

- [ ] **Step 3: Create the module by moving code**

Create `src/components/BattleMap/groundPainter.ts`. Move VERBATIM from `BattleMapGroundCanvas.tsx`: the `rand` helper, the `Ground` type, `terrainToGround`, the `imageCache`/`loadImage` pair, `GRASS_SRC`/`DIRT_SRC`, and `drawTree`/`drawBush`/`drawLog`/`drawRock`. Then move the body of the component's inner `draw(grass, dirt)` closure into the exported `paintGround`, with these mechanical substitutions only:

```typescript
// New exports and the paint entry point (moved code elided where identical):
export type Ground = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';
export const terrainToGround = (terrain: string): Ground => { /* moved verbatim */ };

export interface GroundTextures {
  grass: HTMLImageElement | null;
  dirt: HTMLImageElement | null;
}

export const loadGroundTextures = async (): Promise<GroundTextures> => {
  const [grass, dirt] = await Promise.all([loadImage(GRASS_SRC), loadImage(DIRT_SRC)]);
  return { grass, dirt };
};

export function paintGround(
  ctx: CanvasRenderingContext2D,
  mapData: BattleMapData,
  tileSize: number,
  textures: GroundTextures,
  res: number,
): void {
  const { grass, dirt } = textures;
  const W = mapData.dimensions.width;
  const H = mapData.dimensions.height;
  const px = W * tileSize;
  const py = H * tileSize;
  // ...entire body of the old draw() closure, verbatim, with:
  //   - `cancelled` checks removed (the caller owns lifecycle),
  //   - the water layer sized from the passed res:
  //       waterCanvas.width = Math.round(px * res);
  //       waterCanvas.height = Math.round(py * res);
  //       wctx.setTransform(res, 0, 0, res, 0, 0);
  //   - the final blur composite unchanged: ctx.drawImage(waterCanvas, 0, 0, px, py)
}
```

- [ ] **Step 4: Refactor BattleMapGroundCanvas to consume it**

Replace everything above the component in `BattleMapGroundCanvas.tsx` with imports, and the effect body becomes sizing + one call:

```typescript
import { loadGroundTextures, paintGround } from './groundPainter';
// inside useEffect, after computing res exactly as today (dpr/budget logic stays here):
loadGroundTextures().then((textures) => {
  if (cancelled) return;
  paintGround(ctx, mapData, tileSize, textures, res);
});
```

Props, the `res` computation (dpr × 2 supersample, 24M pixel budget), canvas sizing, and `imageSmoothingQuality` stay in the component unchanged.

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run src/components/BattleMap/__tests__/groundPainter.test.ts` — Expected: PASS
Run: `npx vitest run src/components/BattleMap` — Expected: all suites PASS (rendered output unchanged)
Run the tsc grep from Global Constraints — Expected: no output.

---

### Task 2: Extract the fog model into a shared module

**Files:**
- Create: `src/components/BattleMap/fogModel.ts`
- Modify: `src/components/BattleMap/BattleMapFogCanvas.tsx`
- Test: `src/components/BattleMap/__tests__/fogModel.test.ts`

**Interfaces:**
- Consumes: `BattleMapData`, `LightLevel` from `src/types/combat`.
- Produces (used by Task 5):
  - `fogAlpha(visible: boolean, light: LightLevel): number`
  - `FOG_TINT = { r: 4, g: 8, b: 14 }` (the rgba(4,8,14,…) fog color as data)
  - `buildFogAlphaGrid(mapData: BattleMapData, visibleTiles: Set<string>, getLightLevel: (tileId: string) => LightLevel): { width: number; height: number; alphas: Float32Array }` — row-major `alphas[y * width + x]`, 0 where fully lit.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/BattleMap/__tests__/fogModel.test.ts
import { describe, it, expect } from 'vitest';
import { fogAlpha, buildFogAlphaGrid } from '../fogModel';
import type { BattleMapData } from '../../../types/combat';

describe('fogAlpha', () => {
  it('grades darkness from unseen to bright', () => {
    expect(fogAlpha(false, 'bright')).toBe(0.6);
    expect(fogAlpha(true, 'magical_darkness')).toBe(0.5);
    expect(fogAlpha(true, 'darkness')).toBe(0.3);
    expect(fogAlpha(true, 'dim')).toBe(0.16);
    expect(fogAlpha(true, 'bright')).toBe(0);
  });
});

describe('buildFogAlphaGrid', () => {
  const tile = (x: number, y: number) => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
  });
  const mapData = {
    dimensions: { width: 2, height: 1 },
    tiles: new Map([
      ['0-0', tile(0, 0)],
      ['1-0', tile(1, 0)],
    ]),
  } as unknown as BattleMapData;

  it('fills row-major alphas from visibility and light', () => {
    const grid = buildFogAlphaGrid(mapData, new Set(['0-0']), (id) => (id === '0-0' ? 'bright' : 'darkness'));
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(1);
    expect(grid.alphas[0]).toBe(0);    // visible + bright
    expect(grid.alphas[1]).toBe(0.6);  // not visible
  });
});
```

Note: `mapData.tiles` is iterated with `.forEach`, which works for both `Map` and array — match whichever `BattleMapFogCanvas` compiles against (it calls `mapData.tiles.forEach(tile => …)` today; the Map above satisfies that).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BattleMap/__tests__/fogModel.test.ts`
Expected: FAIL — `Cannot find module '../fogModel'`

- [ ] **Step 3: Create the module**

```typescript
// src/components/BattleMap/fogModel.ts
import type { BattleMapData, LightLevel } from '../../types/combat';

/** How dark a tile paints: 0 = fully lit, up to 0.6 = unseen. */
export const fogAlpha = (visible: boolean, light: LightLevel): number => {
  if (!visible) return 0.6;
  switch (light) {
    case 'magical_darkness': return 0.5;
    case 'darkness': return 0.3;
    case 'dim': return 0.16;
    default: return 0;
  }
};

/** The fog ink color, as data so both renderers use the same night-blue. */
export const FOG_TINT = { r: 4, g: 8, b: 14 } as const;

export interface FogAlphaGrid {
  width: number;
  height: number;
  /** Row-major: alphas[y * width + x]. */
  alphas: Float32Array;
}

export const buildFogAlphaGrid = (
  mapData: BattleMapData,
  visibleTiles: Set<string>,
  getLightLevel: (tileId: string) => LightLevel,
): FogAlphaGrid => {
  const width = mapData.dimensions.width;
  const height = mapData.dimensions.height;
  const alphas = new Float32Array(width * height);
  mapData.tiles.forEach((tile) => {
    alphas[tile.coordinates.y * width + tile.coordinates.x] = fogAlpha(
      visibleTiles.has(tile.id),
      getLightLevel(tile.id),
    );
  });
  return { width, height, alphas };
};
```

- [ ] **Step 4: Refactor BattleMapFogCanvas to consume it**

In `BattleMapFogCanvas.tsx`, delete the local `fogAlpha`, import from `./fogModel`, and build the 1px/tile mini canvas from the grid:

```typescript
import { buildFogAlphaGrid, FOG_TINT } from './fogModel';
// inside useEffect, replacing the mapData.tiles.forEach mini-paint loop:
const grid = buildFogAlphaGrid(mapData, visibleTiles, getLightLevel);
for (let y = 0; y < grid.height; y++) {
  for (let x = 0; x < grid.width; x++) {
    const alpha = grid.alphas[y * grid.width + x];
    if (alpha <= 0) continue;
    mctx.fillStyle = `rgba(${FOG_TINT.r},${FOG_TINT.g},${FOG_TINT.b},${alpha})`;
    mctx.fillRect(x, y, 1, 1);
  }
}
```

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run src/components/BattleMap/__tests__/fogModel.test.ts` — Expected: PASS
Run: `npx vitest run src/components/BattleMap` — Expected: all suites PASS
Run the tsc grep — Expected: no output.

---

### Task 3: Camera math (pure)

Pan/zoom math for the Pixi board, written as pure functions so the anchored-zoom behavior is tested without a browser.

**Files:**
- Create: `src/components/BattleMap/pixi/cameraMath.ts`
- Test: `src/components/BattleMap/pixi/__tests__/cameraMath.test.ts`

**Interfaces:**
- Produces (used by Task 5):
  - `interface CameraView { x: number; y: number; zoom: number }` — `x,y` = world-space coordinate at the viewport's top-left; `zoom` = world→screen scale.
  - `clampZoom(z: number): number` — clamps to [0.15, 4].
  - `zoomAtCursor(view: CameraView, factor: number, cursor: { x: number; y: number }): CameraView` — zooms keeping the world point under `cursor` (viewport px) stationary.
  - `panBy(view: CameraView, dx: number, dy: number): CameraView` — drag by viewport px.
  - `fitView(mapPxW: number, mapPxH: number, viewportW: number, viewportH: number): CameraView` — whole board centered.
  - `groundResolutionFor(zoom: number, dpr: number, mapPxW: number, mapPxH: number): number` — rasterization density for the ground plate: `min(max(dpr, 1) * max(1, zoom) * 2, 4, sqrt(48_000_000 / (mapPxW * mapPxH)))`, floored at 1. (Same pixel-budget idea as the DOM board, doubled budget because chunk culling comes later; deliverable 1 rasters one plate.)

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/BattleMap/pixi/__tests__/cameraMath.test.ts
import { describe, it, expect } from 'vitest';
import { clampZoom, zoomAtCursor, panBy, fitView, groundResolutionFor } from '../cameraMath';

describe('clampZoom', () => {
  it('bounds zoom to [0.15, 4]', () => {
    expect(clampZoom(0.01)).toBe(0.15);
    expect(clampZoom(99)).toBe(4);
    expect(clampZoom(1)).toBe(1);
  });
});

describe('zoomAtCursor', () => {
  it('keeps the world point under the cursor stationary', () => {
    const view = { x: 100, y: 50, zoom: 1 };
    const cursor = { x: 200, y: 100 };
    // World point under cursor before: (100 + 200/1, 50 + 100/1) = (300, 150)
    const next = zoomAtCursor(view, 2, cursor);
    expect(next.zoom).toBe(2);
    // Same world point must still sit at cursor: x + 200/2 === 300
    expect(next.x + cursor.x / next.zoom).toBeCloseTo(300);
    expect(next.y + cursor.y / next.zoom).toBeCloseTo(150);
  });
  it('clamps the resulting zoom', () => {
    expect(zoomAtCursor({ x: 0, y: 0, zoom: 3.9 }, 10, { x: 0, y: 0 }).zoom).toBe(4);
  });
});

describe('panBy', () => {
  it('converts viewport pixels to world units at current zoom', () => {
    const next = panBy({ x: 10, y: 10, zoom: 2 }, -30, 8);
    expect(next.x).toBeCloseTo(25);  // 10 - (-30)/2
    expect(next.y).toBeCloseTo(6);   // 10 - 8/2
  });
});

describe('fitView', () => {
  it('centers a small map in a large viewport at zoom ≤ its fit scale', () => {
    const v = fitView(1000, 500, 2000, 2000);
    expect(v.zoom).toBeCloseTo(2000 / 1000 > 2000 / 500 ? 2000 / 500 : 2000 / 1000);
    // Centered: world x at viewport center equals map center.
    expect(v.x + 1000 / v.zoom).toBeCloseTo(500 + 1000 / v.zoom / 2 + (500 - 1000 / v.zoom / 2)); // sanity, refined below
  });
  it('centers exactly', () => {
    const v = fitView(1000, 500, 2000, 1000);
    // fit zoom = min(2000/1000, 1000/500) = 2
    expect(v.zoom).toBe(2);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
  });
});

describe('groundResolutionFor', () => {
  it('never drops below 1', () => {
    expect(groundResolutionFor(0.2, 1, 100_000, 100_000)).toBe(1);
  });
  it('rises with zoom and caps at 4', () => {
    const lo = groundResolutionFor(1, 1, 1000, 1000);
    const hi = groundResolutionFor(3, 1, 1000, 1000);
    expect(hi).toBeGreaterThan(lo);
    expect(groundResolutionFor(10, 3, 100, 100)).toBe(4);
  });
});
```

(In the first `fitView` test, delete the sanity line and keep only the exact-centering test if it reads confused — the second test is the real assertion.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BattleMap/pixi/__tests__/cameraMath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/components/BattleMap/pixi/cameraMath.ts
/** Camera state for the Pixi board: x,y = world coordinate at the viewport's
 *  top-left corner; zoom = world→screen scale factor. Pure math only. */
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export const clampZoom = (z: number): number => Math.min(4, Math.max(0.15, z));

export const zoomAtCursor = (
  view: CameraView,
  factor: number,
  cursor: { x: number; y: number },
): CameraView => {
  const zoom = clampZoom(view.zoom * factor);
  // World point under the cursor must not move:
  //   view.x + cursor.x / view.zoom === next.x + cursor.x / zoom
  return {
    zoom,
    x: view.x + cursor.x / view.zoom - cursor.x / zoom,
    y: view.y + cursor.y / view.zoom - cursor.y / zoom,
  };
};

export const panBy = (view: CameraView, dx: number, dy: number): CameraView => ({
  ...view,
  x: view.x - dx / view.zoom,
  y: view.y - dy / view.zoom,
});

export const fitView = (
  mapPxW: number,
  mapPxH: number,
  viewportW: number,
  viewportH: number,
): CameraView => {
  const zoom = clampZoom(Math.min(viewportW / mapPxW, viewportH / mapPxH));
  return {
    zoom,
    x: (mapPxW - viewportW / zoom) / 2,
    y: (mapPxH - viewportH / zoom) / 2,
  };
};

/** Rasterization density for the ground plate at a given zoom: enough source
 *  pixels that the current zoom shows real detail, capped by a pixel budget
 *  (one plate for the prototype; chunking arrives with the full renderer). */
export const groundResolutionFor = (
  zoom: number,
  dpr: number,
  mapPxW: number,
  mapPxH: number,
): number => {
  const budget = Math.sqrt(48_000_000 / Math.max(1, mapPxW * mapPxH));
  return Math.max(1, Math.min(Math.max(dpr, 1) * Math.max(1, zoom) * 2, 4, budget));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/BattleMap/pixi/__tests__/cameraMath.test.ts` — Expected: PASS. Run the tsc grep — Expected: no output.

---

### Task 4: Token view model (pure)

The Pixi tokens must read exactly like the DOM tokens (bright faction rings, white halo, HP arc colors). Encode those choices as data so both stay in step and the choices are testable.

**Files:**
- Create: `src/components/BattleMap/pixi/tokenViewModel.ts`
- Test: `src/components/BattleMap/pixi/__tests__/tokenViewModel.test.ts`

**Interfaces:**
- Consumes: `CombatCharacter` from `src/types/combat`; `getCharacterSizeMultiplier` from `src/utils/combatUtils`.
- Produces (used by Task 5):
  - `interface TokenViewModel { ringColor: number; hpPct: number; hpColor: number; label: string; sizeMultiplier: number; isDown: boolean }` (colors as Pixi hex numbers)
  - `buildTokenViewModel(character: CombatCharacter, flags: { isSelected: boolean; isTurn: boolean }): TokenViewModel`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/BattleMap/pixi/__tests__/tokenViewModel.test.ts
import { describe, it, expect } from 'vitest';
import { buildTokenViewModel } from '../tokenViewModel';
import type { CombatCharacter } from '../../../../types/combat';

const char = (over: Partial<CombatCharacter>): CombatCharacter =>
  ({
    id: 'c1',
    name: 'Kaelen Thorne',
    team: 'player',
    currentHP: 20,
    maxHP: 20,
    stats: { size: 'medium' },
    ...over,
  }) as unknown as CombatCharacter;

describe('buildTokenViewModel', () => {
  it('gives players a blue ring and enemies a red ring', () => {
    expect(buildTokenViewModel(char({ team: 'player' }), { isSelected: false, isTurn: false }).ringColor).toBe(0x60a5fa);
    expect(buildTokenViewModel(char({ team: 'enemy' }), { isSelected: false, isTurn: false }).ringColor).toBe(0xef4444);
  });
  it('selection overrides faction with amber', () => {
    expect(buildTokenViewModel(char({}), { isSelected: true, isTurn: false }).ringColor).toBe(0xfbbf24);
  });
  it('grades the HP arc green → amber → red', () => {
    expect(buildTokenViewModel(char({ currentHP: 20 }), { isSelected: false, isTurn: false }).hpColor).toBe(0x34d399);
    expect(buildTokenViewModel(char({ currentHP: 8 }), { isSelected: false, isTurn: false }).hpColor).toBe(0xfbbf24);
    expect(buildTokenViewModel(char({ currentHP: 3 }), { isSelected: false, isTurn: false }).hpColor).toBe(0xf87171);
  });
  it('labels with the first letter of the name and flags the dead', () => {
    const vm = buildTokenViewModel(char({ currentHP: 0 }), { isSelected: false, isTurn: false });
    expect(vm.label).toBe('K');
    expect(vm.isDown).toBe(true);
    expect(vm.hpPct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BattleMap/pixi/__tests__/tokenViewModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/components/BattleMap/pixi/tokenViewModel.ts
import type { CombatCharacter } from '../../../types/combat';
import { getCharacterSizeMultiplier } from '../../../utils/combatUtils';

/** Everything the Pixi token needs to draw, matching CharacterToken.tsx:
 *  blue-400 ally / red-500 hostile rings, amber-400 selection, and the
 *  green→amber→red HP arc. Colors are Pixi hex numbers. */
export interface TokenViewModel {
  ringColor: number;
  hpPct: number;
  hpColor: number;
  label: string;
  sizeMultiplier: number;
  isDown: boolean;
}

export const buildTokenViewModel = (
  character: CombatCharacter,
  flags: { isSelected: boolean; isTurn: boolean },
): TokenViewModel => {
  let ringColor = character.team === 'player' ? 0x60a5fa : 0xef4444;
  if (flags.isSelected) ringColor = 0xfbbf24;
  const hpPct = Math.max(0, Math.min(1, character.maxHP > 0 ? character.currentHP / character.maxHP : 0));
  const hpColor = hpPct > 0.5 ? 0x34d399 : hpPct > 0.25 ? 0xfbbf24 : 0xf87171;
  return {
    ringColor,
    hpPct,
    hpColor,
    label: (character.name?.trim()[0] ?? '?').toUpperCase(),
    sizeMultiplier: getCharacterSizeMultiplier(character.stats.size),
    isDown: character.currentHP <= 0,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/BattleMap/pixi/__tests__/tokenViewModel.test.ts` — Expected: PASS. Run the tsc grep — Expected: no output.

---

### Task 5: The PixiBattleBoard component

The scene itself: ground plate (from Task 1's painter, rasterized into a texture), fog sprite (from Task 2's grid, 1px/tile with linear upscaling — the same feathering trick), token layer (Task 4's view models drawn as Pixi graphics, gliding between tiles), pan/zoom (Task 3's math), and ground re-rasterization when zoom crosses a resolution step.

**Files:**
- Create: `src/components/BattleMap/pixi/PixiBattleBoard.tsx`

**Interfaces:**
- Consumes: `paintGround`, `loadGroundTextures` (Task 1); `buildFogAlphaGrid`, `FOG_TINT` (Task 2); `CameraView`, `zoomAtCursor`, `panBy`, `fitView`, `clampZoom`, `groundResolutionFor` (Task 3); `buildTokenViewModel` (Task 4); `TILE_SIZE_PX` from `src/config/mapConfig`; pixi.js v8 (`Application`, `Container`, `Sprite`, `Graphics`, `Text`, `Texture`).
- Produces (used by Task 6): default export `PixiBattleBoard: React.FC<PixiBattleBoardProps>` with:

```typescript
export interface PixiBattleBoardProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  visibleTiles: Set<string>;
  getLightLevel: (tileId: string) => LightLevel;
  currentCharacterId: string | null;
  selectedCharacterId: string | null;
}
```

- [ ] **Step 1: Implement the component**

No unit test (jsdom cannot host Pixi); verification is typecheck now, headless render in Task 7. Full implementation:

```tsx
// src/components/BattleMap/pixi/PixiBattleBoard.tsx
/**
 * @file PixiBattleBoard.tsx
 * Deliverable-1 prototype of the single-scene combat renderer (next-gen
 * combat map spec, Pillar 1). Renders ground + tokens + fog in one PixiJS v8
 * scene, WebGPU-first. Display only: no clicks, no targeting — the DOM board
 * remains the playable surface until the migration flips.
 */
import React, { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { BattleMapData, CombatCharacter, LightLevel } from '../../../types/combat';
import { TILE_SIZE_PX } from '../../../config/mapConfig';
import { loadGroundTextures, paintGround } from '../groundPainter';
import { buildFogAlphaGrid, FOG_TINT } from '../fogModel';
import { CameraView, fitView, groundResolutionFor, panBy, zoomAtCursor } from './cameraMath';
import { buildTokenViewModel } from './tokenViewModel';

export interface PixiBattleBoardProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  visibleTiles: Set<string>;
  getLightLevel: (tileId: string) => LightLevel;
  currentCharacterId: string | null;
  selectedCharacterId: string | null;
}

const GLIDE_PER_S = 6; // token glide speed, tiles-ish per second (lerp factor)

/** One rendered combatant: container with ring, label, HP arc. */
interface TokenNode {
  root: Container;
  ring: Graphics;
  hpArc: Graphics;
  label: Text;
  targetX: number;
  targetY: number;
}

const PixiBattleBoard: React.FC<PixiBattleBoardProps> = ({
  mapData, characters, visibleTiles, getLightLevel, currentCharacterId, selectedCharacterId,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  // Live prop mirror so the one long-lived Pixi effect reads fresh values.
  const propsRef = useRef({ characters, visibleTiles, getLightLevel, currentCharacterId, selectedCharacterId });
  propsRef.current = { characters, visibleTiles, getLightLevel, currentCharacterId, selectedCharacterId };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    const app = new Application();
    const tokens = new Map<string, TokenNode>();
    let view: CameraView = { x: 0, y: 0, zoom: 1 };
    let groundRes = 0;
    let fogKey = '';

    const W = mapData.dimensions.width;
    const H = mapData.dimensions.height;
    const mapPxW = W * TILE_SIZE_PX;
    const mapPxH = H * TILE_SIZE_PX;

    const world = new Container();
    const groundLayer = new Container();
    const tokenLayer = new Container();
    const fogLayer = new Container();
    world.addChild(groundLayer, tokenLayer, fogLayer);

    const applyCamera = () => {
      world.scale.set(view.zoom);
      world.position.set(-view.x * view.zoom, -view.y * view.zoom);
    };

    const rasterizeGround = async (res: number) => {
      const textures = await loadGroundTextures();
      if (destroyed) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(mapPxW * res);
      canvas.height = Math.round(mapPxH * res);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      paintGround(ctx, mapData, TILE_SIZE_PX, textures, res);
      const sprite = new Sprite(Texture.from(canvas));
      sprite.width = mapPxW;
      sprite.height = mapPxH;
      groundLayer.removeChildren().forEach((c) => c.destroy({ texture: true }));
      groundLayer.addChild(sprite);
      groundRes = res;
    };

    const redrawFog = () => {
      const { visibleTiles: vis, getLightLevel: light } = propsRef.current;
      const grid = buildFogAlphaGrid(mapData, vis, light);
      // Cheap change detection: skip identical fog states.
      const key = grid.alphas.join(',');
      if (key === fogKey) return;
      fogKey = key;
      const mini = document.createElement('canvas');
      mini.width = grid.width;
      mini.height = grid.height;
      const mctx = mini.getContext('2d');
      if (!mctx) return;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const a = grid.alphas[y * grid.width + x];
          if (a <= 0) continue;
          mctx.fillStyle = `rgba(${FOG_TINT.r},${FOG_TINT.g},${FOG_TINT.b},${a})`;
          mctx.fillRect(x, y, 1, 1);
        }
      }
      const tex = Texture.from(mini);
      tex.source.scaleMode = 'linear'; // bilinear upscale IS the feathering
      const sprite = new Sprite(tex);
      sprite.width = mapPxW;
      sprite.height = mapPxH;
      fogLayer.removeChildren().forEach((c) => c.destroy({ texture: true }));
      fogLayer.addChild(sprite);
    };

    const syncTokens = () => {
      const { characters: chars, currentCharacterId: turnId, selectedCharacterId: selId } = propsRef.current;
      const seen = new Set<string>();
      chars.forEach((ch) => {
        seen.add(ch.id);
        const vm = buildTokenViewModel(ch, { isSelected: ch.id === selId, isTurn: ch.id === turnId });
        const size = TILE_SIZE_PX * vm.sizeMultiplier;
        const r = size * 0.4;
        let node = tokens.get(ch.id);
        if (!node) {
          const root = new Container();
          const ring = new Graphics();
          const hpArc = new Graphics();
          const label = new Text({
            text: vm.label,
            style: { fill: 0xffffff, fontSize: r, fontWeight: '700', fontFamily: 'sans-serif' },
          });
          label.anchor.set(0.5);
          root.addChild(ring, hpArc, label);
          tokenLayer.addChild(root);
          node = { root, ring, hpArc, label, targetX: 0, targetY: 0 };
          tokens.set(ch.id, node);
          // First appearance: snap, later moves glide.
          node.root.position.set(
            ch.position.x * TILE_SIZE_PX + size / 2,
            ch.position.y * TILE_SIZE_PX + size / 2,
          );
        }
        node.targetX = ch.position.x * TILE_SIZE_PX + size / 2;
        node.targetY = ch.position.y * TILE_SIZE_PX + size / 2;
        node.root.alpha = vm.isDown ? 0.35 : 1;
        node.ring.clear()
          .circle(0, 0, r).fill(0x1f2937)
          .stroke({ width: 3, color: vm.ringColor })
          .circle(0, 0, r + 2.5).stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
        node.hpArc.clear();
        if (vm.hpPct < 1 && vm.hpPct > 0) {
          node.hpArc
            .arc(0, 0, r + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vm.hpPct)
            .stroke({ width: 2.4, color: vm.hpColor, cap: 'round' });
        }
        node.label.text = vm.label;
      });
      // Remove tokens for combatants no longer present.
      tokens.forEach((node, id) => {
        if (seen.has(id)) return;
        node.root.destroy({ children: true });
        tokens.delete(id);
      });
    };

    let raf = 0;
    (async () => {
      await app.init({
        preference: 'webgpu',
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      app.stage.addChild(world);

      view = fitView(mapPxW, mapPxH, host.clientWidth, host.clientHeight);
      applyCamera();
      await rasterizeGround(groundResolutionFor(view.zoom, window.devicePixelRatio || 1, mapPxW, mapPxH));
      redrawFog();
      syncTokens();

      // Ticker: token glide + prop-driven refreshes.
      app.ticker.add((tick) => {
        syncTokens();
        redrawFog();
        const dt = Math.min(0.1, tick.deltaMS / 1000);
        tokens.forEach((node) => {
          node.root.x += (node.targetX - node.root.x) * Math.min(1, GLIDE_PER_S * dt);
          node.root.y += (node.targetY - node.root.y) * Math.min(1, GLIDE_PER_S * dt);
        });
      });

      // Wheel zoom anchored at the cursor; drag to pan.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = host.getBoundingClientRect();
        view = zoomAtCursor(view, e.deltaY < 0 ? 1.15 : 1 / 1.15, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        applyCamera();
        // Re-rasterize the ground when the needed density steps up past what
        // we last painted — this is the "crisp at any zoom" proof.
        const wanted = groundResolutionFor(view.zoom, window.devicePixelRatio || 1, mapPxW, mapPxH);
        if (wanted > groundRes * 1.4) void rasterizeGround(wanted);
      };
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        view = panBy(view, e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
        applyCamera();
      };
      const onUp = () => { dragging = false; };
      host.addEventListener('wheel', onWheel, { passive: false });
      host.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);

      const cleanupInput = () => {
        host.removeEventListener('wheel', onWheel);
        host.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      // Stash for the effect cleanup below.
      (app as unknown as { __cleanupInput?: () => void }).__cleanupInput = cleanupInput;
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      (app as unknown as { __cleanupInput?: () => void }).__cleanupInput?.();
      // Guard: init may not have finished when unmounting under StrictMode.
      if (app.renderer) app.destroy(true, { children: true, texture: true });
    };
    // The board is rebuilt only for a new battlefield; live combat state flows
    // through propsRef + the ticker.
  }, [mapData]);

  return (
    <div
      ref={hostRef}
      data-testid="pixi-battle-board"
      className="relative h-full w-full overflow-hidden rounded-xl border-2 border-amber-800/50 bg-slate-950/70"
      aria-label="Battle map (prototype renderer)"
      role="img"
    />
  );
};

export default PixiBattleBoard;
```

- [ ] **Step 2: Typecheck**

Run the tsc grep from Global Constraints — Expected: no output. If pixi.js v8 typings disagree with any call above (e.g. `Text` options, `stroke` signatures), fix to the installed 8.14.3 API — check `node_modules/pixi.js/lib` typings, do not downgrade patterns to v7 (`new Text(string, style)` is the deprecated form).

- [ ] **Step 3: Confirm no import leaks into the eager path**

Run: `npx vite build 2>&1 | tail -5` is NOT required here (dev_hub build failure is known background noise). Instead verify the only importer of `PixiBattleBoard` after Task 6 is the lazy harness: `grep -rn "PixiBattleBoard" src/ --include=*.tsx --include=*.ts` — Expected: definition + one `React.lazy` import site.

---

### Task 6: The `?pixiboard=1` harness in CombatView

**Files:**
- Create: `src/components/BattleMap/pixi/PixiBoardPrototype.tsx`
- Modify: `src/components/Combat/CombatView.tsx` (⚠ Agora: check locks first)

**Interfaces:**
- Consumes: `PixiBattleBoard` (Task 5); `useVisibility` from `src/hooks/combat/useVisibility`; `selectVisibilityObserver` from `src/components/BattleMap/visibilityObserverPolicy`.
- Produces: default export `PixiBoardPrototype: React.FC<BattleMapProps>` — SAME props shape as `BattleMap` (`mapData`, `characters`, `combatState`, and it ignores the rest), so CombatView's swap is a one-line ternary.

- [ ] **Step 1: Write the harness**

The harness owns the visibility wiring the DOM board does in `BattleMap.tsx:155-182`, so `PixiBattleBoard` stays a dumb view:

```tsx
// src/components/BattleMap/pixi/PixiBoardPrototype.tsx
/**
 * @file PixiBoardPrototype.tsx
 * Dev-flag harness (?pixiboard=1) that feeds live combat state into the
 * PixiBattleBoard prototype. Mirrors BattleMap's visibility bridge so fog
 * matches the DOM board exactly. Display only — see the next-gen combat map
 * spec, migration step 1.
 */
import React, { useMemo } from 'react';
import type { CombatState, LightSource } from '../../../types/combat';
import { useVisibility } from '../../../hooks/combat/useVisibility';
import { selectVisibilityObserver } from '../visibilityObserverPolicy';
import PixiBattleBoard from './PixiBattleBoard';

// Same props contract as BattleMap so CombatView can swap 1:1.
type BattleMapLikeProps = React.ComponentProps<typeof import('../BattleMap').default>;

const PixiBoardPrototype: React.FC<BattleMapLikeProps> = ({ mapData, characters, combatState }) => {
  const { turnManager, turnState } = combatState;
  const observer = selectVisibilityObserver({
    selectedCharacterId: null,
    currentCharacterId: turnState.currentCharacterId,
    characters,
  });
  const visibilityState = useMemo(() => ({
    isActive: true,
    characters,
    turnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'move',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: turnManager.reactiveTriggers || [],
    activeLightSources: (turnManager.activeLightSources || []) as LightSource[],
    mapData: mapData ?? undefined,
  } as unknown as CombatState), [characters, mapData, turnManager.activeLightSources, turnManager.reactiveTriggers, turnState]);
  const visibility = useVisibility({ combatState: visibilityState, activeCharacterId: observer.observerId });

  if (!mapData) return <div>Generating map...</div>;
  return (
    <PixiBattleBoard
      mapData={mapData}
      characters={characters}
      visibleTiles={visibility.visibleTiles}
      getLightLevel={visibility.getLightLevel}
      currentCharacterId={turnState.currentCharacterId}
      selectedCharacterId={null}
    />
  );
};

export default PixiBoardPrototype;
```

If the `React.ComponentProps<typeof import(...)>` type gymnastics displeases tsc, import `BattleMap`'s props the plain way: export the `BattleMapProps` interface from `BattleMap.tsx` and import it (a types-only, zero-behavior edit).

- [ ] **Step 2: Check the Agora lock, then wire CombatView**

Run: `curl -s http://localhost:4319/locks` — if `CombatView.tsx` appears in a live lock, STOP and coordinate via the `agora-coordination` skill. Otherwise, in `src/components/Combat/CombatView.tsx`:

Near the other lazy imports (where `BattleMap3D`/`InPlaceCombatScene` are lazied):

```tsx
const PixiBoardPrototype = React.lazy(() => import('../BattleMap/pixi/PixiBoardPrototype'));
// Dev flag for the next-gen renderer prototype (spec: combat-map-nextgen).
const usePixiBoard = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('pixiboard');
```

And in the render branch at `CombatView.tsx:918-931`, wrap the existing `<BattleMap …/>` case:

```tsx
) : usePixiBoard ? (
  <Suspense fallback={<Battle3DLoadingFallback />}>
    <PixiBoardPrototype
      mapData={mapData}
      characters={characters}
      spellMapArtifacts={spellMapArtifacts}
      combatState={{
        turnManager: turnManager,
        turnState: turnManager.turnState,
        abilitySystem: abilitySystem,
        isCharacterTurn: turnManager.isCharacterTurn,
        onCharacterUpdate: handleCharacterUpdate
      }}
    />
  </Suspense>
) : (
  <BattleMap
    ...unchanged...
  />
)
```

- [ ] **Step 3: Verify the default path is untouched**

Run: `npx vitest run src/components/BattleMap src/components/Combat` — Expected: all suites PASS (no test sets `?pixiboard`, so every existing test exercises the DOM board unchanged).
Run the tsc grep — Expected: no output.

---

### Task 7: Headless proof + the eyeball gate

**Files:**
- Create: `.agent/scratch/shoot-pixiboard.mjs` (throwaway, safe to delete later)
- Modify: `public/planmap/topics.json` (feature tile status only, after the gate)

**Interfaces:**
- Consumes: the dev-server recipe and deep-link recipe from memory `combat-2d-preview-recipe` and the handover (`?dummy=1&dev_combat=1`), extended with `&pixiboard=1`.

- [ ] **Step 1: Write the capture script**

Model on `.agent/scratch/shoot-combat2.mjs` (read it first; reuse its wait/click/Escape choreography). The essential shape:

```javascript
// .agent/scratch/shoot-pixiboard.mjs — throwaway proof capture
import { chromium } from 'playwright';

const PORT = process.env.PORT ?? '5199';
const base = `http://localhost:${PORT}/Aralia/?dummy=1&dev_combat=1&pixiboard=1`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 980 } });
await page.goto(base);
// Deep-link race (handover gotcha #2): clear storage, retry once if we land on the menu.
await page.evaluate(() => localStorage.clear());
await page.goto(base);
await page.waitForSelector('[data-testid="pixi-battle-board"] canvas', { timeout: 60_000 });
await page.waitForTimeout(3500); // ground textures decode + first raster
await page.screenshot({ path: '.agent/scratch/pixiboard-fit.png' });
// Zoom in ~4 wheel steps at board center to prove crisp re-rasterization.
const box = await page.locator('[data-testid="pixi-battle-board"]').boundingBox();
for (let i = 0; i < 4; i++) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(1500); // let the higher-res ground land
await page.screenshot({ path: '.agent/scratch/pixiboard-zoom.png' });
await browser.close();
console.log('shots: pixiboard-fit.png, pixiboard-zoom.png');
```

- [ ] **Step 2: Run the dev server and capture**

Run (background): `node -r ./scripts/dev-crash-logger.cjs node_modules/vite/bin/vite.js --port 5199 --strictPort`
Wait for "ready", then: `node .agent/scratch/shoot-pixiboard.mjs`
Expected: both PNGs written; the fit shot shows the whole painted board with tokens and fog pools; the zoom shot shows tree/texture detail WITHOUT bilinear mush (compare against a DOM-board shot at the same zoom if in doubt: rerun without `&pixiboard=1`).
Also capture the renderer actually in use: `await page.evaluate(() => document.querySelector('[data-testid="pixi-battle-board"] canvas').getContext ? 'context-check-n/a' : '')` is not reliable — instead log it from the app if needed; headless Chromium may lack WebGPU and fall back to WebGL, which is acceptable for the eyeball (note which one ran when reporting).

- [ ] **Step 3: Present at the gate**

Send both screenshots to Remy (SendUserFile) with a one-paragraph plain-English read: what is on the new renderer, what is deliberately absent (grid, overlays, interaction), and ask for the look verdict via AskUserQuestion (approve / adjust / reject). Do NOT proceed to any further deliverable without approval.

- [ ] **Step 4: Record the outcome**

On approval: in `public/planmap/topics.json`, set the `combat-map-nextgen` feature tile `renderer prototype (Pixi ground + tokens + fog) — eyeball gate` to `"status": "done"`, and validate: `node -e "JSON.parse(require('fs').readFileSync('public/planmap/topics.json','utf8')); console.log('valid')"` — Expected: `valid`. Update memory `combat-map-nextgen-design.md` NEXT line. Leave everything uncommitted.

---

## Self-review notes (already applied)

- **Spec coverage (deliverable 1 only):** ground plate ✔ (Task 5 raster + Task 1 painter), tokens ✔ (Tasks 4–5), fog ✔ (Tasks 2, 5), crisp zoom ✔ (Task 3 `groundResolutionFor` + Task 5 re-raster), WebGPU-first ✔ (`preference: 'webgpu'`), flag + untouched default path ✔ (Task 6), eyeball gate ✔ (Task 7). Deliberately absent per spec: grid fade, overlays, interaction, DOM mirror, chunk culling — those are later migration steps gated on this eyeball.
- **Type consistency:** `paintGround(ctx, mapData, tileSize, textures, res)` (Tasks 1, 5); `buildFogAlphaGrid → {width, height, alphas}` (Tasks 2, 5); `CameraView {x, y, zoom}` (Tasks 3, 5); `buildTokenViewModel(character, {isSelected, isTurn})` (Tasks 4, 5) — all match.
- **Known risk, called out:** headless Chromium may run the WebGL backend; the eyeball still judges the identical scene graph. Remy's own browser (Chrome/Edge) exercises WebGPU.
