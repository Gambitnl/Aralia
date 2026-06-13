---
schema_version: 1
project: Naval UI
slug: naval-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: active
last_updated: 2026-06-05
iteration: 2
confidence: medium
evidence: docs/projects/naval-ui
gap_signal: "5 open gaps remain in the project handoff set; ShipPane is still read-only and the voyage/action surface is unresolved"
protocol: living project doc set
next_step: Resume TRACKER task U2 and confirm the ShipPane action contract before adding new controls.
agent_comments: ""
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
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Naval UI North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: Naval UI
Slug: naval-ui
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/naval-ui
Gap signal: 5 open gaps remain in the project handoff set; ShipPane is still read-only and the voyage/action surface is unresolved
Protocol: living project doc set
Next step: Resume TRACKER task U2 and confirm the ShipPane action contract before adding new controls.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Purpose And Scope

This project captures the current Naval user-facing implementation surface and keeps the UI intent distinct from core naval system work.

In scope:
- `src/components/Naval/ShipPane.tsx` inspection modal
- `src/components/layout/GameModals.tsx` modal mount path
- `src/state/reducers/uiReducer.ts` dashboard visibility and ship handoff
- `src/state/reducers/navalReducer.ts` naval action handlers used by UI
- `src/state/actionTypes.ts` naval action contracts
- `src/types/naval.ts`, `src/types/state.ts` naval/game state typing
- `src/data/naval/*`, `src/systems/naval/*` where naval UI depends on status/events data

Out of scope:
- Implementing voyage/encounter gameplay depth
- Naval combat architecture and balancing
- Route-level world movement rewiring and event loop rewrites

## Implemented State

- `ShipPane` exists as a read-only dashboard with tabs for Overview, Crew, Cargo.
- Dashboard visibility is controlled by `isNavalDashboardVisible` and renders through `GameModals`.
- `TOGGLE_NAVAL_DASHBOARD` sets transient `ship` state from `gameState.naval.activeShipId` and supports dev-mode mock injection.
- `GameState.naval` owns `playerShips`, `activeShipId`, and `currentVoyage`.
- `navalReducer` handles init/start/advance voyage, recruit crew, and active ship selection.
- `NAVAL_REPAIR_SHIP` is declared but currently has no reducer case.
- No dedicated voyage UI/controls exist in `ShipPane`; naval actions are not currently initiated from this surface.

## File Map

- `src/components/Naval/ShipPane.tsx` UI only surface (dashboard tabs).
- `src/components/layout/GameModals.tsx` modal mount point.
- `src/components/Naval/__tests__/ShipPane.test.tsx` tab rendering and close action tests.
- `src/state/reducers/uiReducer.ts` (`TOGGLE_NAVAL_DASHBOARD`).
- `src/state/reducers/navalReducer.ts` (`NAVAL_*` state transitions).
- `src/state/actionTypes.ts` naval action registry.
- `src/state/initialState.ts`, `src/state/appState.ts` naval defaults and dev mock seed points.
- `src/types/naval.ts`, `src/types/state.ts` shared types (`NavalState`, `Ship`, optional `ship`).
- `src/data/dev/mockShips.ts`, `src/data/naval/*` and `src/systems/naval/*` status/event providers used by reducers and future UI flows.

## Relationship to docs/projects/naval

Core gameplay and systems baseline already lives in `docs/projects/naval/*`.
This project only carries the UI-facing slice of that work.
- Keep gameplay coupling decisions (voyage handoff, combat bridge, event-source consolidation) in the parent project.
- Keep user-facing naval dashboard state and missing UI controls in this project.

## Next Checks For Handoff

1. Confirm whether ShipPane should stay read-only or become the naval action surface before any new controls are added.
2. Trace one practical voyage start path from movement to `NAVAL_START_VOYAGE`.
3. Confirm expected handoff contract when `VoyageState.status` becomes `Combat` or `Storm`.
4. Reconcile action contract vs reducer behavior for `NAVAL_REPAIR_SHIP`.
5. Verify whether `src/data/naval/voyageEvents.ts` and `src/data/naval/voyageEvents/index.ts` should be one canonical source for UI/state consumption.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
