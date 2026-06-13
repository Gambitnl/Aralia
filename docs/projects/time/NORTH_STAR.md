---
schema_version: 1
project: Time
slug: time
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-12
iteration: 2
confidence: unknown
evidence: "docs/projects/time/TRACKER.md; docs/projects/time/GAPS.md"
gap_signal: 4 open gaps; world-time semantics, timestamp ordering, seasonal scope, and rest-boundary checks remain open
protocol: living-project
next_step: Resume from TRACKER.md and keep the gap log aligned.
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
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-05
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Time System North Star

Last updated: 2026-06-12
Status: active

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Time |
| Slug | time |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/time/TRACKER.md; docs/projects/time/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Purpose and Scope

Document the implemented Time System boundary so a new contributor can resume safely.
Time is advanced through a single action contract (`ADVANCE_TIME`) and then routed
through shared reducers/systems. This project keeps the current scope, wiring, and
open gaps explicit without inventing new mechanics.

## Implemented State

- Canonical clock in state: `gameTime` (UTC `Date`) plus `shortRestTracker`.
- Primary progression path: handlers dispatch `ADVANCE_TIME`; `worldReducer` owns the
  state transition and downstream triggering.
- Seasonal / calendar support is split:
  - `CalendarSystem` handles textual/calendar outputs and holiday/moon data.
  - `SeasonalSystem` handles movement/resource modifiers.
- Passives exist but are gated (non-combat/eligible UI state).

## File Map

- `src/state/actionTypes.ts`  
  `ADVANCE_TIME` and related rest payload contracts.
- `src/types/state.ts`  
  `gameTime`, `shortRestTracker` types.
- `src/initialState.ts`  
  default `gameTime` and rest tracker seeding.
- `src/state/reducers/worldReducer.ts`  
  canonical handler for `ADVANCE_TIME`, day boundary processing, and downstream hooks.
- `src/state/reducers/ritualReducer.ts`  
  ritual time consumption from the same progression path.
- `src/utils/core/timeUtils.ts`  
  time math, formatting, season/date helpers.
- `src/utils/core/timekeeperUtils.ts`  
  passive tick gating conditions.
- `src/systems/time/CalendarSystem.ts`  
  calendar/moon/holiday helpers and tests.
- `src/systems/time/SeasonalSystem.ts`  
  movement and forage seasonal modifiers and tests.
- `src/hooks/actions/handleMovement.ts`  
  movement + quick-travel step advancement.
- `src/hooks/actions/handleResourceActions.ts`  
  long rest and short rest advancement.
- `src/hooks/actions/handleObservation.ts`  
  inspection time advancement.
- `src/hooks/actions/handleOracle.ts`  
  oracle action advancement.
- `src/hooks/actions/actionHandlers.ts`  
  `wait` action dispatch path into `ADVANCE_TIME`.
- `src/App.tsx`  
  passive clock tick loop and combat/round explicit ticks.
- UI surfaces:
  - `src/components/CompassPane/index.tsx`
  - `src/components/Town/PassTimeModal.tsx`
  - `src/components/ui/TimeWidget.tsx`
  - `src/components/Submap/useQuickTravel.ts`
  - `src/components/Submap/useDayNightOverlay.ts`

## Integration Path

1. UI or action handler computes elapsed seconds.
2. `dispatch(ADVANCE_TIME, { seconds })` occurs.
3. `worldReducer` updates `gameTime`, normalizes `shortRestTracker`, and calls:
   - ritual/world-event processing
   - underdark processing and other day-bound systems when a day boundary is crossed.
4. Derived displays and systems read the updated clock (`TimeWidget`, overlays,
   quick travel modifiers, scheduling consumers).

## Concrete Gaps and Uncertainties

- Canonical world-time model is not abstracted beyond `Date` fields (calendar semantics are UTC/Gregorian-based).
  Evidence: `src/utils/core/timeUtils.ts`, `src/systems/time/Time_Ralph.md`.
- Day-boundary and timestamp ordering between `worldReducer` and `ritualReducer` is implicit in places.
  Evidence: `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts`.
- Seasonal mechanics exist but are not consistently consumed by all simulation systems.
  Evidence: `src/systems/time/SeasonalSystem.ts`, `src/hooks/actions/handleMovement.ts`.
- Rest flow is implemented, but edge-case transitions still need guard-focused regression coverage.
  Evidence: `src/hooks/actions/handleResourceActions.ts`, `src/types/state.ts`, `src/state/reducers/worldReducer.ts`.

## Next Checks

- Add/confirm day-boundary + ritual completion regression coverage in `worldReducer` tests.
- Add a small contract test for passive tick gating (`shouldPassiveGameClockRun`) and `ADVANCE_TIME`.
- Decide whether to formalize a domain-time contract note before balancing work expands calendar-dependent logic.

## Resume Sequence

1. Read this file.
2. Read `docs/projects/time/TRACKER.md`.
3. Read `docs/projects/time/GAPS.md`.
4. Verify with `src/state/reducers/__tests__/worldReducer.test.ts`
   and `src/utils/core/__tests__/timeUtils.test.ts`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
