# Open-Region Wilderness — Design

**Date:** 2026-06-29 (grilled out via Matt Pocock /grill-me skill; transcribed to a spec
file 2026-06-30 after a documentation audit found the decisions only lived in session
memory, not in a tracked doc)
**Status:** Design locked (grilled). Partially implementing — see "Implementation split" below.
**Program:** [Cell-native world umbrella](2026-06-29-cell-native-world-umbrella.md) — the
unbuilt "detail-altitude trickle" North Star described in
[2026-06-27-voronoi-3d-world-goal-design.md](2026-06-27-voronoi-3d-world-goal-design.md).
**Unified by:** [Stage 5 — seamless edge-crossing](2026-06-30-stage5-seamless-edges-design.md),
which implements the riskiest piece of this design (continuous height across a cell
boundary) as its seam-first vertical slice.

## Problem

Today's 3D ground is a **bounded** 3,000-ft Locale tied to one Voronoi cell, with a 256m
edge fall-off. Walking to the edge hits a wall or a load screen — there is no continuous
overland walk from one cell into its neighbour, no distant horizon, no position-driven
scenery. This was chosen as the **next build after the 2026-06-29 grilling session**,
ahead of interiors (L4) and agent sim, because Remy wants seamless walkable wilderness
most — overriding the project's usual breadth-first default for this one item.

## The 10 resolved decisions

1. **Layer seams = hybrid.** Only ONE load: 2D world map → 3D ground. Once on the ground
   it's open, no further loads.
2. **Open streaming ground** replaces today's bounded 3,000-ft Locale with its 256m edge
   fall-off. This is the unbuilt "detail-altitude trickle" North Star.
3. **Determinism = deterministic base + saved deltas — ALREADY BUILT.** Land is a pure
   function of `(seed, cell)`, recomputed identically every entry; player edits are
   stored in `state.worldforgeDeltas` and replayed. Keep it; it's what makes open-region
   possible (`groundChunkLoader.ts` `makeGroundWorld`, `legacySubmapBridge.ts`
   `getWorldforgeLocalForCell`).
4. **Streaming unit** = reuse the existing 3,000-ft Locale as the tile; prefetch the
   neighbour Locale as the player nears an edge.
5. **Priority = open-region NOW**, before interiors/agent sim.
6. **Elevation = pure function of world position** (FMG-interpolated coarse field +
   world-(x,y) noise for sub-cell detail). Seams match by construction; zero stitching
   code.
7. **Scenery (trees/rocks/ruins/creatures) = pure function of world position too** ("the
   land decides"). No per-patch dice → no duplication, no flicker, no cleanup pass.
   Towns already work this way (pinned to burg coords).
8. **Horizon = real distant vistas** — far land drawn cheap/rough, sharpening on
   approach (needs an LOD/simplified-distance system; the single most expensive render
   piece of this design).
9. **Water/edge = sea is the ship layer.** Walk to any shore; open water needs a boat —
   hands off to the existing maritime system (see project memory: maritime travel
   status). The map's outer edge is open ocean to the fog horizon — a natural bound, no
   invisible wall.
10. **Build order = thin vertical slice, seam first.** (Remy initially said "all at
    once"; reconciled to a risk-ordered slice per the no-fallback directive and the
    visual-inspection rule.) Day one: walk across a working seam on bare ground and
    **eyeball it**; then layer scenery → vistas → water.

## The one genuinely-risky claim

Making the height field continuous **across FMG cell boundaries** (within a cell it's
already fine; two different cells meeting without a cliff is the unproven claim). The
seam-first slice exists to put exactly this in front of Remy's eyes on day one.

## Implementation split

This design's 10 decisions are being delivered across two implementation efforts rather
than one — track both, not just one, when assessing "is open-region done":

- **Decisions 1–6, 9, 10 (the seam, the streaming mechanism, state/re-anchoring, water
  bound)** → [Stage 5 — seamless edge-crossing](2026-06-30-stage5-seamless-edges-design.md)
  of the cell-native-world umbrella. As of 2026-06-30 this is approved-design /
  implementing-the-seam-first-slice; S5.2 (the height-continuity fix) is the gating,
  not-yet-proven piece — see that doc's "CONFIRMED root cause" section
  (`local/generateLocal.ts:144–184`, per-local detail noise breaks cross-cell
  continuity).
- **Decisions 7–8 (position-driven scenery, distant-vista horizon/LOD)** are explicitly
  **DEFERRED** by the Stage 5 doc until after the seam is proven. **No spec or plan
  exists yet for this follow-on slice** — when Stage 5's seam lands and is eyeballed
  green, this is the next thing to design in detail (scenery placement function, LOD
  tiers/draw distance budget, asset streaming).

## Out of scope (this design)

- Interiors (L4) and agent sim — deliberately deprioritized behind this for one cycle
  only (decision 5); not abandoned.
- Anything across open water — hands off entirely to the maritime travel system
  (decision 9).
