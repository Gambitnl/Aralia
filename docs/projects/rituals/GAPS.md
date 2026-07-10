---
schema_version: 1
gap_schema: project_gap_registry
project: Rituals System
slug: rituals
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-17"
gap_count: 10
open_gap_count: 10
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/rituals/NORTH_STAR.md
tracker: docs/projects/rituals/TRACKER.md
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
# Rituals System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | active | medium | execution-path | Worker A | confirmed | project |  | none | none | recorded | `Rituals System` | source scan | No live combat-to-reducer start path exists for ritual-tagged or long-cast spells outside tests. | `src/hooks/combat/useActionExecutor.ts` TODO states long casting should call `startRitual` and set character ritual state; full `src` search/regex scan found no non-test call site for `startRitual(` and no production dispatch of `START_RITUAL`/`INTERRUPT_RITUAL`/`COMPLETE_RITUAL`. | Current ritual action contract cannot execute in live cast flow until a caller is introduced. | Introduce explicit combat-to-redux ritual path or document intentional exclusion; keep event contract aligned. | Re-run scoped `src` search for `startRitual(` and ritual action types after any implementation change. | Verified 2026-06-17: no live caller found. |
| RG-2 | active | medium | typing-safety | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual event payload is untyped at the action boundary (`RitualEvent = unknown`). | `src/state/actionTypes.ts` TODO marks `RitualEvent` unknown; `src/state/reducers/ritualReducer.ts` casts `action.payload.event` to a shaped ad-hoc object instead of a shared contract. | Weak payload typing lets malformed interrupt payloads pass the action layer and silently bypass reducer safety. | Replace `RitualEvent` alias with a minimal shared interface in `src/types/rituals.ts` and import it in `actionTypes.ts` and `ritualReducer.ts`. | Typecheck should show no casts/`unknown` usage for ritual interrupt payloads. | Source-backed on 2026-06-17. |
| RG-3 | active | medium | mechanics | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Backlash, cost, and ritual consequence math are placeholders. | `src/systems/rituals/RitualManager.ts` `getBacklashOnFailure` currently returns `[]`; no ritual cost/influence fields exist in runtime state or reducers. | Failed/interrupted rituals cannot model penalties or resource semantics. | Define shared ritual cost/blowback schema and thread it through `RitualState`, manager, and reducer branches. | Add regression coverage for non-empty backlash output and ritual failure side effects. | Source-backed on 2026-06-17. |
| RG-4 | active | medium | mechanics | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Not all declared interrupt conditions are implemented in runtime checks. | `src/systems/rituals/RitualManager.ts` declares `silence`, `incapacitated`, `action`, `noise`, `distraction` but `checkRitualInterrupt` only evaluates damage, movement, and incapacitation branches; reducer only maps `'damage' | 'movement' | 'condition'`. | Schema and runtime can disagree on which events actually interrupt a ritual. | Either implement the missing branches with deterministic reason text or shrink `InterruptCondition` to the currently supported types. | Every supported interrupt type has explicit test coverage and a runtime reason string. | Source-backed on 2026-06-17. |
| RG-5 | active | medium | data-model | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual requirements are schema-bridged instead of typed through `Spell`. | `src/systems/rituals/RitualManager.ts` casts `spell` to `unknown` to reach `ritualRequirements`, bypassing the canonical `Spell` type from `src/types/spells.ts`. | Requirements can drift without compile-time safety and may fail silently at runtime. | Choose schema direction: extend `Spell.ritual` with typed requirements, map to a dedicated ritual config file, or add a type guard in `canStartRitual`. | Confirm at least one production ritual consumes typed requirements without unsafe casts. | Source-backed on 2026-06-17. |
| RG-6 | resolved | medium | data-model | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Two ritual interface files exist (`src/types/ritual.ts`, `src/types/rituals.ts`) with overlap and mixed imports. | `src/types/ritual.ts` is imported by `src/types/combat.ts` for `currentRitual`; active action/reducer/runtime paths import `src/types/rituals.ts`; both define divergent `RitualState`, `RitualConfig`, and `InterruptResult` shapes.; board-reconciled 2026: task "W3-P3: Make rituals.ts the canonical ritual type file; re-point importers (import-repoint ONLY)" — combat.ts (import re-point only, RitualState from ./rituals.js; no type shapes touched), ritual.ts (converted to thin re-export of RitualState/RitualConfig/InterruptCondition/InterruptResult from ./rituals.js). index.ts unchanged (already re-exports only ./rituals, never ./ritual). rituals.ts confirmed superset of old ritual.ts on every field (adds optional materialsConsumed/backlash/consumptionThreshold/fixedDC + wider saveType/type unions), so no consumer loses a field. Self-reviewed; matches RG-6/RG-10. | A divergent orphan copy invites serialization or reducer drift if both files evolve. | Deprecate `src/types/ritual.ts` and re-export `RitualState` from `src/types/rituals.ts`, or merge and update all importers. | Verify exactly one ritual type file is imported by all ritual-related paths after finalization. | Verified 2026-06-17: both files are live import sources. |
| RG-7 | active | medium | ui | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | No active ritual progress visualization is wired in the map/UI runtime. | `src/components/BattleMap/BattleMap.tsx` contains a ritual overlay TODO; no bindings to `state.activeRitual.progressSeconds` or ritual messages were found. | Ritual state changes are invisible to players despite reducer/messaging support. | Add minimal progress/failure/interrupt display path tied to active ritual state once a live start flow exists. | UI shows start, progress ticks, completion, and interruption signals for a ritual cast. | Source-backed on 2026-06-17. |
| RG-8 | active | medium | integration | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | Ritual cost/time/influence math is flagged in project docs but not implemented in runtime logic. | Project tracker/gap notes call for ritual economy math; `src/systems/rituals` contains no cost/influence fields or resolver actions. | Long-term ritual balancing and campaign resource planning remain undefined. | Add explicit ritual cost model and document where casting/advancement reads it. | At least one ritual consumes schema-backed cost fields in tests. | Source-backed on 2026-06-17. |
| RG-9 | active | medium | execution-path | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | `START_RITUAL`/`ADVANCE_RITUAL`/`INTERRUPT_RITUAL`/`COMPLETE_RITUAL` are defined but never dispatched in production code. | Codebase scan found action types declared in `src/state/actionTypes.ts` but no production dispatch call sites for those ritual actions; only `ADVANCE_TIME` reaches `ritualReducer` via `src/state/reducers/worldReducer.ts`. | Ritual reducer is reachable only through implicit world-time advancement; explicit ritual transitions remain unreachable. | Decide whether these actions should be emitted from a future ritual flow, or whether they should be removed/redirected to avoid dead contracts. | Tracker row reflects the chosen contract direction before implementation resumes. | Verified 2026-06-17 via regex scan for action types outside tests. |
| RG-10 | resolved | medium | data-model | Worker A | confirmed | project |  | none | none | not_recorded | `Rituals System` | source scan | `src/types/ritual.ts` is imported as the live `currentRitual` contract for combat characters while `src/types/rituals.ts` owns the runtime ritual schema. | `src/types/combat.ts` imports `RitualState` from `./ritual.js`; `src/types/index.ts` re-exports both files; the duplicate definitions diverge on `RitualBacklash`, `consumptionThreshold`, and interrupt type coverage.; board-reconciled 2026: task "W3-P3: Make rituals.ts the canonical ritual type file; re-point importers (import-repoint ONLY)" — combat.ts (import re-point only, RitualState from ./rituals.js; no type shapes touched), ritual.ts (converted to thin re-export of RitualState/RitualConfig/InterruptCondition/InterruptResult from ./rituals.js). index.ts unchanged (already re-exports only ./rituals, never ./ritual). rituals.ts confirmed superset of old ritual.ts on every field (adds optional materialsConsumed/backlash/consumptionThreshold/fixedDC + wider saveType/type unions), so no consumer loses a field. Self-reviewed; matches RG-6/RG-10. | `CombatCharacter.currentRitual` may drift from the runtime `RitualState` contract used by reducers and manager code. | Route `CombatCharacter.ritual` typing to the canonical `rituals.ts` file or re-export a single shared ritual type from a shared entry point. | Run `tsc --noEmit`/typecheck and confirm one canonical ritual type path across combat, state, and systems. | Verified 2026-06-17: combat imports `ritual.ts` while system code uses `rituals.ts`. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
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
