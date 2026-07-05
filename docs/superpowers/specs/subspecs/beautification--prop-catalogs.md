# Sub-spec: Town + wilderness prop catalogs

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** BUILT + FLIPPED 2026-07-04 — 105 definitions (all strawman rows, 16 contexts, full referee data) in `src/systems/worldforge/props/catalog.ts`. The GroundWorld placement path now draws the FULL catalog (expanded pools per context, density still governed by the same seed-chance/composition machinery — no re-explosion), and all six formerly tag-only contexts fire: tavern (business-type), wealthy-quarter (proximity proxy), gate/walls (gatehouses), ruin (hidden sites), riverbank (rivers), defile (slope). Every emitted def is render-mapped in `GroundProps.tsx` (`RENDER_VARIANT`) — no invisible referee-blockers. Verified: 27 placement + 14 bridge tests green; live-eyeballed (`.agent/scratch/fullcatalog-town.png`, `fullcatalog-wild.png`).

## Decision
Both catalogs ship in the same wave (no town-first split): town clutter (crates, barrels, carts, market stalls, wells, fences, woodpiles…) and wilderness cover (rocks, fallen logs, thickets, ruins…). Every entry carries full referee data from day one. Realism target per the art-direction decision (battle-map fidelity is the bar).

## Open
- Initial catalog list per family (aim for breadth over polish, per standing priority).
- Which entries are generator-built vs interim placeholders while owned generators mature.
