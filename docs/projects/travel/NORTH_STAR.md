---
schema_version: 1
project: Travel System
slug: travel
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-26
iteration: 3
confidence: high
evidence: "docs/projects/travel/TRACKER.md; docs/projects/travel/GAPS.md"
gap_signal: "16 open gaps; cell-native travel integration gaps (G6-G10), travel core gaps (G1-G5), marker merge G11, maritime follow-ups G13-G16, and provisioning G17 active with first helper slice; G12 done"
protocol: living-project
next_step: "Continue follow-up maritime scope through G13-G16 or return to cell-native travel gaps G6-G10."
agent_comments: "Upgraded existing travel project to own cell-native travel path per D2."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
last_proof: 2026-06-15
workflow_gaps_reviewed: 2026-06-15
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: no
---
# Travel System North Star

Status: active
Last updated: 2026-06-26

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Travel System |
| Slug | travel |
| Category | active project |
| Status | active |
| Confidence | high |
| Evidence | docs/projects/travel/TRACKER.md; docs/projects/travel/GAPS.md |
| Gap signal | 16 open gaps; cell-native travel integration gaps (G6-G10), travel core gaps (G1-G5), marker merge G11, maritime follow-ups G13-G16, and provisioning G17 active with first helper slice; G12 done |
| Protocol | living-project |
| Next step | Continue follow-up maritime scope through G13-G16 or return to cell-native travel gaps G6-G10. |
| Required verification | docs_consistency, scoped_tests |
| Completed verification | docs_consistency |
| Last proof | 2026-06-15 |
| Workflow gaps reviewed | 2026-06-15 |

## Why This Project Exists
Movement, travel pathfinding, and map discovery are coupled to a legacy rectangular 2D tile grid. This project exists to migrate travel, movement, and tile discovery off the rectangular grid and onto Azgaar's actual Voronoi cells.

## Intended Outcome
Cell-native travel where the cell selected on the map, the cell traveled to, and the cell that gets "discovered" are the same Azgaar-generated Voronoi cell. This avoids grid-centroid coordinate collapse and enables high-fidelity movement/pathfinding matching the Azgaar world map's actual layout.

## Current State
- The Azgaar world map ([MapPane.tsx](file:///F:/Repos/Aralia/src/components/MapPane.tsx)) embeds Azgaar FMG in an iframe with a bridge object `window.__araliaAzgaar` (`getTransform`, `setCellsLayer`, `getCellPolygonAt`, `describeCell`).
- In Travel mode, the cell under the cursor is highlighted with a reddish Voronoi polygon, and clicking travels via `onTileClick(x, y, tile)`.
- **The Grid Gap**: Travel still ultimately resolves to a rectangular Aralia grid tile. `gridTileFromWorld` maps the hovered Voronoi cell's centroid to `mapData.tiles[y][x]` using `gridSize.cols/rows` (~60x40). Travel "snaps" to a cell's centroid tile, but movement/discovery remain grid-based.
- **Consequence**: Many small adjacent Voronoi cells (Azgaar has ~10k) collapse onto one grid tile, making cell-accurate travel impossible.
- **Wired Systems**:
  - Core travel math is in `src/systems/travel/TravelCalculations.ts` with tests.
  - Navigation check logic is in `src/systems/travel/TravelNavigation.ts` with tests.
  - Runtime movement handling is in `src/hooks/actions/handleMovement.ts`.
  - Quick travel pathfinding is in `src/components/Submap/useQuickTravel.ts`.

## Active Task

| Field | Value |
|---|---|
| Task | Spike a Voronoi-cell-keyed travel/discovery model behind the existing grid. |
| Acceptance criteria | 1. Introduce cell-native position storage and discovery representation in state.<br>2. Wire cell ID (`cellId`) into the travel action payload.<br>3. Keep existing grid-based travel and discovery checks passing without regression. |
| Allowed boundaries | `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `docs/projects/travel/` |
| Stop condition | Cell-keyed model is spiked behind the scenes with zero behavior change; tests and types build cleanly. |
| Verification | `npm run test` and `tsc --noEmit` checks |
| Owner | Worker A |
| Next action | Create the spike implementation of cell-native fields in State and Actions. |

## Scope Boundaries

### In scope:
- Re-routing travel selection, target resolution, and path movement off rectangular grid tiles onto Azgaar Voronoi cells.
- Cell-native discovery flags (cell-level discovery tracking in state).
- Decoupling map seed generation (`deriveAzgaarSeed`) from grid tiles.
- Positioning the player marker (`AtlasPlayerMarker`) relative to cell centroids (`cell.c`).
- Adapting compass and travel reducers to support cell IDs.

### Out of scope (Owned by "grid + submap retirement" project):
- Retiring the legacy grid and Submap surfaces.
- Making Azgaar the canonical 2D world model.
- Deleting legacy `MapData.tiles` array or its rendering layers (these must act as compatibility layers).
- Retiring the Submap pane.

## What Must Not Be Lost
- **Adapter Preservation (Option B)**: Keep the legacy grid tiles intact as a fallback/compatibility layer during migration. Do not remove grid fields until all dependencies are verified.
- **Seed Consistency**: Ensure `deriveAzgaarSeed` or its replacement remains stable and doesn't break map loading.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| G1: Forced march status not applied in runtime. | adjacent_follow_up | Worker A | `TravelCalculations.ts`, `handleMovement.ts` | Wire forced march checks in movement loop. |
| G2: Navigation drift not consumed in movement. | adjacent_follow_up | Worker A | `TravelNavigation.ts`, `handleMovement.ts` | Wire navigation drift in movement handler. |
| G3: Cost model mismatch between quick travel and movement. | adjacent_follow_up | Worker A | `useQuickTravel.ts`, `travelService.ts` | Define unified cost contract. |
| G4: Transport edge cases simplified. | adjacent_follow_up | Worker A | `TravelCalculations.ts` | Expand vehicle/load contracts. |
| G5: Quick travel fatigue ignored. | adjacent_follow_up | Worker A | `SubmapPane.tsx` | Wire resource drain to quick travel. |
| G6: Grid-resolution limit (Voronoi centroid-grid collapse). | in_scope_now | Worker A | `MapPane.tsx:458` (`gridTileFromWorld`) | Re-root travel target resolution to Voronoi cells. |
| G12: Maritime multimodal routing core complete. | integration | Codex | Maritime Plan 1, `routePlanning.ts`, `multiModalAtlasGraph.ts`, `ensureIslandHarbors.ts`, `generateWorld.ts`, `multiModalRoute.ts`, `travelReadout.ts`, `AtlasSvgView.tsx`, `MapPane.tsx`, `.agent/scratch/maritime-map-proof/map-pane-generated-route-proof.png` | Done; future maritime work lives in G13-G16. |
| G7: Cell-native player discovery tracking. | in_scope_now | Worker A | `MapPane.tsx` (`tile.discovered`) | Map discovery states to Voronoi cell IDs. |
| G8: Decoupling map seed generation (`deriveAzgaarSeed`) from grid tiles. | support_needed_now | Worker A | `MapPane.tsx:67` | Derivation of map seed directly from world seed. |
| G9: Cell-native Atlas player marker positioning. | in_scope_now | Worker A | `MapPane.tsx` / `AtlasPlayerMarker` | Render player marker at cell centroid. |
| G10: Compass and travel reducers coupling to grid coords. | in_scope_now | Worker A | `worldReducer.ts` | Add cell ID tracking to travel reducers. |
| G13: Owned ship as tracked travel asset. | support_needed_now | Codex / future agent | `MapPane.tsx`, Naval G2 | Add owned-ship state and "Your ship" sea preference gating. |
| G14: Dock tiers and tender legs. | adjacent_follow_up | Codex / future agent | `ensureIslandHarbors.ts`, `multiModalRoute.ts` | Add dock size, dock class, and tender segment proof. |
| G15: Ferry fares and affordability. | support_needed_now | Codex / future agent | `travelReadout.ts`, `MapPane.tsx`, gold state | Add fare calculation, unaffordable messaging, and gold deduction. |
| G16: Sea danger and maritime encounters. | adjacent_follow_up | Codex / future agent | `travelEncounter.ts`, Naval G3 | Add sea danger bands and encounter handoff. |
| G17: Travel provisioning and route-gating. | support_needed_now | Codex / future agent | `docs/superpowers/specs/2026-06-25-travel-provisioning-design.md`, `docs/superpowers/plans/2026-06-25-travel-provisions.md`, `src/systems/travel/provisioning.ts`, `MapPane.tsx`, `src/systems/travel` | First helper slice landed (`daysOfFood`); continue with food range math, route-hover shortfall readout, atlas affordance, and underprovisioned departure choices. |

## Global Gap Imports
No global gaps imported during this pass.

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| MapPane iframe integration | Map click/hover maps to Voronoi cells via iframe bridge | `src/components/MapPane.tsx` |
| Travel calculations | Core travel math and cost equations exist | `src/systems/travel/TravelCalculations.ts` |
| Movement action handler | Movement actions are processed on grid coordinates | `src/hooks/actions/handleMovement.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project/global gap routing | active |
| `docs/projects/travel/TRACKER.md` | Active task and gap routing slice tracking | active |
| `docs/projects/travel/GAPS.md` | Durable gap registry for travel scope | active |
| `docs/projects/travel/DECISIONS.md` | Log of durable project decisions | active |
| `docs/projects/travel/COLD_START_AGENT_PROMPT.md` | Next agent handoff instructions | active |

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| How will cell-native discovery states be persisted in save files? | Save/load compatibility and file size limits | Worker A | Discovery phase |
| What adapter contract will translate Voronoi cell coordinates for 3D world markers? | Seamless 2D-to-3D transition | Worker A | 3D transition phase |

## Resume Path For A Cold Agent
1. Read this file.
2. Read `docs/projects/travel/TRACKER.md` and `docs/projects/travel/GAPS.md`.
3. Check `src/components/MapPane.tsx` to understand the iframe bridge operations.
4. Continue with Task T4: Spike cell-native model behind the existing grid.

## Cold-Start Gap Routing
The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
