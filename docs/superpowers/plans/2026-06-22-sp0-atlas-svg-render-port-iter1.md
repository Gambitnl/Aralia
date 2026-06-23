# SP0 Atlas SVG Render-Port — Iteration #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a native, iframe-free **SVG** atlas renderer (`AtlasSvgView`) that draws owned FMG data (`FmgAtlasResult`) as per-cell polygons with pan/zoom, and capture a proof render — the foundation the rest of SP0 (merged regions, rivers, filters, marker, cell-pick) builds on.

**Architecture:** A pure, DOM-free model builder (`atlasSvg.ts`) converts `FmgAtlasResult` into an ordered SVG layer model (ocean + land cells), mirroring how `atlasDraw.ts` is a pure canvas core. A thin React component (`AtlasSvgView.tsx`) renders the model as `<svg>` with `<g>` layers and manual wheel/drag pan-zoom (no new dependency). Unit tests drive the pure helpers with a tiny stub atlas; a headless script renders a proof PNG for the visual-inspection check.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react, the existing `src/systems/worldforge/fmg/` port, Playwright (proof render, reusing the `renderAtlasProof` pattern).

**Scope (iteration #1):** SP0 task **T1** only (see `docs/projects/worldforge/subprojects/sp0-atlas-svg-render-port/TRACKER.md`). Per-cell fill is acceptable here; **merged-region polygons are T2 (next iteration)**. Do NOT attempt rivers/filters/labels/marker/cell-pick/MapPane-swap in this iteration.

**Binding constraints:** Azgaar L0 authority; no Watabou; no fallback layers; **visual-inspection rule** — render and eyeball against `.agent/azgaar-ref/azgaar-full-761.png`, do not claim parity. Read `docs/projects/worldforge/subprojects/sp0-atlas-svg-render-port/COLD_START_AGENT_PROMPT.md` first.

---

## File Structure

- `src/components/Worldforge/atlasSvg.ts` — **new.** Pure helpers + model builder. DOM/React-free (so it unit-tests with a stub and runs headless). One responsibility: turn `FmgAtlasResult` into an SVG layer model.
- `src/components/Worldforge/AtlasSvgView.tsx` — **new.** React component: renders the model, owns pan/zoom transform state. No data logic.
- `src/components/Worldforge/__tests__/atlasSvg.test.ts` — **new.** Unit tests for the pure helpers.
- `scripts/worldforge/renderAtlasSvgProof.mjs` — **new.** Headless proof: build the model for seed 761, serialize to an SVG string, rasterize via Playwright, write a PNG next to the reference.

Data shapes (confirmed from `atlasDraw.ts`): `atlas.pack.cells.h[i]` (height; land = `>= 20`), `atlas.pack.cells.v[i]` (vertex id list), `atlas.pack.vertices.p[vid] = [x, y]`, `atlas.pack.cells.biome?.[i]`, `atlas.biomesData.color[biomeIdx]`, `atlas.graphWidth`, `atlas.graphHeight`.

---

## Task 1: Pure cell-geometry + fill helpers

**Files:**
- Create: `src/components/Worldforge/atlasSvg.ts`
- Test: `src/components/Worldforge/__tests__/atlasSvg.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { cellPolygonPoints, biomeFillForCell } from '../atlasSvg';

// Minimal stub shaped like FmgAtlasResult (only fields the helpers read).
const stub = {
  graphWidth: 100,
  graphHeight: 100,
  biomesData: { color: ['#000000', '#11aa33', '#cccccc'] },
  pack: {
    vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    cells: {
      h: [5, 50],            // cell 0 = water, cell 1 = land
      v: [[0, 1, 2], [0, 1, 2, 3]],
      biome: [0, 1],
    },
  },
} as any;

describe('atlasSvg helpers', () => {
  it('cellPolygonPoints joins vertex coords as "x,y" pairs', () => {
    expect(cellPolygonPoints(stub, 1)).toBe('0,0 10,0 10,10 0,10');
  });
  it('biomeFillForCell resolves the biome color', () => {
    expect(biomeFillForCell(stub, 1)).toBe('#11aa33');
  });
  it('biomeFillForCell falls back when color missing', () => {
    expect(biomeFillForCell(stub, 99)).toBe('#888888');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Worldforge/__tests__/atlasSvg.test.ts`
Expected: FAIL — `cellPolygonPoints`/`biomeFillForCell` not exported.

- [x] **Step 3: Write minimal implementation**

```ts
// src/components/Worldforge/atlasSvg.ts
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';

/** SVG "x,y x,y ..." points string for a cell's Voronoi polygon (graph coords). */
export function cellPolygonPoints(atlas: FmgAtlasResult, i: number): string {
  const vIds = atlas.pack.cells.v[i];
  if (!vIds) return '';
  const out: string[] = [];
  for (const vid of vIds) {
    const p = atlas.pack.vertices.p[vid];
    if (p) out.push(`${+p[0].toFixed(1)},${+p[1].toFixed(1)}`);
  }
  return out.join(' ');
}

/** Biome fill color for a land cell; neutral grey fallback. */
export function biomeFillForCell(atlas: FmgAtlasResult, i: number): string {
  const idx = atlas.pack.cells.biome?.[i] ?? 0;
  return atlas.biomesData.color[idx] ?? '#888888';
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Worldforge/__tests__/atlasSvg.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/components/Worldforge/atlasSvg.ts src/components/Worldforge/__tests__/atlasSvg.test.ts
git commit -m "feat(worldforge/sp0): pure cell-geometry + biome-fill helpers for SVG atlas"
```

---

## Task 2: SVG layer model builder

**Files:**
- Modify: `src/components/Worldforge/atlasSvg.ts`
- Test: `src/components/Worldforge/__tests__/atlasSvg.test.ts`

- [x] **Step 1: Write the failing test** (append to the existing test file)

```ts
import { buildAtlasSvgModel } from '../atlasSvg';

describe('buildAtlasSvgModel', () => {
  it('emits an ocean layer and a land layer with one polygon per land cell', () => {
    const model = buildAtlasSvgModel(stub);
    expect(model.width).toBe(100);
    expect(model.height).toBe(100);
    const land = model.layers.find((l) => l.id === 'land');
    expect(land!.polygons).toHaveLength(1);            // only cell 1 is land (h>=20)
    expect(land!.polygons[0].fill).toBe('#11aa33');
    expect(land!.polygons[0].points).toBe('0,0 10,0 10,10 0,10');
    expect(model.layers.map((l) => l.id)).toEqual(['ocean', 'land']);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Worldforge/__tests__/atlasSvg.test.ts`
Expected: FAIL — `buildAtlasSvgModel` not exported.

- [x] **Step 3: Write minimal implementation** (append to `atlasSvg.ts`)

```ts
export interface AtlasSvgPolygon { points: string; fill: string }
export interface AtlasSvgLayer { id: string; polygons: AtlasSvgPolygon[] }
export interface AtlasSvgModel { width: number; height: number; layers: AtlasSvgLayer[] }

const LAND_THRESHOLD = 20;

/** Build the ordered SVG layer model (iteration #1: ocean + per-cell land). */
export function buildAtlasSvgModel(atlas: FmgAtlasResult): AtlasSvgModel {
  const n = atlas.pack.cells.h.length;
  const land: AtlasSvgPolygon[] = [];
  for (let i = 0; i < n; i++) {
    if (atlas.pack.cells.h[i] < LAND_THRESHOLD) continue;
    const points = cellPolygonPoints(atlas, i);
    if (!points) continue;
    land.push({ points, fill: biomeFillForCell(atlas, i) });
  }
  return {
    width: atlas.graphWidth,
    height: atlas.graphHeight,
    layers: [
      { id: 'ocean', polygons: [] }, // ocean drawn as a flat rect in the view (iter #1)
      { id: 'land', polygons: land },
    ],
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Worldforge/__tests__/atlasSvg.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/components/Worldforge/atlasSvg.ts src/components/Worldforge/__tests__/atlasSvg.test.ts
git commit -m "feat(worldforge/sp0): SVG atlas layer model builder (ocean + land cells)"
```

---

## Task 3: `AtlasSvgView` React component (render + pan/zoom)

**Files:**
- Create: `src/components/Worldforge/AtlasSvgView.tsx`
- Test: `src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AtlasSvgView from '../AtlasSvgView';

const stub = {
  graphWidth: 100, graphHeight: 100,
  biomesData: { color: ['#000', '#11aa33'] },
  pack: { vertices: { p: [[0,0],[10,0],[10,10],[0,10]] },
          cells: { h: [5, 50], v: [[0,1,2], [0,1,2,3]], biome: [0, 1] } },
} as any;

describe('AtlasSvgView', () => {
  it('renders an <svg> with one polygon per land cell', () => {
    const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('polygon')).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Write minimal implementation**

```tsx
// src/components/Worldforge/AtlasSvgView.tsx
import React, { useMemo, useRef, useState } from 'react';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { buildAtlasSvgModel } from './atlasSvg';

export interface AtlasSvgViewProps { atlas: FmgAtlasResult; width?: number; height?: number }

/**
 * Iteration #1 native SVG atlas: ocean rect + per-cell land polygons, with
 * manual wheel-zoom / drag-pan via a transform on the root <g> (no new dep).
 * Merged-region fills, rivers, filters, marker, and cell-pick are later SP0 tasks.
 */
const AtlasSvgView: React.FC<AtlasSvgViewProps> = ({ atlas, width = 960, height = 540 }) => {
  const model = useMemo(() => buildAtlasSvgModel(atlas), [atlas]);
  const [view, setView] = useState({ k: Math.min(width / model.width, height / model.height), x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => ({ ...v, k: Math.max(0.05, Math.min(64, v.k * factor)) }));
  };
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <svg
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#15375d', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      data-testid="atlas-svg-view"
    >
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        <rect x={0} y={0} width={model.width} height={model.height} fill="#3d6ea4" />
        {model.layers.find((l) => l.id === 'land')!.polygons.map((p, i) => (
          <polygon key={i} points={p.points} fill={p.fill} />
        ))}
      </g>
    </svg>
  );
};

export default AtlasSvgView;
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Worldforge/__tests__/AtlasSvgView.test.tsx`
Expected: PASS (1 test).

- [x] **Step 5: Commit**

```bash
git add src/components/Worldforge/AtlasSvgView.tsx src/components/Worldforge/__tests__/AtlasSvgView.test.tsx
git commit -m "feat(worldforge/sp0): AtlasSvgView component with manual pan/zoom"
```

---

## Task 4: Headless proof render (visual-inspection gate)

**Files:**
- Create: `scripts/worldforge/renderAtlasSvgProof.mjs`

- [x] **Step 1: Write the proof script**

```js
// scripts/worldforge/renderAtlasSvgProof.mjs
// Build the SVG model for seed 761, serialize to an SVG string, rasterize via
// Playwright, and write a PNG next to the real-Azgaar reference for parity review.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas.ts';
import { buildAtlasSvgModel } from '../../src/components/Worldforge/atlasSvg.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;
const atlas = generateFmgAtlas('world-761'.includes('-') ? 761 : 761, { width: W, height: H, cellsDesired: 10000, template: 'continents' });
const model = buildAtlasSvgModel(atlas);
const k = Math.min(W / model.width, H / model.height);
const polys = model.layers.find((l) => l.id === 'land').polygons
  .map((p) => `<polygon points="${p.points}" fill="${p.fill}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#15375d"/>`
  + `<g transform="scale(${k})"><rect width="${model.width}" height="${model.height}" fill="#3d6ea4"/>${polys}</g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const out = path.join(__dirname, '../../.agent/azgaar-ref/ours-atlas-svg-761.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
```

- [x] **Step 2: Run it**

Run: `npx tsx scripts/worldforge/renderAtlasSvgProof.mjs`
Expected: `saved .../.agent/azgaar-ref/ours-atlas-svg-761.png` (a colored landmass on blue ocean).

- [ ] **Step 3: STOP for visual review (do not claim parity)**

Place `ours-atlas-svg-761.png` beside `.agent/azgaar-ref/azgaar-full-761.png`. Iteration #1 success = a recognizable land/ocean atlas rendered natively in SVG (facets still visible — that is T2's job). Report the image and the per-cell polygon count; await owner judgment before proceeding to T2.

- [x] **Step 4: Commit**

```bash
git add scripts/worldforge/renderAtlasSvgProof.mjs
git commit -m "chore(worldforge/sp0): headless SVG atlas proof render"
```

---

## Self-Review

**Spec coverage (iteration #1 = SP0 T1):** scaffold (`AtlasSvgView`) ✓ Task 3; per-cell SVG render ✓ Tasks 1–3; pan/zoom ✓ Task 3; proof render ✓ Task 4. T2–T9 (merged regions, depth contours, rivers, routes/labels, filters, marker+cell-pick, MapPane swap, parity) are explicitly out of this iteration and tracked in the SP0 `TRACKER.md`.

**Placeholder scan:** none — every code step has complete code; the only intentional "stop" is the visual-review gate (Task 4 Step 3), which is required by the visual-inspection rule, not a code placeholder.

**Type consistency:** `cellPolygonPoints`/`biomeFillForCell` (Task 1) are consumed by `buildAtlasSvgModel` (Task 2); `AtlasSvgModel`/`AtlasSvgLayer`/`AtlasSvgPolygon` (Task 2) are consumed by `AtlasSvgView` (Task 3) and the proof script (Task 4). `FmgAtlasResult` import path matches `atlasDraw.ts`. Land threshold (`>= 20`) consistent across helpers and model.

**Risk note for the executor:** if `generateFmgAtlas`'s signature differs from the `renderAtlasProof.ts` call, mirror that script's exact call. If `biomesData.color` is absent on some atlases, the `#888888` fallback covers it.
