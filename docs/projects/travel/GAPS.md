---
schema_version: 1
gap_schema: project_gap_registry
project: Travel System
slug: travel
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-26"
gap_count: 17
open_gap_count: 16
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/travel/NORTH_STAR.md
tracker: docs/projects/travel/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Travel Gap Registry

Status: active
Last updated: 2026-06-26

Use this file for durable unresolved findings that belong to Travel System and are too important to keep only in temporary notes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Forced march exhaustion checks are not applied during movement flow. | `src/systems/travel/TravelCalculations.ts` and TODO in `src/hooks/actions/handleMovement.ts` | Party can remain in long travel loops without fatigue risk; gameplay behavior mismatches travel rules. | Wire `calculateForcedMarchStatus` into movement progression and apply exhaustion effects. | Add assertion in movement test that 9-hour travel triggers DC 11 outcome path. |
| G2 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Navigation drift logic (`checkNavigation`) is defined but not consumed by movement loop. | `src/systems/travel/TravelNavigation.ts`, `src/hooks/actions/handleMovement.ts` TODO marker | Get-lost and reroute behavior remains unused despite available logic. | Add navigation check call in movement or travel service and apply drift direction/time penalties. | Add deterministic drift regression with seeded random in a movement-level test. |
| G3 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Cross-file behavior scan | Quick travel and regular movement time cost models differ and are not reconciled. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Inconsistent travel duration, encounter checks, and seasonal multipliers depending on path entry point. | Choose one authoritative movement-time source and update both flows. | Add integration check for 10-step quick travel against same route service call. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Code review | Transport edge cases (wagon/cart pullers, load limits) are simplified with fallback defaults. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Route realism and balance can drift when transport-based movement is added to narrative tasks. | Expand travel transport schema and validation before introducing new mechanics. | Add unit tests for vehicle with missing speed and heavy load routes. |
| G5 | not_started | adjacent_follow_up | Worker A | `src/components/Submap` | UI review | Quick travel cost currently ignores fatigue/consumption hooks despite TODO note. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems may not model cumulative cost of rapid movement. | Confirm scope; decide whether to add resource drain in this project or open dependency. | Add explicit decision note in TRACKER and tests when implemented. |
| G6 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Many small adjacent Voronoi cells collapse onto a single grid tile during target coordinates lookup. | `src/components/MapPane.tsx` (`gridTileFromWorld`) | Cell-accurate travel is impossible because coordinates are coerced to rectangular tiles. | Define Voronoi cell-based travel target lookup and route calculation. | Test that two distinct Voronoi cells on the same grid tile can be travelled to separately. |
| G7 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Map discovery status (`tile.discovered`) is tracked on rectangular grid tiles instead of Voronoi cells. | `src/components/MapPane.tsx` (`tiles` array discovery lookup) | Discovery resolution is coarse and does not match the actual rendered Voronoi boundaries. | Migrate discovery flags to a cell-native model (e.g. Set of cell IDs). | Test that traveling to a cell only discovers that specific Voronoi cell polygon. |
| G8 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Map seed generation (`deriveAzgaarSeed`) hashes coordinates of rectangular tiles. | `src/components/MapPane.tsx` (`deriveAzgaarSeed`) | Couples the iframe map loading and generation seed to the legacy grid structure. | Decouple seed generation from grid tiles; use direct seed mapping from `worldSeed`. | Test that seed derivation returns stable seed without traversing grid array. |
| G9 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Player marker (`AtlasPlayerMarker`) positioning is coupled to grid coordinates. | `src/components/MapPane.tsx` / `AtlasPlayerMarker` | Marker position snaps to grid tile centers instead of cell centroids. | Calculate player marker position based on current cell centroid coordinates (`cell.c`). | Test marker positions align correctly with actual cell centroids. |
| G10 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Compass and travel reducers only accept and track `x, y` grid updates. | `src/state/reducers/worldReducer.ts` | State updates ignore cell-level precision for travel actions. | Add cell ID tracking to movement action payloads and state models. | Unit tests verifying dispatching cell-native travel updates cell ID state. |
| G11 | not_started | support_needed_now | Codex | Map marker and discovery integration | `docs/BACKLOG.md` migration 2026-06-25 | Quest objectives and discovered-location markers need one marker model instead of separate root-backlog intent. | `docs/BACKLOG.md`; `src/utils/locationUtils.ts`; related cell-native marker rows G7-G10. | Travel owns player position, discovery precision, and marker placement; quest objective markers should not drift from discovered-location markers during the grid-to-cell transition. | Define the map-marker merge contract after or alongside G7-G10 so quest objectives can reference cell-native destinations. | Test that a quest objective marker and discovered-location marker resolve through the same map marker projection path. |
| G12 | done | integration | Codex | Maritime multimodal routing core | `docs/superpowers/plans/2026-06-25-maritime-travel-plan1-routing-core.md` backlog walk 2026-06-25 | Islands and harbor-separated landmasses needed one route that can cross land -> harbor -> sea -> harbor -> land, with segmented readout/visualization. | Maritime Plan 1; `docs/superpowers/specs/2026-06-25-maritime-travel-design.md`; `src/systems/travel/routePlanning.ts`; `src/systems/travel/multiModalRoute.ts`; `src/systems/travel/travelReadout.ts`; `src/systems/worldforge/travel/multiModalAtlasGraph.ts`; `src/systems/worldforge/fmg/ensureIslandHarbors.ts`; `src/systems/worldforge/fmg/generateWorld.ts`; `src/components/Worldforge/AtlasSvgView.tsx`; `src/components/MapPane.tsx`; `.agent/scratch/maritime-map-proof/atlas-route-proof.png`; `.agent/scratch/maritime-map-proof/generated-route-proof.png`; `.agent/scratch/maritime-map-proof/map-pane-generated-route-proof.png`; `docs/projects/naval/GAPS.md` G2-G4; `docs/projects/worldforge/GAPS.md` | Current route planning was single-mobility per trip. This pass landed the per-edge `TravelGraph.edgeMinutes` foundation, first multimodal graph slice, route segmenter, composite readout, AtlasSvgView segmented-route/harbor-marker rendering, MapPane ferry sea-preference wiring, generated-route `points` lane discovery, opt-in `ensureIslandHarbors`, and default-off MapPane `enableIslandHarbors` proof support. Rendered proof now covers controlled AtlasSvgView output, generated-atlas output, and full MapPane Travel-session output: seed `1`, Ferry selected, generated destination cell `3424`, two land segments, one sea segment, two harbor markers, one destination pin, and readout `≈ 3d 18h · 253 mi land + 31 mi sea · Danger: High`. | Core routing slice is complete. Continue follow-up maritime scope through G13-G16 and Naval G2-G4 rather than this retired plan packet. | Focused tests plus rendered MapPane Travel-session proof captured in ignored scratch. |
| G13 | not_started | support_needed_now | Codex / future agent | Maritime owned-ship travel | Maritime Plan 1 appendix migration 2026-06-25 | Owned ships are not tracked as docked travel assets, so MapPane can only expose hired Ferry, not "Your ship." | Retired maritime routing plan appendix; `src/components/MapPane.tsx`; `src/types`; `src/state`; `docs/projects/naval/GAPS.md` G2 | A player-owned vessel needs persistent dock location and travel gating before ship-based sea routes can be honest. | Add `ownedShips[{id, vehicleId, dockedPortId}]` state, enable a disabled/active "Your ship" sea preference based on dock location, and coordinate voyage start with Naval G2. | Tests proving ship option is disabled when undocked, enabled at the docked port, and sailing relocates the ship. |
| G14 | not_started | adjacent_follow_up | Codex / future agent | Maritime dock tiers and tender legs | Maritime Plan 1 appendix migration 2026-06-25 | Ports do not have dock size, and large ships do not add tender legs when they cannot berth. | Retired maritime routing plan appendix; `ensureIslandHarbors.ts`; `multiModalRoute.ts`; `MapPane.tsx`; water vehicle data | Dock size determines whether a route should berth directly or add a small tender hop, especially for owned larger ships. | Add `dockSize` to generated ports, add water vehicle `dockClass`, and insert a tender segment when a ship is too large for the dock. | Unit tests for small/medium/large dock decisions and rendered dotted tender segment proof. |
| G15 | not_started | support_needed_now | Codex / future agent | Ferry fares and affordability | Maritime Plan 1 appendix migration 2026-06-25 | Ferry routes show time/distance/danger but do not compute fare, check affordability, or deduct gold on departure. | Retired maritime routing plan appendix; `travelReadout.ts`; `MapPane.tsx`; movement click handoff; game gold state | Hired ferries should be an economic choice, not a free teleport over sea lanes. | Add `ferryFare(route)`, show fare in the readout, disable unaffordable trips, and deduct gold when the trip starts. | Tests for fare scaling, unaffordable route messaging, and gold deduction on ferry departure. |
| G16 | not_started | adjacent_follow_up | Codex / future agent | Sea danger and maritime encounters | Maritime Plan 1 appendix migration 2026-06-25 | Sea segments reuse generic route danger and do not yet feed storm/pirate/sea encounter tables. | Retired maritime routing plan appendix; `travelEncounter.ts`; `multiModalAtlasGraph.ts`; `docs/projects/naval/GAPS.md` G3 | Sea routes need their own danger scale and encounter handoff so maritime travel can become gameplay instead of only movement preview. | Add lane/coastal/open-ocean danger rules and route sea-segment encounter rolls, coordinating combat-class events with Naval G3. | Deterministic tests proving lane danger < coastal < open ocean and sea encounters hand off to the chosen encounter pipeline. |
| G17 | active | support_needed_now | Codex / future agent | Travel provisioning and route-gating | Travel provisioning spec backlog walk 2026-06-26; first provisioning slice 2026-06-26 | Long-distance travel previews do not show whether the party has enough food, and travel departure does not gate or resolve underprovisioned trips. The first pure helper slice now counts ration-days from inventory. | `docs/superpowers/specs/2026-06-25-travel-provisioning-design.md`; `docs/superpowers/plans/2026-06-25-travel-provisions.md`; `src/systems/travel/provisioning.ts`; `src/systems/travel/__tests__/provisioning.test.ts`; `src/components/MapPane.tsx`; related broad resource-drain concern in G5 | The player cannot make informed logistics choices before committing to a route, and long journeys can ignore food scarcity entirely. | Continue with daily need, trip-day, food-range, and provision-status helpers before wiring MapPane readout/gating. | `npx vitest run src/systems/travel/__tests__/provisioning.test.ts` passed 4 tests for `daysOfFood`; next proof should cover severity buckets and route preview before UI claims. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
