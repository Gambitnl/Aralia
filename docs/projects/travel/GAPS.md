---
schema_version: 1
gap_schema: project_gap_registry
project: Travel System
slug: travel
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-11"
gap_count: 21
open_gap_count: 2
resolved_gap_count: 19
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
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
Last updated: 2026-07-11

Use this file for durable unresolved findings that belong to Travel System and are too important to keep only in temporary notes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Forced march exhaustion checks are not applied during movement flow. | `src/systems/travel/TravelCalculations.ts` and TODO in `src/hooks/actions/handleMovement.ts` | Party can remain in long travel loops without fatigue risk; gameplay behavior mismatches travel rules. | Wire `calculateForcedMarchStatus` into movement progression and apply exhaustion effects. | Add assertion in movement test that 9-hour travel triggers DC 11 outcome path. |
| G2 | resolved | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Navigation drift logic (`checkNavigation`) is defined but not consumed by movement loop. | `src/systems/travel/TravelNavigation.ts`, `src/hooks/actions/handleMovement.ts` TODO marker | Get-lost and reroute behavior remains unused despite available logic. | Add navigation check call in movement or travel service and apply drift direction/time penalties. | Add deterministic drift regression with seeded random in a movement-level test. |
| G3 | resolved | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Cross-file behavior scan | Quick travel and regular movement time cost models differ and are not reconciled. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Inconsistent travel duration, encounter checks, and seasonal multipliers depending on path entry point. | Choose one authoritative movement-time source and update both flows. | Add integration check for 10-step quick travel against same route service call. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Code review | Transport edge cases (wagon/cart pullers, load limits) are simplified with fallback defaults. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Route realism and balance can drift when transport-based movement is added to narrative tasks. | Expand travel transport schema and validation before introducing new mechanics. | Add unit tests for vehicle with missing speed and heavy load routes. |
| G5 | resolved | adjacent_follow_up | Worker A | `src/components/Submap` | UI review | Quick travel cost currently ignores fatigue/consumption hooks despite TODO note. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems may not model cumulative cost of rapid movement. | Confirm scope; decide whether to add resource drain in this project or open dependency. | Add explicit decision note in TRACKER and tests when implemented. |
| G6 | resolved | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Many small adjacent Voronoi cells collapse onto a single grid tile during target coordinates lookup. | `src/components/MapPane.tsx` (`gridTileFromWorld`) | Cell-accurate travel is impossible because coordinates are coerced to rectangular tiles. | Define Voronoi cell-based travel target lookup and route calculation. | Test that two distinct Voronoi cells on the same grid tile can be travelled to separately. |
| G7 | resolved | in_scope_now | Codex | Cell-native discovery and journal handoff | Whole-game systems audit W02, 2026-07-11 contradiction audit | The prior closure removed rectangular discovery without replacing it with persisted cell discovery: `synthCellTile` hardcoded `discovered: true`, `isExploredCell` meant only land height, and atlas arrival emitted no discovery entry. | `src/components/MapPane.tsx`; `src/App.tsx`; `src/state/appState.ts`; focused MapPane/arrival tests; live journey and full save/reload proof. | Every land polygon appeared explored, travel created no once-only journal memory, and save/reload could not prove what the party actually visited. | Persisted cell IDs now drive exploration, the current cell is seeded, arrival records a deduped discovery, and repeat visits preserve one identity without restoring the retired grid. | Live discoveries `[2497,2499,2498]` remained exact and deduped after a full save/menu/reload cycle; later hostile journeys added exact cells 2761 and 2371; the current 98-test W02 travel/atlas matrix is green. |
| G8 | resolved | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Map seed generation (`deriveAzgaarSeed`) hashes coordinates of rectangular tiles. | `src/components/MapPane.tsx` (`deriveAzgaarSeed`) | Couples the iframe map loading and generation seed to the legacy grid structure. | Decouple seed generation from grid tiles; use direct seed mapping from `worldSeed`. | Test that seed derivation returns stable seed without traversing grid array. |
| G9 | resolved | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Player marker (`AtlasPlayerMarker`) positioning is coupled to grid coordinates. | `src/components/MapPane.tsx` / `AtlasPlayerMarker` | Marker position snaps to grid tile centers instead of cell centroids. | Calculate player marker position based on current cell centroid coordinates (`cell.c`). | Test marker positions align correctly with actual cell centroids. |
| G10 | resolved | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Compass and travel reducers only accept and track `x, y` grid updates. | `src/state/reducers/worldReducer.ts` | State updates ignore cell-level precision for travel actions. | Add cell ID tracking to movement action payloads and state models. | Unit tests verifying dispatching cell-native travel updates cell ID state. |
| G11 | not_started | support_needed_now | Codex | Map marker and discovery integration | `docs/BACKLOG.md` migration 2026-06-25 | Quest objectives and discovered-location markers need one marker model instead of separate root-backlog intent. | `docs/BACKLOG.md`; `src/utils/locationUtils.ts`; related cell-native marker rows G7-G10. | Travel owns player position, discovery precision, and marker placement; quest objective markers should not drift from discovered-location markers during the grid-to-cell transition. | Define the map-marker merge contract after or alongside G7-G10 so quest objectives can reference cell-native destinations. | Test that a quest objective marker and discovered-location marker resolve through the same map marker projection path. |
| G12 | done | integration | Codex | Maritime multimodal routing core | `docs/superpowers/plans/2026-06-25-maritime-travel-plan1-routing-core.md` backlog walk 2026-06-25 | Islands and harbor-separated landmasses needed one route that can cross land -> harbor -> sea -> harbor -> land, with segmented readout/visualization. | Maritime Plan 1; `docs/superpowers/specs/2026-06-25-maritime-travel-design.md`; `src/systems/travel/routePlanning.ts`; `src/systems/travel/multiModalRoute.ts`; `src/systems/travel/travelReadout.ts`; `src/systems/worldforge/travel/multiModalAtlasGraph.ts`; `src/systems/worldforge/fmg/ensureIslandHarbors.ts`; `src/systems/worldforge/fmg/generateWorld.ts`; `src/components/Worldforge/AtlasSvgView.tsx`; `src/components/MapPane.tsx`; `.agent/scratch/maritime-map-proof/atlas-route-proof.png`; `.agent/scratch/maritime-map-proof/generated-route-proof.png`; `.agent/scratch/maritime-map-proof/map-pane-generated-route-proof.png`; `docs/projects/naval/GAPS.md` G2-G4; `docs/projects/worldforge/GAPS.md` | Current route planning was single-mobility per trip. This pass landed the per-edge `TravelGraph.edgeMinutes` foundation, first multimodal graph slice, route segmenter, composite readout, AtlasSvgView segmented-route/harbor-marker rendering, MapPane ferry sea-preference wiring, generated-route `points` lane discovery, opt-in `ensureIslandHarbors`, and default-off MapPane `enableIslandHarbors` proof support. Rendered proof now covers controlled AtlasSvgView output, generated-atlas output, and full MapPane Travel-session output: seed `1`, Ferry selected, generated destination cell `3424`, two land segments, one sea segment, two harbor markers, one destination pin, and readout `≈ 3d 18h · 253 mi land + 31 mi sea · Danger: High`. | Core routing slice is complete. Continue follow-up maritime scope through G13-G16 and Naval G2-G4 rather than this retired plan packet. | Focused tests plus rendered MapPane Travel-session proof captured in ignored scratch. |
| G13 | resolved | support_needed_now | Codex / future agent | Maritime owned-ship travel | Maritime Plan 1 appendix migration 2026-06-25 | Owned ships are not tracked as docked travel assets, so MapPane can only expose hired Ferry, not "Your ship." | Retired maritime routing plan appendix; `src/components/MapPane.tsx`; `src/types`; `src/state`; `docs/projects/naval/GAPS.md` G2 | A player-owned vessel needs persistent dock location and travel gating before ship-based sea routes can be honest. | Add `ownedShips[{id, vehicleId, dockedPortId}]` state, enable a disabled/active "Your ship" sea preference based on dock location, and coordinate voyage start with Naval G2. | Tests proving ship option is disabled when undocked, enabled at the docked port, and sailing relocates the ship. |
| G14 | resolved | adjacent_follow_up | Codex / future agent | Maritime dock tiers and tender legs | Maritime Plan 1 appendix migration 2026-06-25 | Ports do not have dock size, and large ships do not add tender legs when they cannot berth. | Retired maritime routing plan appendix; `ensureIslandHarbors.ts`; `multiModalRoute.ts`; `MapPane.tsx`; water vehicle data | Dock size determines whether a route should berth directly or add a small tender hop, especially for owned larger ships. | Add `dockSize` to generated ports, add water vehicle `dockClass`, and insert a tender segment when a ship is too large for the dock. | Unit tests for small/medium/large dock decisions and rendered dotted tender segment proof. |
| G15 | resolved | support_needed_now | Codex / future agent | Ferry fares and affordability | Maritime Plan 1 appendix migration 2026-06-25 | Ferry routes show time/distance/danger but do not compute fare, check affordability, or deduct gold on departure. | Retired maritime routing plan appendix; `travelReadout.ts`; `MapPane.tsx`; movement click handoff; game gold state | Hired ferries should be an economic choice, not a free teleport over sea lanes. | Add `ferryFare(route)`, show fare in the readout, disable unaffordable trips, and deduct gold when the trip starts. | Tests for fare scaling, unaffordable route messaging, and gold deduction on ferry departure. |
| G16 | resolved | adjacent_follow_up | Codex / future agent | Sea danger and maritime encounters | Maritime Plan 1 appendix migration 2026-06-25 | Sea segments reuse generic route danger and do not yet feed storm/pirate/sea encounter tables. | Retired maritime routing plan appendix; `travelEncounter.ts`; `multiModalAtlasGraph.ts`; `docs/projects/naval/GAPS.md` G3 | Sea routes need their own danger scale and encounter handoff so maritime travel can become gameplay instead of only movement preview. | Add lane/coastal/open-ocean danger rules and route sea-segment encounter rolls, coordinating combat-class events with Naval G3. | Deterministic tests proving lane danger < coastal < open ocean and sea encounters hand off to the chosen encounter pipeline. |
| G17 | resolved | support_needed_now | Codex / future agent | Travel provisioning and route-gating | Travel provisioning spec backlog walk 2026-06-26; first provisioning slice 2026-06-26 | Long-distance travel previews do not show whether the party has enough food, and travel departure does not gate or resolve underprovisioned trips. The first pure helper slice now counts ration-days from inventory. | `docs/superpowers/specs/2026-06-25-travel-provisioning-design.md`; `docs/superpowers/plans/2026-06-25-travel-provisions.md`; `src/systems/travel/provisioning.ts`; `src/systems/travel/__tests__/provisioning.test.ts`; `src/components/MapPane.tsx`; related broad resource-drain concern in G5 | The player cannot make informed logistics choices before committing to a route, and long journeys can ignore food scarcity entirely. | Continue with daily need, trip-day, food-range, and provision-status helpers before wiring MapPane readout/gating. | `npx vitest run src/systems/travel/__tests__/provisioning.test.ts` passed 4 tests for `daysOfFood`; next proof should cover severity buckets and route preview before UI claims. |
| G18 | resolved | in_scope_now | Codex | Cell-native travel encounter handoff | Whole-game systems audit W02, 2026-07-11 source trace | Cell-native wilderness arrival announced a rolled encounter but never called `triggerTravelEncounter`; underprovisioned pending travel also dropped `encounter` and `encounterMessage` before its eventual commit. | `src/App.tsx`; `src/components/MapPane.tsx`; `src/state/__tests__/stage4AtlasTravelArrival.test.ts`; live deterministic hostile-route probes. | A hostile roll could read as danger while never starting combat, silently deleting a core travel consequence. | Every cell-native commit now retains the pre-rolled encounter and uses the shared encounter bridge after movement; peaceful arrivals remain in exploration. | A direct exact-cell trip 2499->2761 opened Wolf combat; a supply-limited trip toward 2370 halted at exact cell 2371 and opened two-Bandit combat; arrival/focused atlas suites are green. |
| G19 | resolved | in_scope_now | Codex | Ferry destination conservation | Whole-game systems audit W02, 2026-07-11 route trace | A reachable ferry-lane water cell could be picked, then `snapToLandCell` rewrote the destination to arbitrary nearby land; partial water halts repeated the snap. | `src/components/MapPane.tsx`; `multiModalAtlasGraph.ts`; live Ferry pointer proof. | A player could bypass the explicit harbor contract and teleport ashore at a non-port cell. | Ordinary destinations now require a land/port endpoint and partial halts preserve their real route cell rather than snapping ashore. | Live Ferry rejected a water lane with `Choose a land or port destination` and kept cell 2499 unchanged; a land endpoint immediately produced a valid mixed-route preview. |
| G20 | resolved | in_scope_now | Codex | Provision-limited halt horizon | Whole-game systems audit W02, 2026-07-11 route trace | Partial-stop placement interpolated by point count, not cumulative route minutes/cost, so mixed terrain and sea edges halted at the wrong supply horizon. | `src/components/MapPane.tsx`; `src/systems/travel/routePlanning.ts`; `src/systems/travel/__tests__/routePlanning.test.ts`; live underprovisioned hostile route. | The visible promise "march until supplies run out" could place the party substantially before or beyond the paid-for travel horizon. | Halt selection now walks cumulative planned edge minutes and preserves the exact last affordable cell. | On a 1670.54-minute six-cell route, one day of supplies halted at time-weighted index 4/cell 2371 after 1396.11 minutes, not destination 2370 or the vertex midpoint; focused tests are green. |
| G21 | resolved | in_scope_now | Codex | Honest transport availability | Whole-game systems audit W02, 2026-07-11 source/live trace | MapPane synthesized a mounted party when computing `availableTransports`, so every run saw `Riding horse` despite no mount state being passed from the party/inventory. | `src/components/MapPane.tsx`; `src/components/__tests__/MapPane.test.tsx`; live foot-party transport selector. | Travel speed and player choice could rely on a phantom free horse, breaking economy and route-duration truth. | MapPane now receives live party travel modes; foot remains the fallback, and horse appears only when a party member is actually mounted. | Live foot-only party exposed only `On foot`; focused rerender proof shows a mounted member adds `riding_horse`; the focused MapPane matrix is green. |

## Resolved Gap Log

**2026-07-09 cell-native audit (read-only code trace).** Nine gaps confirmed already resolved by the completed grid-retirement + Azgaar-removal work; closed with evidence:

- **G3 / G5** — the quick-travel path was retired. `QUICK_TRAVEL` is now a no-op stub (`src/state/actionHandlers.ts:148`); there is one authoritative time source (`MapPane` `travelField` → `route.minutes` → `App.tsx:727`), and rapid-movement consumption is modeled by the provisioning system (`MapPane.tsx:749 decideTravelProvision`). The `src/components/Submap/*` files these gaps cited no longer exist.
- **G6** — grid-tile collapse gone: `gridTileFromWorld` removed; picks are cell-native via `info.i` cellId + `findCellAtPoint` (`MapPane.tsx:778`).
- **G7** — discovery is cell-native: `isExploredCell(cellId)` (`MapPane.tsx:584`); comment at `:581` records "legacy grid-tile fog removed".
- **G8** — `deriveAzgaarSeed` gone; iframe retired; seed is direct `worldforgeSeed = worldSeed ?? 0` (`MapPane.tsx:284`).
- **G9** — player marker anchors on the cell site `pack.cells.p[playerAtlasCellId]` (`MapPane.tsx:369`); grid fallback removed (`:373`).
- **G10** — `MOVE_PLAYER` is cell-native in `appState.ts:703`, tracking `playerCell={cellId: dest.cellId}` (`:710`); `worldReducer` no longer handles it.
- **G13** — owned-ship travel wired end-to-end: `types/naval.ts:223 playerShips` / `:224 activeShipId`; `GameModals.tsx:446 activeShip` + `:451 onSetSail`; MapPane embark gate (`:380`) and ship branch (`:698`).
- **G17** — travel provisioning readout + gating + underprovisioned choice-flow all landed: rings (`MapPane.tsx:423`), readout (`:472`), gate (`:749`), choice flow (`:789`), applied via `App.tsx:749 applyProvisionEffects`.

**2026-07-09 — G15 ferry fares SHIPPED.** `ferryFare(route)` + tunable constants (`FERRY_BOARDING_FEE_GP=2`, `FERRY_PER_SEA_MILE_GP=0.5`, flagged for design balance) in `src/systems/travel/travelReadout.ts`; readout shows `· Fare: N gp` (ferry-only) via `AtlasSvgView`; MapPane gates affordability (`partyGold` prop) and threads `ferryFareGp` through `TravelMeta` + the underprovisioned choice flow; `App.tsx handleTileClick` deducts via `MODIFY_GOLD` on committed crossings only. Owned-ship voyages pay no fare (separate `onSetSail` path). Gate: tsc 635 (no regression), travel suite 151/151 green (travelReadout 17/17).

**2026-07-09 — G16 sea danger + maritime encounters SHIPPED.** Sea danger tiers `SEA_DANGER_LANE 0.12 < COASTAL 0.3 < OPEN 0.5` (tunable) with `classifySeaCell`/`routeSeaDanger` in `multiModalAtlasGraph.ts` (lane=on a searoute, coastal=sea cell with a land neighbor, open=all-sea neighbors); new trip-level `rollSeaEncounter` in `travelEncounter.ts` reuses the naval `SEA_ENCOUNTER_TABLE`, compounds over sea steps, scales by danger; MapPane rolls the sea table for any route with a sea cell (hostile → combat handoff "at sea", peaceful → flavor), land trips unchanged. Gate: tsc 635, travel+naval suites 181/181 green (10 new sea-trip tests). Follow-up: peaceful-outcome salvage gold + tactical naval arena stay on Naval G3.

**2026-07-09 — G1 forced-march exhaustion SHIPPED.** New pure `resolveForcedMarch(party, saveDC, rollD20)` in `src/systems/travel/forcedMarch.ts` (per-member CON save = score mod + proficiency, injected d20); `TravelMeta.forcedMarch { hours, saveDC }`; MapPane `deriveForcedMarch(seconds)` stamps all three commit sites; App `handleTileClick` rolls each member and applies party `SET_PARTY_CONDITION exhaustion` on any fail with an adventure-log line. Threshold SAFE_TRAVEL_HOURS=8, DC=10+floor(hours-8) → 9h=DC 11 (proof), 8h=none. Gate: tsc 635, travel suite 169/169 green (8 new tests). Follow-up: a per-character SET_CHARACTER_CONDITION (state-owned) would let only failing members be marked instead of party-wide.

**2026-07-09 — G2 navigation drift SHIPPED.** New pure `deriveNavDrift(terrainOf, routeCells, routePoints, survivalModifier, rng)` in `src/systems/travel/navDrift.ts` consumes the previously-dead `checkNavigation` (DMG p.111): governing terrain = hardest crossed, all-road = auto-success, off-road failure picks a drift heading != intended + a time penalty, seeded on `(worldSeed + destCell*6271 + 29)`. `TravelMeta.navDrift`; MapPane computes it for land-only trips + recomputes at the underprovisioned commit; App adds the drift seconds to `ADVANCE_TIME` and logs "You lose your way and drift <dir>…". Time-only (arrival cell unchanged — cell-native invariant preserved). Gate: tsc 635, travel suite 177/177 green (8 new tests). Follow-ups flagged: pre-existing `checkNavigation` time penalty is 1–5h not 1d6 (nextInt max-exclusive in `TravelNavigation.ts`); lost-time doesn't feed back into the forced-march DC.

**2026-07-09 — G14 dock tiers + tender legs SHIPPED (fully additive, no world-gen change).** New pure `dockTiers.ts`: `dockSizeForPort(burg)` derives small/medium/large from the EXISTING `burg.population` + `capital` flag (no new baked field; `generateWorld.ts` untouched); `dockClass` added to the four water vehicles in `types/travel.ts` (rowboat/keelboat=small, galley/warship=large); `multiModalRoute.ts` gains `SegmentKind 'tender'` + optional `tenderMiles` and emits a tender leg when a ship's dock class exceeds the destination dock (opt-in — byte-identical output with no options); MapPane passes tender options for owned ships only (hired ferries are small craft, land anywhere). Gate: tsc 635 (orchestrator made `tenderMiles` optional to keep hand-built route literals valid), travel suite 190/190 green (13 new dock-tier tests). Cosmetic follow-ups (non-owned files): AtlasSvgView dotted "tender" segment style + `travelReadout` tender/fare labels.

**2026-07-11 W02 contradiction repair and live closure.** The 2026-07-09 read-only note prematurely called G7 complete because cell-native selection existed; it did not yet persist visited-cell discovery. G7 is now genuinely closed with deduped save/reload proof. The same live campaign closed G18-G21 across direct and underprovisioned hostile encounters, water-destination rejection, time-weighted exact-cell halts, and party-owned transport choices. Focused Classic atlas, route, MapPane, and arrival coverage currently passes 98/98.

Still open (2, both design-gated): **G4** (transport schema: wagon/cart pullers + load limits — needs the mechanic introduced first); **G11** (unified quest-to-discovered marker-merge contract — needs a product decision).

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
