# 6. One water: the sea's surface is the one surface, and every other water feeds it

Date: 2026-10-09

## Status

**Accepted.** Remy's direction: "this water system should all technically be
one system ... the river water should naturally flow towards the sea and when
it gets to the sea, it's not like two different systems meet" (2026-09-29);
the Water and Land sheet's question 35 ruling, "design it first, then prove it
at a river mouth" (2026-09-29); and "we are making unnatural segmented
systems ... water should work as a single system across all implementations.
Could you add the beach and the ocean at the mouth of the river?" (2026-10-09).

## Context

Aralia has five waters that never meet (GLOBAL_GAPS GG-341): the FFT ocean
with its beach swash, the river reach with its own solver, the land page's
water, the game world's static rivers and lakes, and no sea in the game world.
Each gauntlet piece got its own scene and its own solver. Where a river meets
the sea, two systems meet with a seam in look, motion and mass.

Two facts set the shape of the decision. The ocean surface already takes
readers for things that are not the sea itself: the sea floor (`setSeabed`),
an object in the water (`setReflector`), a hull's wake (`setWake`), a foam
field (`setFoam`). And the beach swash is a 2D shallow-water grid forced at
its sea edge by the FFT sea's own height; the river reach's solver is the
same family of equations with a transmissive outflow edge.

## Decision

1. **One renderer.** WebGPU. The river scene moved to it on 2026-09-30.
2. **One surface.** The ocean surface (`oceanSurface.ts`) draws every open
   water. A new reader, `setRiver(reader)`, gives it per world point: the
   water level above mean sea level, the depth, the horizontal velocity, and
   a plume scalar (the river water's turbidity). The surface lifts its vertex
   by the level, damps the FFT displacement by the depth (the bathymetry
   module's shoal and break laws) and by the opposing current (wave action:
   a wave is blocked where the current reaches minus its group speed), and
   tints its body by the plume. With no reader set the surface is unchanged
   to the pixel.
3. **One near-field water state.** Depth and flow on a 2D shallow-water grid.
   The river solver and the beach swash solver are the same family, and both
   take the FFT sea as their sea boundary: a forced level (mean sea level plus
   the FFT height sampled on the CPU) where sea waves may enter and die
   against the current, and water may leave.
4. **One foam field.** The ocean's (`oceanFoamSources`). Every piece writes
   sources into it; nothing draws its own foam over the sea.
5. **One ledger.** The river's outflow enters the sea's book. The plume
   carries it as a momentum jet (Albertson et al. 1950: a core of about six
   widths, then a speed that falls as one over the distance, a spread of one
   in five) until the sea's own motion takes over. Nothing is clipped.
6. **Procedural terrain only.** The mouth's channel and its bar derive from
   the discharge and the sea's waves (hydraulic geometry: Leopold and Maddock
   1953), never hand-sculpted to please a judge (Remy, 2026-10-09).
7. **The proof.** One scene in the ocean viewer (`?ocean=1&extras=mouth`):
   a river runs through the beach into the sea. Accepted when GG-341's proof
   column holds: the river's flow and color carry into the sea as a plume
   that fades, sea waves run into the mouth and die against the current, one
   foam field, one water ledger, and no seam at the join. Judged against real
   river-mouth footage, asked for clip by clip (question 33's rule).

## Consequences

- The river scene keeps its own material for the upstream reach until the
  reach, too, is drawn by the one surface. That fold comes after the mouth.
- The land page's water and the game world's water join through the same
  reader contract later. The game world draws with WebGL, so it needs the
  renderer step first (GG-341 notes).
- The surface over a valley above sea level must be the river's alone: the
  FFT must damp to nothing where the depth says so, or waves will draw on a
  hillside. A test holds the join's height continuous and the FFT's share
  zero up the valley.
- One more reader in the fragment stage costs frame time. It is measured A/B
  in the same minutes, and the surface with no reader stays at 0 px.
- Hand-sculpting is the failure to watch for: any number in the mouth that
  cannot name its law is scenery, and the directive forbids it.
