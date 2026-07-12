---
schema_version: 1
gap_schema: project_gap_registry
project: World 3D UI
slug: world-3d-ui
status: active
status_note: "Preserved as merged_reference to avoid flattening existing gap provenance. Iteration 4 monitor pass: scoped World3D suite green 25/25; seeded Gap Log row G1 closed after bounded sweep; no open project gaps."
registry_mode: merged_reference
last_updated: "2026-07-11"
gap_count: 1
open_gap_count: 0
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/world-3d-ui/NORTH_STAR.md
tracker: docs/projects/world-3d-ui/TRACKER.md
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
# World 3D UI Gap Registry

Status: active
Last updated: 2026-06-10 (iteration 4 monitor pass: scoped World3D suite green 25/25; seeded Gap Log row G1 closed after bounded sweep â€” no open project gaps)

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`

Scope: unresolved findings for the **2Dâ†”3D transition + in-3D HUD** layer. Rendering-engine
gaps belong in `docs/projects/world3d/GAPS.md`; generation gaps in `docs/projects/worldsim-service/GAPS.md`.

Merge note (2026-06-10, D5 in `docs/projects/DECISION_BLITZ_2026-06-10.md`): this surface
now also owns all 3D entrypoint contracts (modal launch, phase transition, close/focus
policy) from the merged `three-d-modal` project. Its open items â€” global-vs-submap
entry/close/focus policy, the shared `onMove` movement contract, submap 3D launch/close
test coverage, and the CMA-G14 `Scene3D.tsx`/`PropsLayer.tsx` split route â€” remain listed
in `docs/projects/three-d-modal/GAPS.md` (merged-reference) and should be triaged into
W3DUI rows when work on them is scheduled.

| Gap ID | Status | Classification | Owner | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| W3DUI-G2 | resolved | in_scope_now | Codex | World3D transition HUD and developer inspectors | whole-game systems audit W02 | In dev mode, the fixed Agent sim launcher occupied the same lower-right hit target as the visible Atlas button, preventing pointer transition from 3D to the atlas; Town history shared the same unsafe edge lane. | Live `elementsFromPoint` trace placed `agent-sim-dev-overlay` above `hud-atlas-toggle`; `src/components/debug/AgentSimDevOverlay.tsx`; `src/components/debug/TownHistoryDevOverlay.tsx`. | A visible primary navigation control must not be pointer-inert because an optional inspector owns its hit area. | Resolved by reserving the final 220px for the World3D HUD and shifting both developer inspectors beside it. | Focused overlay tests plus rendered pointer switch to Atlas with dev mode enabled. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `merged_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
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
