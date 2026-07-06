# Sub-spec: Context-sized referee patch

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** BUILT (2026-07-05) — `extractLocalTerrainPatch` takes an optional `{ width, height }` and centers the player at the geometric center at any size (default stays 40×30). Props imprint their referee data (cover/blocks-sight/blocks-move) onto the patch, TDD-proven at a seeded position (`groundChunkLoader.test.ts`). The two Open questions below remain — sizing is currently caller-supplied, not yet auto-chosen by context.

## Decision
The invisible referee patch is sized at extraction by context: compact for dense town fights (short sightlines), large for open wilderness/ranged encounters — up to ~120×120 cells (600×600 ft) so longbow long range (600 ft) and all spell ranges fit. Referee data stays tiny at any of these sizes; the 2D board gains pan/zoom for large patches. Grounding numbers: 40×30 (current) = 200×150 ft; dash reaches its edge in under two turns; longbow normal range (150 ft) equals its long axis.

## Open
- The context heuristic (terrain openness? encounter type? hostile weapon ranges?).
- Extraction cost at 120×120 (measure, don't assume).
