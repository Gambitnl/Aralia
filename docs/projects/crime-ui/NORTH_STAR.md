---
schema_version: 1
project: Crime UI
slug: crime-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: active
last_updated: 2026-06-17
iteration: 3
confidence: high
evidence: docs/projects/crime-ui
gap_signal: "5 open gaps, all status active after 2026-06-15 evidence re-verification; 1 adjacent_follow_up (G1) and 4 active blockers (G2-G5)"
protocol: living project doc set
next_step: Resolve G4 (safehouse service source-of-truth) and G3 (heist plan type narrowing) as the most actionable in-scope gaps before adding new UI slices.
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
last_proof: 2026-06-17
workflow_gaps_reviewed: 2026-06-17
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Crime UI North Star

Status: active
Last updated: 2026-06-17

## Purpose And Scope

This project tracks UI-facing Crime features for one feature area only: Thieves Guild, safehouse, and heist interface wiring.

This is not the full crime domain implementation. Core logic, math, and bounty lifecycle remain in `docs/projects/crime/`.

## Current State (evidence-backed snapshot, verified 2026-06-15)

- The Crime UI is implemented and wired through the modal manager.
- Source evidence confirms a working flow for:
  - Thieves Guild membership and jobs (`ThievesGuildInterface.tsx`: generates jobs via `ThievesGuildSystem.generateJobs()`, dispatches `ACCEPT_GUILD_JOB`, `COMPLETE_GUILD_JOB`, `SET_AVAILABLE_GUILD_JOBS`)
  - Fence item sale flow (`FenceInterface.tsx`: dispatches `SELL_ITEM` generic action with payout ratio based on service tier)
  - Heist planning modal (`HeistPlanningModal.tsx`: approach selection and start logic, uses local cast for `approaches`/`intelGathered` non-optionality)
  - Safehouse service UI (`ThievesGuildSafehouse.tsx`: hardcoded 4-service mock list with rank gates, comment acknowledges it should use system)
- State wiring confirmed in:
  - `actionTypes.ts`: 15 crime/thieves/heist action types (SELL_ITEM, COMMIT_CRIME, TOGGLE_THIEVES_GUILD, JOIN_GUILD, ACCEPT/COMPLETE/ABANDON_GUILD_JOB, USE_GUILD_SERVICE, SET_AVAILABLE_GUILD_JOBS, START_HEIST_PLANNING, ADD_HEIST_INTEL, SELECT_HEIST_APPROACH, ADVANCE_HEIST_PHASE, PERFORM_HEIST_ACTION)
  - `crimeReducer.ts` (497 lines): full switch coverage for heist planning, guild membership fallback, job lifecycle, service dispatch
  - `uiReducer.ts`: `isThievesGuildVisible`, `isThievesGuildSafehouseVisible` toggles; close-other-modals pattern on open (lines 135/155/202)
- Modal entry/close confirmed in:
  - `GameModals.tsx`: lazy imports for `ThievesGuildInterface`, `ThievesGuildSafehouse`, `HeistPlanningModal`; conditional render at lines 633-648
- `HeistPlan` type (`types/crime/index.ts:138-153`) has `approaches?: HeistApproach[]` and `intelGathered?: HeistIntel[]` as optional fields

## Dashboard Card Schema

Project: Crime UI
Slug: crime-ui
Category: Feature/UI Projects
Status: active
Confidence: high
Evidence: docs/projects/crime-ui
Gap signal: 5 open gaps, all status active after 2026-06-15 evidence re-verification; 1 adjacent_follow_up (G1) and 4 active blockers (G2-G5)
Protocol: living project doc set
Next step: T4 - Resolve G4 (safehouse service source-of-truth) and G3 (heist plan type narrowing) as the most actionable in-scope gaps before adding new UI slices.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-15
Workflow gaps reviewed: 2026-06-15

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

## Implemented State (verified 2026-06-15)

- Modal integration is present and functional: `GameModals.tsx` lazy-loads all three Crime UI modals and renders them conditionally on `isThievesGuildVisible` / `isThievesGuildSafehouseVisible` / `activeHeist` state.
- Guild membership has a lazy default in `crimeReducer.ts:24-44` (`getGuildMembershipOrDefault`) providing a `rank 0` fallback, so membership actions have a safe path even when state is uninitialized.
- Guild jobs are generated via `ThievesGuildSystem.generateJobs()` (uses `REGIONAL_ECONOMIES` for context-aware targets), stored via `SET_AVAILABLE_GUILD_JOBS`, and accept/complete/abandon actions exist in both `actionTypes.ts` and `crimeReducer.ts`.
- Heist planning is in `crimeReducer.ts` (`START_HEIST_PLANNING`, `SELECT_HEIST_APPROACH`, `ADVANCE_HEIST_PHASE`, `PERFORM_HEIST_ACTION`) and rendered by `HeistPlanningModal.tsx`.
- Fence service dispatches `SELL_ITEM` generic action (G2); no crime-specific heat/exposure side-effect exists.
- Safehouse uses hardcoded service list (G4); `ThievesGuildInterface` correctly uses `ThievesGuildSystem.getAvailableServices()` for its service list.

## Integrations And Ownership

- This project is the UI boundary for crime systems.
- Core Crime mechanics, bounty models, and expiry/heat behavior are owned by:
  - `docs/projects/crime/NORTH_STAR.md`
  - `docs/projects/crime/TRACKER.md`
  - `docs/projects/crime/GAPS.md`
- This project should not be used to absorb general crime-system logic; it should only raise or link flow-level gaps that block UI.

## Gaps And Uncertainties (verified 2026-06-15)

- G1 (adjacent_follow_up): No suspect/report flow in `src/components/Crime` or `src/systems/crime`. Owned by `docs/projects/crime`.
- G2 (support_needed_now): Fence sales dispatch `SELL_ITEM` generic action (`FenceInterface.tsx:42-48`); `crimeReducer.ts` has no `SELL_ITEM` handler. Heat/exposure side-effects are disconnected from fence UI.
- G3 (in_scope_now): `HeistPlanningModal.tsx:26-29` uses `plan as HeistPlan & { approaches: HeistApproach[]; intelGathered: HeistIntel[] }` cast; both fields are optional in `HeistPlan` interface (`types/crime/index.ts:149-150`). Cast bypasses TS null-safety.
- G4 (support_needed_now): `ThievesGuildSafehouse.tsx:17-22` hardcodes 4 services while `ThievesGuildSystem.getAvailableServices()` is the authoritative source. Component comment acknowledges this.
- G5 (support_needed_now): Modal open/close and heist phase assumptions are split across `uiReducer` (toggle actions, close-other-modals pattern at lines 135/155/202) and `crimeReducer` (heist phase actions). Lifecycle rules are implicit.

## Active Slice Acceptance Criteria (updated 2026-06-15)

- `TRACKER.md` names T2 as done and T3 as the next active task with concrete next action and next proof.
- `GAPS.md` contains 5 real unresolved project gaps, all status `active`, with source evidence re-verified on 2026-06-15.
- `Dashboard Card Schema` frontmatter and section match the tracker and gap state.
- The next agent can resume from the project docs without needing chat context.

## Open Questions

- Should suspect/report be treated as a Crime-Core schema decision in `docs/projects/crime`, or be introduced here as UI behavior?
- Is fence sale an economy-only action or should it remain under crime notoriety contract?
- Should heist plan interfaces be normalized to avoid local cast usage and keep reducer/UI types stable?

## Next Checks

- Confirm modal entry points and action contracts with gameplay QA.
- Confirm whether suspect/report and fence transaction effects are intentional omissions or unresolved scope.
- Keep gap statuses current before enabling new heist/job implementation slices.

## Resume Path (updated 2026-06-15)

1. Read this file.
2. Read `docs/projects/crime-ui/TRACKER.md` and start from `T3` (T2 is done).
3. Read `docs/projects/crime-ui/GAPS.md` and treat `G3` (in_scope_now) and `G4` (safehouse service authority) as the most actionable implementation gaps.
4. Cross-check `docs/projects/crime/TRACKER.md` before changing shared crime-core behavior.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- keep the active gap set current before adding new UI slices
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

