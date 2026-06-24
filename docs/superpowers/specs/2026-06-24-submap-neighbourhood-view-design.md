# Submap neighbourhood view + fog-of-war — design

**Date:** 2026-06-24 · **Status:** approved (brainstorming)

## Context
Today, drilling a World Forge (atlas) cell shows that one cell's submap alone, fit-to-view,
with no spatial context and no way to move sideways. The user wants the region tier to show
the drilled cell's **atlas neighbours** ringed around it, with fog-of-war: neighbours the party
has physically traveled into render their own submap; the rest are grey with basic top-level
info (biome/name). Any neighbour is clickable to recenter the view on it.

## Decisions (from brainstorming)
- **Scope:** region tier only (drill an atlas/world cell → show its atlas neighbours). The atlas
  (L0) and deeper tiers (local/town) are untouched.
- **Explored =** the party has physically traveled into that world cell. Reuse the existing
  `tile.discovered` travel flag as the signal (a world tile under an atlas cell's centroid being
  `discovered` ⇒ that atlas cell is explored). Add a dedicated visited set later only if needed.
- **Render:** contextual cluster — focus cell + neighbour cells in true relative position,
  cluster-scaled to a canonical span (so each cell's submap geometry stays healthy — the same
  fix used for the drill tiers), fit-to-view together.

## Components
1. **`systems/worldforge/submap/neighbourhood.ts`** (pure) — `buildAtlasNeighbourhood(atlas,
   focusCellId, isExplored, seedPath, opts)`:
   - neighbours = `atlas.pack.cells.c[focusCellId]`; cells = `[focus, ...neighbours]`.
   - each cell → `atlasCellToSubmapContext`; compute the cluster bounds; scale all cells to a
     canonical span around the focus centroid (`scaleCtx`).
   - per cell: `{ cellId, isFocus, explored, polygon (scaled), biome, burgName,
     model? }`; `model = generateSubmap(scaledCtx)` for focus + explored, omitted for grey ones.
2. **`components/Worldforge/NeighbourhoodSvgView.tsx`** — renders the cluster fit-to-view: focus
   submap (meshed, "you are here" ring, river/road), explored neighbours' submaps (dimmer), grey
   unexplored cells with a biome/name label; click focus interior sub-cell → drill deeper; click
   a neighbour → `onPickNeighbour(cellId)`.
3. **`MapPane`** — `handleAtlasDrill` builds a neighbourhood tier; clicking a neighbour rebuilds
   it centered there; deeper drills (sub-cell → local/town) unchanged. `isExplored(cellId)` maps
   the atlas cell centroid → world tile → `tile.discovered`.

## Testing
- `neighbourhood.test.ts`: focus + neighbours present; explored flag honoured (focus always
  explored); models present only for explored; cluster spans ~canonical; deterministic.
- `NeighbourhoodSvgView.test.tsx`: grey vs meshed by `explored`; clicking a neighbour fires
  `onPickNeighbour`.
- Headless proof: an explored + unexplored neighbourhood rendered to PNG (visual-inspection rule).
