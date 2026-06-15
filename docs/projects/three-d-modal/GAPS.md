---
schema_version: 1
gap_schema: project_gap_registry
project: Three D Modal
slug: three-d-modal
status: "merged-reference (project merged into World 3D UI per D5, 2026-06-10)"
status_note: "project merged into World 3D UI per D5, 2026-06-10"
registry_mode: merged_reference
last_updated: "2026-06-10"
gap_count: 5
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/three-d-modal/NORTH_STAR.md
tracker: docs/projects/three-d-modal/TRACKER.md
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
# Three D Modal Gap Registry

Status: merged-reference (project merged into World 3D UI per D5, 2026-06-10)
Last updated: 2026-06-10

Use this file for durable unresolved findings that genuinely belong to this project.

Merge note (2026-06-10): per D5 in `docs/projects/DECISION_BLITZ_2026-06-10.md`, forward ownership of every open gap below (entry/close/focus policy, movement contract, test coverage, CMA-G14 routing) transfers to `docs/projects/world-3d-ui`. Rows are preserved here unchanged as the merged-reference record.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | in_scope_now | Worker B | docs/projects/three-d-modal/TRACKER.md | implementation read | ThreeD modal travel callback payload contract is implicit and not centrally defined | `src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/actionHandlers.ts` | Inconsistent movement assumptions can break modal-triggered submap movement and action analytics | Define a shared callback contract and add one explicit test or code note in tracker | Add a proof line in tracker after test addition |
| G2 | in_scope_now | in_scope_now | Worker B | docs/projects/three-d-modal/TRACKER.md | test scan | Submap/ThreeD integration tests are incomplete for real component behavior | `src/components/Submap/__tests__/SubmapPane.test.tsx` | Regressions in launch and close flow may go undetected | Add shallow or contract tests for 3D open/close + overlay behavior | Confirm with a focused test run output |
| G3 | adjacent_follow_up | adjacent_follow_up | Worker B | docs/projects/GLOBAL_GAPS.md (possible) | implementation read | 3D modal UX should be aligned with World3D and battle-map UX conventions, but ownership boundaries are not documented as policy | `src/components/World3D/World3DScene.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `docs/projects/three-d-modal/NORTH_STAR.md` | Without policy, future merges may duplicate or conflict with unrelated systems | Add a shared decision note in project handoff if scope broadens to visual standards | Decision summary attached to tracker |
| G4 | adjacent_follow_up | adjacent_follow_up | Worker B | `docs/projects/GLOBAL_GAPS.md` (possible) | No single documented close/focus policy when 3D launched from global vs submap entry path | `src/components/layout/GameModals.tsx`, `src/components/Submap/SubmapPane.tsx`, `src/components/ThreeDModal/ThreeDModal.tsx` | Accessibility and nested overlay behavior can diverge | Add documented close/focus sequence and accessibility check in NORTH_STAR | Manual proof via QA notes or screen-level flow test |
| CMA-G14 | not_started | adjacent_follow_up | three-d-modal owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G14 | Code modularization audit routing | `Scene3D.tsx` (~709 lines) and `PropsLayer.tsx` (~755 lines) are large R3F-heavy files; splitting needs render verification and prop-layout parity. | `src/components/ThreeDModal/Scene3D.tsx`; `src/components/ThreeDModal/PropsLayer.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G14 | A split that moves R3F scene or prop helpers without preserving render output and prop-layout contracts can break 3D modal launch. | Accept or defer the inbound CMA-G14 route; if accepting, create a narrow split plan with render/screenshot proof. | Owner gap row exists and CMA-G14 status is updated to reflect acceptance or deferral. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `merged_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for this task to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Route cross-project items to `docs/projects/GLOBAL_GAPS.md` with a short rationale.
- Do not broaden project scope in this file while doing docs-only updates.
