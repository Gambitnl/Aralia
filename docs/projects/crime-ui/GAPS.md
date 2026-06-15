---
schema_version: 1
gap_schema: project_gap_registry
project: Crime UI
slug: crime-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-15"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: verified
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
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
project: Crime UI
slug: crime-ui
last_updated: "2026-06-15"
gap_count: 5
open_gap_count: 5
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
---
# Crime UI Gap Registry

Status: active
Last updated: 2026-06-15

Use this file for durable unresolved findings specific to Crime UI ownership.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | adjacent_follow_up | Worker B | `docs/projects/crime/TRACKER.md` | scope scan + 2026-06-15 code re-scan | No dedicated suspect/report flow implementation was found in `src/components/Crime` or `src/systems/crime` | `src/components/Crime`, `src/systems/crime`, `rg suspect\|report` output | Future UI work may assume reporting flow exists and bypass core design | Route decision to core Crime tracker; keep scope in this project as adjacency note | Decision note recorded in `docs/projects/crime` |
| G2 | active | support_needed_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan + 2026-06-15 re-verified | Fence sales dispatch `SELL_ITEM` generic action with text message; no dedicated crime transaction or heat side-effect in UI path | `FenceInterface.tsx:42-48` (dispatches `SELL_ITEM`), `actionTypes.ts:109` (SELL_ITEM type), `crimeReducer.ts` (no SELL_ITEM handler) | Core criminal consequence model (heat, notice, exposure) cannot be enforced from fence UI currently | Decide whether to keep generic action or add a `FENCE_SELL_ITEM` crime-specific action with heat/bounty side-effects | Add regression check for heat and bounty impact of fence sales |
| G3 | active | in_scope_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan + 2026-06-15 re-verified | Heist planning modal uses local cast `plan as HeistPlan & { approaches: HeistApproach[]; intelGathered: HeistIntel[] }` to enforce non-optionality on fields that are optional in the HeistPlan interface | `HeistPlanningModal.tsx:26-29` (local cast), `types/crime/index.ts:149-150` (approaches?/intelGathered? optional), `crimeReducer.ts` (SELECT_HEIST_APPROACH handler) | Fragile type boundary: cast bypasses TS null-safety; a future refactor could pass `undefined` approaches and the UI would crash silently | Narrow HeistPlan.approaches to required when plan enters planning phase, or add runtime guard in modal | Type test for plan shape in `src/state/reducers` and UI compile check |
| G4 | active | support_needed_now | Worker B | `docs/projects/crime-ui/TRACKER.md` | code scan + 2026-06-15 re-verified | Safehouse service list is hardcoded in `ThievesGuildSafehouse.tsx:17-22` (4 services with mock names/costs) while `ThievesGuildSystem.getAvailableServices()` generates authoritative service data with real economy context | `ThievesGuildSafehouse.tsx:17-22` (hardcoded array), `ThievesGuildSystem.ts:133+` (getAvailableServices with rank gates), `ThievesGuildInterface.tsx:50` (uses system for services) | Service names, rank requirements, and costs can diverge between safehouse UI and system; the safehouse component comment acknowledges "ideally fetched from ThievesGuildSystem" | Replace hardcoded array with `ThievesGuildSystem.getAvailableServices(membership.rank)` call, consistent with how `ThievesGuildInterface` already uses it | Unit or snapshot check for service list consistency |
| G5 | active | support_needed_now | Worker B | `docs/projects/crime/TRACKER.md` | code scan + 2026-06-15 re-verified | Modal visibility and heist phase lifecycle are split across `uiReducer` (TOGGLE_THIEVES_GUILD, TOGGLE_THIEVES_GUILD_SAFEHOUSE) and `crimeReducer` (heist phase actions) with implicit close-on-open assumptions (other modals close when thieves guild opens, line 135/155/202) | `uiReducer.ts:135,144-153`, `crimeReducer.ts:53-80` (START_HEIST_PLANNING), `GameModals.tsx:633-648` (lazy-loaded entry) | New UI slices cannot safely compose if visibility and plan lifecycle assumptions are undocumented; the close-other-modals pattern is repeated but not formally specified | Capture explicit modal lifecycle rules (which modals are mutually exclusive, heist planning vs. guild modal interaction) in docs before editing flow | Add acceptance check in implementation slice |

## Classification Notes

- `adjacent_follow_up`: keeps intent and avoid scope collapse, but not a direct stop condition for Crime UI.
- `in_scope_now`: required to continue any UI heist/job flow edit without type breaks.
- `support_needed_now`: needed for safe continuation but can be resolved in the next implementation slice.

## Global Routing

- Cross-project gaps currently best handled in `docs/projects/crime` are:
  - core suspect/report schema
  - heat/notice/bounty side effects for fence and bribe services

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
