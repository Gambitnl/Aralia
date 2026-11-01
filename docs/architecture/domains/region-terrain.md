# Region Terrain (L1 drilldown)

Verified: 2026-11-01 for the river valley and the level settlement floor (GG-539: region tests, a probe of the Fapolis window, seed 42, tile 9,5) and the full-course grade in the 3D channel (GG-536: unit tests and a two-window seam probe); 2026-10-30 for the river carve's depth and per-point width (one water, GG-534: region tests and the Sinzheim world); 2026-10-24 for shared point-sampler math and C19 parity; composite wiring and performance observations below were last checked 2026-08-18.

How the L1 region terrain - the heightfield that carries the 3D ground inside a
25,000 ft region window - is generated NOW.

## The heightfield is the region composite

`generateRegion` (src/systems/worldforge/region/generateRegion.ts) produces the
`RegionArtifact.heightfield` from `buildWindowComposite`
(`regionCompositeField.ts`) - the region-weighted composite height field QA'd as
`region-terrain` (crest lines, valleys, drainage networks, plain structure).
Wired in on 2026-08-18 by Remy call, replacing the old IDW + FBM + ridge stack
(`generateHeightfield`, removed). The standing decision "NOT WIRED" recorded in
`public/visual-quality/verdicts/region-terrain.json` was lifted after the
mountain flank-streak artifact (task d7b60572) was fixed in the composite.

Same day (task b25cfbde): the composite is fed the atlas erosion bake
(`bakeAtlasErosion` - per-cell rock hardness + discharge), memoized once per
atlas object inside `generateRegion` (`erosionBakeFor`). Channels now vary with
real flow and rock competence instead of the uniform reference width - closing
the "uniform-width channel" half of the region-terrain verdict. Hand-built test
atlases (no `t`/`b`/`area`/`g`/grid precipitation) fall back to reference rock,
the documented fallback, never a second code path.

The composite blends, per sample, the geomorphic operators of the atlas regions
whose mask reaches it: peak / dune / terrace / erosion / interfluve relief over
three noise bands (8,000 / 2,200 / 700 ft), with a per-region profile chosen by
atlas height class + biome.

### Post-raster discipline

`applyRegionDiscipline` (generateRegion.ts) re-applies the two guarantees the
composite does not carry:

1. **Settlement dry-land floor** - a per-Locale town pad (only when entering a
   settlement via `windowCenterPx`), lifting the burg center above the
   waterline so coastal towns don't flood. Since 2026-11-01 it is a LEVEL
   disk at `DRY_LAND_FLOOR` (the waterline plus 0.003, which is 6 ft or
   1.8 m) out to 1,630 ft from the burg point, with a 1 in 8 edge down to the
   water. Before, it was a cone from 0.23 at the burg point to 0 at half the
   window: 0.03 normalized is 60 ft (18 m), not "just above the waterline",
   so every low river town stood on a mound up to 18 m above its river.
2. **Water cap** - any sample reading below the waterline (0.2) is capped at
   0.19. The composite keeps ocean low by itself (water regions get ~0.01-0.03
   surface; drainage/erosion are gated off below the line), so this is
   belt-and-suspenders only.

Both are pure functions of world position + the floor anchor, so the seam
contract holds: two adjacent regions read bit-equal values at shared world
points (mask kernels exactly 0 at the radius, ascending-id summation,
world-feet operators, window origin snapped to the global lattice).

## Rivers still route on the window-independent sampler

`generateRiverBanks` routes courses against `makeAtlasNaturalHeight`
(`regionTerrainField.ts`) - a pure point sampler with its own relief stack -
because a course must be generated from the FULL unclipped river and only
clipped afterward. Since 2026-08-18 the grid terrain is the composite, so the
routing surface and the shipped surface are different fields (they share the
8,000 ft macro wavelength by design). The carved channel (0.04 deep) still
renders; a course that disagrees with the composite's local drainage is a known
divergence, surfaced as a gap.

Since 2026-10-30 (one water, GG-534) a river's width and depth come from
`riverChannel.ts`: each centerline point takes the atlas water count of its
anchor segment, the map's width for that count (`widthFtAt`), and the atlas
fall there (`slopeAt`). The carve depth is the channel's flood depth for that
width and fall (Manning, banks at repose), per segment; the median river's is
about 1.2 m, not the old 6 to 20 ft. A river whose water never falls, even in
its parent, throws.

### A river runs at the bottom of its own valley (GG-539, 2026-11-01)

Remy, looking at the live river through Fapolis (seed 42, tile 9,5): "fix the
gorge, towns should build down to the river." The carve used to follow the
ground under the river, so a river over a hump stayed on the hump. The 3D
ground carve, which never lets a bed rise downstream, then cut a trench with
steep walls through the town, and the building pads beside it stood on pale
columns of ground (Fapolis: 15 m).

`riverValley.ts` holds the rule, and `carveRiverChannel` applies it:

- **The grade.** A river's flood level at each course point is the lowest
  composite ground from its source to that point, and never below
  `DRY_LAND_FLOOR` (`riverGradeFt`). The composite is read along the FULL
  course, in fields of one region window each (`compositeGroundFt`), and the
  grade is cached per atlas, scale and river (`riverGradeCache`), so every
  window reads the same grade at a shared point.
- **The valley.** Beside the channel the ground is at most the flood level over
  a floodplain one river width wide on each side, then rises at 1 in 8
  (`VALLEY_SIDE_SLOPE`) to the land (`valleyTargetFt`). Inside the channel it
  is the flood level less the flood depth. The carve only lowers, and the old
  relative channel cut stays a lower bound.
- **The reach.** A valley side reaches until it stands above the window's
  highest sample, so stopping leaves no step; past 2,500 ft it is capped and
  fades out over its last 600 ft.

Where the ground already falls downstream (most rivers), the grade is the
ground itself and the valley lowers nothing past the old channel.

**The grade reaches the 3D channel (GG-536, 2026-11-01).** The grade also
falls at least at the atlas grade (`slopeAt` times each step), because water
on a dead level bed drains away to the live river's outflow edge. That forced
fall stops once the level stands twice the channel's flood depth under the
ground, so a long flat plain does not drive the river into a trench. Each
published centerline point carries its level as `RegionRiverBank.floodFtAt`
(absolute feet, `gradeAlongCourse`). `regionPolylinesToGround` turns it into
`GroundPolyline.floodAtM` on the window's height datum, and
`carveRiverChannelToGrade` and the floor pass in `carveRiverBedsDownhill` cut
the bed at that level less the flood depth. Before, the 3D carve graded each
river from the bank at its first point inside each window, so two windows
stepped at their seam. Probe: two wilderness windows 1,500 ft apart on the
Fapolis river cut the same bed at all 29 shared river points (difference
0.000 m); with the old rule they differed by up to 0.505 m, and the bed sat
2 m deeper. At Fapolis the channel is now 1.2 to 2.4 m under its banks (it was
2.5 to 4.3 m, deepening across the window). Measured at
Fapolis (the settlement floor change and this rule together): the ground along
the river went from 7 m, 19 m, 6 m (window entry, town, exit) to an even 7 to
8 m, and the town now stands on that level ground beside the river.

## What is NOT wired yet

- River routing on the composite's own point sampler (`CompositeHeightField.sample`)
  (the bake is wired since 2026-08-18, task b25cfbde).

## Perf

The composite costs roughly 0.7-0.8 s per window at 250x250 @ 100 ft. Region
generation is on-demand (atlas click, seam streamer), so this is a visible
hitch, not a background cost. The erosion bake adds a few tens of ms once per
atlas (memoized; the first window of an atlas pays it).

## Shared point-sampler math

`regionTerrainField.ts` owns `computeIdwRadiusFt`, `makeMountainRidgeField`, and the private smoothstep helper. These pure functions define the sampler's atlas-wide neighborhood and seeded ridge delta. `generateRegion.ts` forwards the same public exports for existing callers and tests. The sampler no longer imports the generator, so their former emitted module cycle is absent.

The complete 77-line helper block was moved unchanged, including equations, seed keys, clamping, comments and legacy error text. No heightfield algorithm, river routing rule, artifact shape or golden fixture changed. The generator's previously mixed line endings were normalized to its dominant CRLF style. One named-file dependency-header pass updated only these two source files.

C19 verification: 40 existing tests pass across region generation, terrain-field and river-course suites. They retain frozen anchor and burg goldens, byte-equal same-seed heightfields and civilization data, lowland/ridge invariants, cross-region seam checks, and bounds checks. Scoped typecheck reports zero errors and zero suppressed imported-file diagnostics. A fresh graph contains no generator/field emitted group. This is focused source and fixture evidence, not a new rendered terrain or live-water acceptance.
