# Handover: Styled procedural town architecture (gates, gatehouses, decks, roof variety)

## Status: DONE — built, tested, visually verified (two small eyeballs open, below). Left in tree (2am snapshots).

## What this was
Canonical-town deferred follow-up #1, expanded by Remy's direction to a full
architecture-style pass. Spec: `docs/superpowers/specs/2026-07-01-styled-town-architecture-design.md`.
Plan (all 9 tasks executed): `docs/superpowers/plans/2026-07-01-styled-town-architecture.md`.

## What landed
1. **Style families** — `src/systems/worldforge/town/architectureStyle.ts`: 5 families
   (highlandStone, coastalTimber, riverHalfTimber, roughLog, temperateFrame) keyed off the
   FMG culture TYPE (`getBurgCultureType` in `legacySubmapBridge.ts`; throws, no fallback).
   Per-plot picks hash the polygon centroid **normalized to the plan footprint bbox**
   (`styleFrameOf`) so the 2D normalized frame and the 3D feet frame pick IDENTICAL colors.
2. **Style stamping** — `toArtifactPlan(plan, burgId, family?)` stamps optional
   `wallColorHex`/`roofColorHex`/`roofForm` on every plot; plot IDs/footprints untouched
   (business-binding regression still green). `canonicalArtifactTownForSite` returns
   `AdaptedTownPlan & { family }`. Demo paths pass `temperateFrame` explicitly.
3. **Road gates** — `splitWallRingAtGates` now takes per-gate radii; the wall ring opens at
   `walls.gatehouses` (4 m half-gap) in addition to water gates. Streets pass through.
4. **Gatehouses** — `src/systems/world3d/gateGeometry.ts`: twinTowers / tunnelBlock /
   singleTower models at each road gate, style-tinted, taller than the rampart; carried via
   `GroundWorld.gatehouses` → `ChunkData.gatehouses` → `ChunkMeshBundle.gates` → `GatePiece`.
5. **Walls tinted** — `wallGeometry` emits per-vertex colors from the family's wallTint.
6. **Deck detail** — `deckGeometry`: pilings under docks/bridges, railings, parabolic bridge
   arch (railings follow the arch — flat rails would clip; fixed during review), driven by
   `family.deckDetail` stamped in `canonicalTownWaterAndDecks`.
7. **Styled buildings** — `src/systems/world3d/buildingModels.ts` roof forms
   (gable/steep/flat-parapet/hip) + chimneys; `SiteBuilding` uses a cached BufferGeometry per
   (form, dims). **Fixed latent bug:** role was inferred by sniffing exact colorHex values —
   now an explicit `role` field end-to-end (sniff kept only as legacy tail).
8. **2D parity** — `TownPlanView` takes `styleFamily`; MapPane resolves it from the burg's
   culture; both preview surfaces pass temperateFrame. Same hash → same color both sides.
9. **Dev shoot hook** — `World3DDemo` ground mode accepts `&wfseed=` (default 42).

## Verification (2026-07-02)
- Suite (town/bridge/world3d/Worldforge/MapPane/roster): 1088/1091 — the 3 fails are
  documented noise (stale scratch copy; pre-existing townEngine dock-pier fail-at-HEAD;
  MapPane load-flake that passes 14/14 in isolation).
- `tsc --noEmit`: zero errors in touched files (470 pre-existing elsewhere).
- 2D↔3D identity proof re-run + eyeballed (`.agent/scratch/town-identity-proof.png`) — holds.
- Live 3D eyeballs (`.agent/scratch/styled-*.png`, seed 99 via `&wfseed=99`):
  river "Ifrawt Me" (gx7,gy7), coastal "Anongu" (gx11,gy8), temperate "Tengriyula" (gx21,gy10),
  docks-town "Manim" (gx5,gy9) — three visibly distinct palettes/roofscapes, gable/steep/hip
  mixes, wall rings with gate gaps + gatehouse structures, roads passing through.
- Probe scripts: `.agent/scratch/findStyledTowns.mts` (SEED env), `findDeckTown.mts`,
  `seedCultureScan.mts`, `findHighland.mts`.

## Open eyeballs (small)
1. **Dock/bridge detail close-up** — PARTIALLY closed 2026-07-02 (autonomous follow-up):
   built a pose-driven capture (`.agent/scratch/shootDocks.mjs`, uses the scene's
   `window.__wf3dSetPose` dev hook + `deckCoords.mts` for targeting) and verified the deck
   DATA end-to-end in node (`deckColorProbe.mts`): Manim's 3 docks carry the exact dock
   timber color (0.353/0.227/0.133 = #5a3a22), `detail` stamped (spacing 3, railing, arch 1.5),
   colors parallel positions, gates + wall tints present in the same chunk bundle. Captures
   (`styled-docks-closeup2/-fromwater.png`) show the channel, wall + pale gatehouse; the deck
   slabs themselves are dark-timber-on-dark-channel at topY 0.4 m — very low visual contrast
   from any distance. VERDICT: geometry+color proven by data; a true pilings close-up needs an
   in-game walk-up, and consider a contrast/polish pass (lighter deck rim or lighter water)
   so quays read at overview distance. (A concurrent agent's in-flight `generateRegion.ts` edit
   briefly broke the probes; re-ran clean afterwards — Manim: 3 dark-timber docks + 3 pale
   gatehouses [1 twinTowers + 2 tunnelBlock, wall tint #a09680], all data-verified.)
2. **Highland family live** — NO Highland burg lands in a ground window as a town site in any
   scanned seed (42/7/99/123/1234/2026): mountain burgs seem to never yield region townSites.
   highlandStone renders only via unit tests so far. This smells like a systemic
   region-generation gap (mountain towns missing from 3D), worth its own look.

## Guardrails (unchanged)
- Keep World3DWrapper + groundTowns on `canonicalArtifactTownForSite` (regression test guards).
- Re-run `townIdentityProof.mjs` after any town change.
- Master only; leave work uncommitted.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/plans/2026-07-02-styled-town-architecture-HANDOVER.md","sha256WithoutMarker":"bfa10b80cdd9ad19aa1e6baaf8765cf63b855b2c40a9599b9eeb444e7370c9f7","markedAtUtc":"2026-08-09T20:24:24.654Z"} -->
