# Region Terrain (L1 drilldown)

Verified: 2026-08-18

How the L1 region terrain — the heightfield that carries the 3D ground inside a
25,000 ft region window — is generated NOW.

## The heightfield is the region composite

`generateRegion` (src/systems/worldforge/region/generateRegion.ts) produces the
`RegionArtifact.heightfield` from `buildWindowComposite`
(`regionCompositeField.ts`) — the region-weighted composite height field QA'd as
`region-terrain` (crest lines, valleys, drainage networks, plain structure).
Wired in on 2026-08-18 by Remy call, replacing the old IDW + FBM + ridge stack
(`generateHeightfield`, removed). The standing decision "NOT WIRED" recorded in
`public/visual-quality/verdicts/region-terrain.json` was lifted after the
mountain flank-streak artifact (task d7b60572) was fixed in the composite.

Same day (task b25cfbde): the composite is fed the atlas erosion bake
(`bakeAtlasErosion` — per-cell rock hardness + discharge), memoized once per
atlas object inside `generateRegion` (`erosionBakeFor`). Channels now vary with
real flow and rock competence instead of the uniform reference width — closing
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

1. **Settlement dry-land floor** — a per-Locale town pad (only when entering a
   settlement via `windowCenterPx`), lifting the burg center above the
   waterline so coastal towns don't flood.
2. **Water cap** — any sample reading below the waterline (0.2) is capped at
   0.19. The composite keeps ocean low by itself (water regions get ~0.01–0.03
   surface; drainage/erosion are gated off below the line), so this is
   belt-and-suspenders only.

Both are pure functions of world position + the floor anchor, so the seam
contract holds: two adjacent regions read bit-equal values at shared world
points (mask kernels exactly 0 at the radius, ascending-id summation,
world-feet operators, window origin snapped to the global lattice).

## Rivers still route on the window-independent sampler

`generateRiverBanks` routes courses against `makeAtlasNaturalHeight`
(`regionTerrainField.ts`) — a pure point sampler with its own relief stack —
because a course must be generated from the FULL unclipped river and only
clipped afterward. Since 2026-08-18 the grid terrain is the composite, so the
routing surface and the shipped surface are different fields (they share the
8,000 ft macro wavelength by design). The carved channel (0.04 deep) still
renders; a course that disagrees with the composite's local drainage is a known
divergence, surfaced as a gap.

## What is NOT wired yet

- River routing on the composite's own point sampler (`CompositeHeightField.sample`)
  (the bake is wired since 2026-08-18, task b25cfbde).

## Perf

The composite costs roughly 0.7–0.8 s per window at 250×250 @ 100 ft. Region
generation is on-demand (atlas click, seam streamer), so this is a visible
hitch, not a background cost. The erosion bake adds a few tens of ms once per
atlas (memoized; the first window of an atlas pays it).
