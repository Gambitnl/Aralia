# Attribution — ported Fantasy-Map-Generator code

Everything under `src/systems/worldforge/fmg/` is ported from **Azgaar's
Fantasy Map Generator** (FMG).

- Upstream repository: https://github.com/Azgaar/Fantasy-Map-Generator
- License: **MIT** — Copyright 2017-2024 Max Haniyeu (Azgaar)
- Provenance: the port was made from the **TypeScript refactor branch**
  checked out at `.tmp/azgaar-src` in this repo (modules under
  `src/modules/*.ts`, utilities under `src/utils/*.ts`, orchestration still in
  `public/main.js` on that branch). The heightmap template data comes from
  `public/config/heightmap-templates.js`; the polygon clipping comes from the
  vendored `public/libs/lineclip.min.js` (lineclip by mourner,
  https://github.com/mapbox/lineclip, ISC, with FMG's `secure` modification).

MIT License

Copyright 2017-2024 Max Haniyeu (Azgaar)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Faithfulness rule

**Faithfulness over taste.** The ported code keeps FMG's algorithm logic, RNG
call ORDER and data layouts exactly: the same seed (plus the same explicit
options that replace upstream's DOM inputs) must produce the same heights and
features as upstream. Do **not** refactor, "clean up", optimize, or reorder
RNG draws in these files. Known upstream bugs are preserved verbatim and
flagged with `UPSTREAM BUG PRESERVED` / `UPSTREAM QUIRK PRESERVED` comments.
Permitted changes are cosmetic only: import paths, explicit parameters in
place of globals/DOM reads, strict-TS annotations (`!`, `Boolean(...)` where
truthiness is unchanged), and removal of DOM/SVG/render code.

## What was ported (slice 2 — climate → pack → rivers → biomes)

| Ported file | Upstream source |
| --- | --- |
| `climate.ts` | `defineMapSize` (incl. `getSizeAndLatitude`), `calculateMapCoordinates`, `calculateTemperatures`, `generatePrecipitation` from `public/main.js` (not yet modularized on the TS branch) |
| `reGraph.ts` | `reGraph()` from `public/main.js` |
| `river-generator.ts` | `src/modules/river-generator.ts` (generation path: generate, alterHeights, resolveDepressions, addMeandering, getRiverPoints, getBorderPoint, getOffset, getSourceWidth, getApproximateLength, getWidth) |
| `biomes.ts` | `src/modules/biomes.ts` (getDefault matrix data, define, getId, isWetland — complete) |
| `lakes.ts` (extended) | `src/modules/lakes.ts` — added `defineClimateData` and `cleanupLakeData` (stripped in slice 1, needed by Rivers.generate) |
| `utils/probabilityUtils.ts` (extended) | added `gauss` (upstream `src/utils/probabilityUtils.ts`) — needed because defineMapSize draws gauss/P from the same seeded stream generatePrecipitation later consumes |
| `utils/graphUtils.ts` (extended) | added `getPackPolygon` (upstream `src/utils/graphUtils.ts`), used by reGraph's cell-area computation |
| `d3Shim.ts` (extended) | added `sum` (d3-array v3 exact semantics) and `randomNormal` (d3-random v3 polar-method source, verbatim algorithm incl. cached-second-value and `.source()` API — geometry/RNG, not rendering) |
| `generateAtlas.ts` | orchestration order from `public/main.js generate()` (stages OceanLayers→defineGroups), continuing `generateBase.ts` |
| `features.ts` (slice 1) | `markupPack` and `defineGroups` are now exercised by `generateAtlas` (they were ported but uncalled in slice 1); only the `Pack` TYPE was extended (g/area/fl/r/conf/biome/rivers fields) — no logic change, slice-1 goldens unchanged |

## What was ported (slice 1 — physical world base)

| Ported file | Upstream source |
| --- | --- |
| `voronoi.ts` | `src/modules/voronoi.ts` (verbatim; removed one dead `this.vertices;` expression statement) |
| `heightmap-generator.ts` | `src/modules/heightmap-generator.ts` |
| `heightmap-templates.ts` | `public/config/heightmap-templates.js` (frozen data) |
| `features.ts` | `src/modules/features.ts` (markupGrid, markupPack, defineGroups) |
| `lakes.ts` | `src/modules/lakes.ts` (getHeight, detectCloseLakes) |
| `generateBase.ts` | orchestration order + `addLakesInDeepDepressions` + `openNearSeaLakes` from `public/main.js` `generate()` |
| `utils/numberUtils.ts` | `src/utils/numberUtils.ts` (rn, minmax, lim, normalize, lerp) |
| `utils/arrayUtils.ts` | `src/utils/arrayUtils.ts` (last, unique, getTypedArray, createTypedArray, TYPED_ARRAY_MAX_VALUES) |
| `utils/probabilityUtils.ts` | `src/utils/probabilityUtils.ts` (rand, P, each, Pint, ra, rw, biased, getNumberInRange, generateSeed) |
| `utils/functionUtils.ts` | `src/utils/functionUtils.ts` (distanceSquared) |
| `utils/pathUtils.ts` | `src/utils/pathUtils.ts` (connectVertices) |
| `utils/commonUtils.ts` | `src/utils/commonUtils.ts` (clipPoly) |
| `utils/lineclip.ts` | `public/libs/lineclip.min.js` (polygonclip, un-minified) |
| `utils/graphUtils.ts` | `src/utils/graphUtils.ts` (getBoundaryPoints, getJitteredGrid, placePoints, generateGrid, calculateVoronoi, findGridCell, findGridAll, isLand, isWater) |
| `d3Shim.ts` | local re-implementation of the d3 functions FMG imports (`mean`, `min`, `range`, `leastIndex`, `ascending` from d3-array; `polygonArea` from d3-polygon) with exact d3 v3-series semantics (e.g. `mean` ignores null/undefined/NaN). d3 is NOT a dependency. |

## What was stripped (DOM/SVG/render/UI code left behind)

- All `window.*` global wiring, `TIME/INFO/WARN/ERROR` console-timing flags
  and `byId(...)` DOM reads. DOM inputs became explicit parameters:
  `cellsDesired` (upstream `pointsInput.dataset.cells`, default 10000),
  `template` (upstream `templateInput.value`), `lakeElevationLimit` (upstream
  `lakeElevationLimitOutput.value`, default 20), `graphWidth`/`graphHeight`
  (upstream globals from the browser window size), `seed`, `grid`, `pack`.
- `heightmap-generator.ts`: the async `fromPrecreated` path (canvas + Image
  loading of pre-drawn heightmap PNGs) was not ported; only the
  template-driven `fromTemplate` path exists, so `generate()` is synchronous.
  Unknown template ids throw instead of falling back to an image.
- `graphUtils.ts`: d3-quadtree helpers (`findClosestCell`,
  `findAllInQuadtree`, `findAllCellsInRadius`), `getPackPolygon`/
  `getGridPolygon`, `poissonDiscSampler`, `shouldRegenerateGrid` (DOM) and
  the canvas `drawHeights` preview were left behind (render/later-stage).
- `lakes.ts`: `defineNames`/`getName` (need the Names generator) are still
  left behind; `cleanupLakeData` and `defineClimateData` were ported in
  slice 2.
- `pathUtils.ts`: SVG path builders, isolines, polylabel poles of
  inaccessibility and A* `findPath` were left behind.
- `probabilityUtils.ts`: `gauss` was ported in slice 2 (defineMapSize needs
  it on the generation-relevant stream; see RNG notes).
- `features.ts`: `markupPack` and `defineGroups` are exercised by
  `generateAtlas` since slice 2.

## What was stripped in slice 2 (DOM/SVG/render/UI code left behind)

- `OceanLayers` (upstream `src/modules/ocean-layers.ts`, runs between
  openNearSeaLakes and defineMapSize): NOT ported — it only renders SVG ocean
  depth-contour paths (d3 `curveBasisClosed` line generator). With FMG's
  default style (`oceanLayers` "layers" attr = `"-6,-3,-1"`) it draws no RNG.
  Its non-default `"random"` outline mode (`randomizeOutline`, up to 9 `P()`
  draws) is NOT reproduced — running upstream with that style would shift the
  defineMapSize/precipitation stream.
- `defineMapSize` lock/URL handling: the DOM input writes and the
  `?options=default` URL-param check became explicit `mapSize`/`latitude`/
  `longitude` options with upstream's locked-input semantics (random values
  are still drawn, then discarded when the option is set).
- `generatePrecipitation`: `prec.selectAll("*").remove()` and the
  `drawWindDirection` IIFE (SVG wind arrows; no RNG draws) were stripped.
- `reGraph`: `pack.cells.q = d3.quadtree(...)` (spatial search index used by
  UI hit-testing/`findCell` helpers; no slice-2 stage reads it) was stripped —
  port it with the first stage that needs it.
- `createDefaultRuler` (upstream runs it between Features.markupPack and
  Rivers.generate): measuring-tool UI, no RNG, not ported.
- `river-generator.ts`: `lineGen`/`getRiverPath` (d3 `curveBasis`/
  `curveCatmullRom` SVG river-polygon path building — pure rendering; the
  geometric `addMeandering` IS ported because river length/width derive from
  it), `specify`/`getName`/`getType`/`riverTypes`/`smallLength`/`getBasin`
  (upstream calls Rivers.specify in a later stage; needs the Names
  generator), `remove` and `getNextId` (editor UI) were left behind.
- DOM inputs became explicit options: `mapSizeOutput`/`latitudeOutput`/
  `longitudeOutput` (overrides, see above), `options.temperatureEquator`
  (default 27) / `temperatureNorthPole` (-30) / `temperatureSouthPole` (-15) /
  `winds` ([225, 45, 225, 315, 135, 315]) from the main.js options literal,
  `heightExponentInput` (default 2), `precInput` (`precipitationModifier`,
  default 100 — see RNG notes), `resolveDepressionsStepsOutput` (default
  250), plus the already-explicit `pointsInput.dataset.cells`
  (`cellsDesired`) and `lakeElevationLimitOutput` (`lakeElevationLimit`).

## RNG fidelity notes (SPEC §10 honesty)

- RNG is the `alea` npm package (same package and version range as the
  upstream TS branch). Upstream's pattern — each generation stage assigns
  `Math.random = Alea(seed)` and all helpers (`rand`, `P`,
  `getNumberInRange`, jitter) draw from the global `Math.random` — is
  reproduced exactly. `generateFmgBase` restores the original `Math.random`
  in a `finally` block.
- Upstream `setSeed()` (public/main.js) seeds with the separate `aleaPRNG`
  browser lib, whose stream feeds only UI option randomization
  (`randomizeOptions`). Every ported stage re-seeds with npm `alea` before
  its first draw (as the TS-branch modules do), so this difference cannot
  affect generation output. Consequence: the *random template selection*
  (`randomizeHeightmapTemplate`, probability-weighted `rw` draw from the
  aleaPRNG stream) is NOT reproduced — `template` must be passed explicitly
  (default `"continents"`).
- `addLakesInDeepDepressions`: upstream's `cells.t[c] = 1` bug (writes a junk
  string-keyed property, mutates no element) is replicated verbatim.
- `openNearSeaLakes`: upstream compares the template key against the display
  name `"Atoll"`, which never matches on this branch; preserved verbatim.
- No known places where exact RNG draw order could not be preserved.

## RNG fidelity notes — slice 2 (SPEC §10 honesty)

- **The defineMapSize→generatePrecipitation shared stream is the one place
  slice 2's RNG order was genuinely at risk, and it is preserved**: upstream
  reseeds `Math.random = Alea(seed)` inside `Features.markupGrid` and then
  draws nothing until `defineMapSize` (markupGrid, addLakesInDeepDepressions,
  openNearSeaLakes and default-style OceanLayers are draw-free), so
  `generateAtlas` re-creates that state with a fresh `Alea(seed)` after
  `generateFmgBase` returns. `defineMapSize` is ported in full (it ALWAYS
  draws gauss/P, even for locked inputs) and `gauss` uses a verbatim
  d3-random v3 `randomNormal` (polar rejection method — variable draw count
  per call, which is why an approximation was not acceptable). The
  `rand(10, 20)` draws in `generatePrecipitation` therefore consume the
  stream at exactly the upstream offsets.
- `Rivers.generate` reseeds `Math.random = Alea(seed)` (as the TS-branch
  module does) but its generation path draws nothing; the only RNG in the
  module (`rw` in `getType`) belongs to the unported `specify` stage.
- `calculateMapCoordinates`, `calculateTemperatures`, `reGraph`,
  `Features.markupPack`, `Biomes.define` and `Features.defineGroups` are
  draw-free, verified against upstream.
- NOT reproduced (same stance as slice 1's template selection): upstream
  `randomizeOptions()` randomizes `temperatureEquator`/poles, `precInput`
  etc. on the separate UI-only aleaPRNG stream. They are explicit options
  instead, defaulting to the main.js options literal (27 / -30 / -15, winds)
  and DOM defaults (heightExponent 2, resolveDepressionsSteps 250).
  `precipitationModifier` defaults to 100 — the center of upstream's
  `gauss(100, 40, 5, 500)` randomization (the static DOM fallback, 50, is
  only reachable with a locked input).
- NOT reproduced: OceanLayers' non-default `"random"` outline mode (see the
  slice-2 strip list) — it would advance the shared stream before
  defineMapSize.
- `generatePrecipitation`/`passWind`: upstream's `if (first[0])` unpacking
  bug (falsy for west-coast cell id 0 → `first` stays an array → NaN
  humidity and junk string-keyed typed-array writes, no real element writes,
  no RNG draws on that path) is replicated verbatim.
- `resolveDepressions`: the bad-progress branch's `h = this.alterHeights()`
  rebinding (which the caller never observes — only the immediate `break`
  matters) is replicated verbatim.
- `defineGroups`: upstream skips ocean features entirely (its
  `defineOceanGroup` is dead code on this path), so oceans stay group-less;
  preserved verbatim.

## Determinism contract

`src/systems/worldforge/fmg/__tests__/fmgBase.test.ts` (slice 1) and
`src/systems/worldforge/fmg/__tests__/fmgAtlas.test.ts` (slice 2) pin golden
values (cell counts, height/temperature/precipitation/flux hashes and sums,
river counts, biome histograms, feature counts) for fixed seeds. Those
goldens are frozen persistence contracts in the same sense as
`worldforgeSpine.test.ts` — see that file's header.
