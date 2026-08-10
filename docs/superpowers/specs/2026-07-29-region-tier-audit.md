# Region tier audit (L1 drilldown)

**Date:** 2026-07-29
**Trigger:** Burg Epicea shows a river with bridges in its 2D town plan; the 3D bake showed no town water. Tracing that led here.

## The answer up front

The L1 region artifact carries one field with real detail: the heightfield. Every other field is a stub, empty, or absent.

There is a single root cause. **A region window is smaller than one FMG cell.**

| | |
|---|---|
| region window | 25,000 ft (2.5 FMG pixels) |
| one FMG cell (Epicea) | 78,741 × 88,584 ft (~8 × 9 px) |

A region window covers roughly one ninth of the area of a single cell. Every region field except the heightfield is *extracted* from atlas data, and atlas data has no structure below cell resolution. So there is nothing to extract: rivers clip to two points, markers almost never land inside, and `biomeSites` returns exactly 1 because only the anchor cell's center is in the window.

The region tier cannot inherit its detail. It has to generate it. That is why the drilldown looks blank, and it is what "more dynamic proceduralism" has to mean here.

That blankness is also why the town and the world disagree about rivers. The region tier hands the town nothing usable, so the town invents its own water from the burg's cell shape — at 1/30 of true scale.

## What the Epicea investigation actually found

The reported bug was `getCanonicalTownWaterFeatures` returning empty rivers. It does not. For burg 5 (Epicea, cell 2186, world 903674813):

```
cellWaterFeatures             => rivers: 1  coast: 1
getCanonicalTownWaterFeatures => rivers: 1  coast: 1
canonical plan                => bridges: 4  docks: 6  waterGates: 2
ground bake                   => towns: 1  waterBodies: 2 (river, sea)  decks: 10
chunk sampling                => 9 chunks with lakes, 23 water triangles
```

The town water bakes, carves, meshes and renders. The zero comes from the window, not the water: `getWorldforgeLocalForCell(seed, 2186)` without `centerPx` frames the cell point, which misses the town envelope entirely and returns `townSites: 0`. The running game passes `centerPx: [burg.x, burg.y]` (`legacySubmapBridge.ts:442`). Pinned by `groundWaterLive.test.ts`.

### The real defect: inherited water is in the wrong frame

| measure | value |
|---|---|
| burg cell bounding box | 78,741 × 88,584 ft |
| town span | 2,936 ft |
| shrink factor | ~30× |
| real river distance from burg | 4,045 ft |
| distance the town draws it at | 135 ft from town center |

`canonAffine` normalizes the cell bounding box to `CANON_TOWN_SPAN`, and placement rescales that to the town's span. Inherited water rides the same transform, so every inherited feature lands at 1/30 of its true offset. Epicea's river genuinely runs 4,045 ft away — well outside a 2,936 ft town — and gets dragged through the town center. Its four bridges exist only because of the shrink.

## Region tier measurements

Six burg-centered windows in world 903674813. Window is 25,000 ft across in every case.

| burg | heightfield | rivers | roads | crossings | markers | zones | biomeSites |
|---|---|---|---|---|---|---|---|
| Epicea (river+port) | 250×250 @ 100 ft | 1 (2 pts / 25,537 ft) | 0 | 0 | 0 | 0 | absent |
| Jarimibu (capital+river) | 250×250 @ 100 ft | 0 | 1 (6 pts / 27,635 ft) | 0 | 0 | 0 | absent |
| Reararesto (inland+river) | 250×250 @ 100 ft | 1 (3 pts / 6,643 ft) | 1 (6 pts / 25,080 ft) | 0 | 0 | 0 | 1 |
| Canta (port+river) | 250×250 @ 100 ft | 1 (2 pts / 16,123 ft) | 0 | 0 | 0 | 0 | absent |
| Tsabralamur (inland) | 250×250 @ 100 ft | 0 | 1 (7 pts / 26,364 ft) | 0 | 0 | 0 | 1 |
| Cythyra (port) | 250×250 @ 100 ft | 0 | 0 | 0 | 0 | 1 | 1 |

Read that against the heightfield: terrain gets a sample every 100 ft, while a river gets a vertex every 3,300–25,500 ft and a road every 4,400–5,500 ft.

## Findings

### 1. Rivers are straight chords
A region river is the FMG cell-center sequence clipped to the window. At canonical scale those cell points are ~70,000 ft apart, so a 25,000 ft window usually captures two of them and draws one straight line. Epicea's river is a single segment 25,537 ft long.

### 2. The drawn river and the carved channel are different lines
`generateRiverBanks` stores the **raw** clipped centerline in the artifact (`generateRegion.ts:860`) but carves the heightfield along a **Chaikin-smoothed** line (`generateRegion.ts:872`). The channel in the terrain and the ribbon the renderer draws do not follow the same path.

### 3. Crossings never generate
Zero crossings in all six windows, including Reararesto, which has both a river and a road in-window. `deriveRegionCrossings` exists and is called. Every region bridge and ford is therefore missing. Needs its own investigation — the two polylines may simply never intersect at this coarseness, which would make this a symptom of findings 1 and 4 rather than a separate bug.

### 4. Roads are as coarse as rivers
6–7 points across a 25,000 ft window. A road crosses the whole drilldown as three or four straight runs.

### 5. Markers never appear
Zero in all six windows. This is not a plumbing gap: the bridge does pass `world: atlas` (`legacySubmapBridge.ts:345`) and `extractWorldOverlays` reads `pack.markers` correctly. It is the window-size root cause. A 2.5 px window on a 960 × 540 px map will essentially never contain a marker. Markers cannot be inherited at this zoom; sub-cell points of interest have to be generated.

### 6. Biome blending has nothing to blend
`biomeSites` is absent or exactly 1, which is exactly what a sub-cell window predicts — only the anchor cell's center falls inside. The renderer IDW-blends these so land near a biome border shades toward its neighbor. With one site there is no gradient, so the whole window wears the anchor biome's color — the exact problem the field was added to fix.

### 7. Zones are effectively absent
One zone across six windows, for the same reason.

## What works

- The heightfield: 250×250 at 100 ft resolution, with river channels carved into it.
- `townSites`: correct in all six windows.
- The town water pipeline itself, once a town is in the window.

## The shape of the fix

Every finding above is the same shape: the region tier tries to copy atlas features into a window too small to contain them. The fix is the same shape too. For each field, keep the atlas as the authority on *what* exists and *roughly where*, then procedurally generate the sub-cell detail the window actually needs — seeded so it is stable and so neighboring windows agree.

That gives a rule the whole tier can follow:

> The atlas decides which river runs here and how big it is. The region tier decides where it bends.

## Proposed build order

1. **Rivers end-to-end.** Generate a real course between the cell-center anchors, following the heightfield's valleys rather than cutting straight across them. Store the same line that gets carved. Then have the town inherit that course at true scale instead of generating its own shrunk copy. This closes the Epicea break and establishes the pattern for everything below.
2. **Crossings.** Re-derive once rivers and roads have enough vertices to actually meet. Region bridges and fords depend on it, and this also confirms whether finding 3 is a separate bug.
3. **Roads.** Same treatment as rivers: generate the sub-cell course, follow terrain, keep the endpoints the atlas dictates.
4. **Biome sites.** Sample a grid across the window rather than emitting member-cell centers, so blending has a gradient at any zoom.
5. **Markers and zones.** Generate sub-cell points of interest, seeded from the containing cell's identity, since inheriting them is impossible at this window size.

## Settled: river routing near burgs

**Decision (Remy, 2026-07-29): a generated course bends toward a river-bearing burg.**

Placing rivers at true scale with no attraction would dry out any town the course misses. Epicea would lose its river, its four bridges and its riverside docks, and it would not be alone.

The atlas already states the intent: `cells.r[2186] = 5` marks Epicea's cell as carrying river 5. The 4,045 ft offset is an artifact of cell-center resolution, not a claim that the river avoids the town. So when a burg's cell carries a river, the generated sub-cell course is pulled to pass through the settlement. Everywhere else the course follows the heightfield's valleys.

This keeps three things true at once: the world map still decides which river runs where, the town and the wilderness draw the same continuous river, and riverside towns stay riverside.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-07-29-region-tier-audit.md","sha256WithoutMarker":"a99e70fbea9f65e6ba216bd8e1a680049d1555a7830228d0f83444a4b6c88031","markedAtUtc":"2026-08-09T20:24:24.667Z"} -->
