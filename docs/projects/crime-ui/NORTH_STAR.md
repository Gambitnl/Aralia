---
schema_version: 1
project: Crime UI
slug: crime-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: complete_for_current_gap_set
last_updated: 2026-06-25
iteration: 5
confidence: high
evidence: docs/projects/crime-ui
gap_signal: "0 open gaps; G1 suspect/report routing, G2 fence transaction contract, G3 heist typing, G4 safehouse service source, and G5 modal lifecycle rules are resolved."
protocol: living project doc set
next_step: Run a fresh source-backed Crime UI scan before assigning more work.
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
  - cross_project_validation
  - unit_tests
last_proof: 2026-06-25
workflow_gaps_reviewed: 2026-06-25
compaction_status: not_needed
lifecycle_status: complete_for_current_gap_set
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Crime UI North Star

Status: complete_for_current_gap_set
Last updated: 2026-06-25

## Purpose And Scope

This project tracks UI-facing Crime features for one feature area only: Thieves Guild, safehouse, and heist interface wiring.

This is not the full crime domain implementation. Core logic, math, and bounty lifecycle remain in `docs/projects/crime/`.

## Current State (evidence-backed snapshot, verified 2026-06-25)

- The Crime UI is implemented and wired through the modal manager.
- Source evidence confirms a working flow for:
  - Thieves Guild membership and jobs (`ThievesGuildInterface.tsx`: generates jobs via `ThievesGuildSystem.generateJobs()`, dispatches `ACCEPT_GUILD_JOB`, `COMPLETE_GUILD_JOB`, `SET_AVAILABLE_GUILD_JOBS`)
  - Fence item sale flow (`FenceInterface.tsx`: dispatches `SELL_FENCED_ITEM` with payout ratio and heat based on service tier)
  - Heist planning modal (`HeistPlanningModal.tsx`: approach selection and start logic, using required `approaches`/`intelGathered` arrays)
  - Safehouse service UI (`ThievesGuildSafehouse.tsx`: reads services from `ThievesGuildSystem.getAvailableServices(membership.rank)`)
- State wiring confirmed in:
  - `actionTypes.ts`: crime/thieves/heist action types including `SELL_FENCED_ITEM`, `COMMIT_CRIME`, `TOGGLE_THIEVES_GUILD`, `JOIN_GUILD`, job lifecycle, guild services, and heist actions
  - `crimeReducer.ts`: switch coverage for heist planning, guild membership fallback, job lifecycle, service dispatch, and fence heat
  - `uiReducer.ts`: `isThievesGuildVisible`, `isThievesGuildSafehouseVisible` toggles; close-other-modals pattern on open (lines 135/155/202)
- Modal entry/close confirmed in:
  - `GameModals.tsx`: lazy imports for `ThievesGuildInterface`, `ThievesGuildSafehouse`, `HeistPlanningModal`; conditional render at lines 633-648
- `HeistPlan` type (`types/crime/index.ts`) has required `approaches` and `intelGathered` arrays.

## Dashboard Card Schema

Project: Crime UI
Slug: crime-ui
Category: Feature/UI Projects
Status: complete_for_current_gap_set
Confidence: high
Evidence: docs/projects/crime-ui
Gap signal: 0 open gaps; G1-G5 resolved for current Crime UI-owned scope
Protocol: living project doc set
Next step: Run a fresh source-backed Crime UI scan before assigning more work.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-25
Workflow gaps reviewed: 2026-06-25

## File Map

- `src/components/Crime/ThievesGuild/ThievesGuildInterface.tsx`  
  Main UI: membership rank gate, job list, active jobs, service list.
- `src/components/Crime/ThievesGuild/FenceInterface.tsx`  
  Inventory + sale flow for fence services.
- `src/components/Crime/ThievesGuild/HeistPlanningModal.tsx`  
  Plan approach selection and start logic.
- `src/components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx`  
  Safehouse service selection surface.
- `src/state/reducers/crimeReducer.ts`  
  Business logic transitions for thieves guild jobs/services/heists.
- `src/state/reducers/uiReducer.ts`  
  Modal visibility toggles for thieves guild and safehouse.
- `src/systems/crime/ThievesGuildSystem.ts`  
  Job and service generation, including service IDs for UI to show/use.
- `src/systems/crime/HeistManager.ts`  
  Heist phase and action mechanics used by planning UI.
- `src/types/crime/index.ts`  
  Heist and guild types for action contracts.

## Implemented State (verified 2026-06-25)

- Modal integration is present and functional: `GameModals.tsx` lazy-loads all three Crime UI modals and renders them conditionally on `isThievesGuildVisible` / `isThievesGuildSafehouseVisible` / `activeHeist` state.
- Guild membership has a lazy default in `crimeReducer.ts:24-44` (`getGuildMembershipOrDefault`) providing a `rank 0` fallback, so membership actions have a safe path even when state is uninitialized.
- Guild jobs are generated via `ThievesGuildSystem.generateJobs()` (uses `REGIONAL_ECONOMIES` for context-aware targets), stored via `SET_AVAILABLE_GUILD_JOBS`, and accept/complete/abandon actions exist in both `actionTypes.ts` and `crimeReducer.ts`.
- Heist planning is in `crimeReducer.ts` (`START_HEIST_PLANNING`, `SELECT_HEIST_APPROACH`, `ADVANCE_HEIST_PHASE`, `PERFORM_HEIST_ACTION`) and rendered by `HeistPlanningModal.tsx`.
- Fence service dispatches `SELL_FENCED_ITEM`; character state removes the item/pays gold and crime state raises heat.
- Safehouse uses `ThievesGuildSystem.getAvailableServices()` for its service list.

## Integrations And Ownership

- This project is the UI boundary for crime systems.
- Core Crime mechanics, bounty models, and expiry/heat behavior are owned by:
  - `docs/projects/crime/NORTH_STAR.md`
  - `docs/projects/crime/TRACKER.md`
  - `docs/projects/crime/GAPS.md`
- This project should not be used to absorb general crime-system logic; it should only raise or link flow-level gaps that block UI.

## Gaps And Uncertainties (verified 2026-06-25)

- G1-G5 are resolved for the current gap set.
- G1 suspect/report remains intentionally deferred in core Crime until an active caller needs structured reports.
- G5 modal lifecycle rules now live in `GAPS.md` under "Modal Lifecycle Rules".

## Active Slice Acceptance Criteria (updated 2026-06-25)

- `TRACKER.md` names T2-T4 as done and no current active task.
- `GAPS.md` contains 5 resolved project gaps with source-backed closure evidence.
- `Dashboard Card Schema` frontmatter and section match the tracker and gap state.
- The next agent can resume from the project docs without needing chat context and should run a fresh source scan before assigning new Crime UI work.

## Open Questions

- Which new Crime UI surface should be audited next, if any, after the current gap set has zero open gaps?

## Next Checks

- Run a fresh source-backed gap scan before enabling new heist/job implementation slices.
- Keep `SELL_FENCED_ITEM`, heist modal phase rendering, and safehouse service source assumptions covered if those flows change.

## Resume Path (updated 2026-06-25)

1. Read this file.
2. Read `docs/projects/crime-ui/TRACKER.md` and `GAPS.md`; confirm no new gap has been added.
3. Run a fresh source-backed scan before selecting more Crime UI work.
4. Cross-check `docs/projects/crime/TRACKER.md` before changing shared crime-core behavior.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- keep the active gap set current before adding new UI slices
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count


