---
schema_version: 1
gap_schema: project_gap_registry
project: Crafting UI
slug: crafting-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-09"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crafting-ui/NORTH_STAR.md
tracker: docs/projects/crafting-ui/TRACKER.md
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
# Crafting UI Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

Current resume priority: G3, then G2. G4, G5, and G6 remain real follow-ups, but they do not need to block the next slice unless scope expands into them.

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | active | in_scope_now | Worker | src/state/actionTypes.ts / src/state/reducers/craftingReducer.ts | docs/projects/crafting-ui/NORTH_STAR.md update | Tighten crafting action payload typing to typed quality/category unions | Reducer expects strict behavior while action type uses `quality: string`, `category: string` | Add typed action payloads in action types and align reducer callers in panels | Build passes for typecheck or bounded type-focused compile run |
| G3 | active | support_needed_now | Worker | src/systems/crafting (upstream) | docs/projects/crafting-ui/NORTH_STAR.md update | Resolve experimental damage handling contract | `src/components/Crafting/ExperimentPanel.tsx` only logs damage text | Decide whether damage should call shared HP actions and what resistance path to use | Add contract note in systems tracker or this project's gap when decision is made |
| G4 | active | adjacent_follow_up | Worker | docs/projects/crafting/ | docs/projects/crafting-ui/NORTH_STAR.md update | Reconcile UI windowing patterns | Only Alchemy bench uses `WindowFrame`; gathering and creature harvest use custom overlays | Decide if window pattern should be standardized for UX consistency | Add a follow-up in systems UI review if this remains intentional |
| G5 | active | adjacent_follow_up | Worker | src/systems/crafting | runtime scan | Keep reducer-contract proof explicit for panel flows and reducer actions | Focused Crafting UI tests now exist for the shared crafter adapter and panel selection paths, but no project-owned reducer-contract proof row names the `UPDATE_CRAFTING_STATS` typing boundary yet | Add a reducer-focused proof row when the action typing slice is taken | Add test filenames in the next tracker row with pass criteria |
| G6 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G13 | Code modularization audit routing | Alchemy bench is a large UI surface paired with a large recipe corpus. | `src/components/Crafting/AlchemyBenchPanel.tsx`; `src/systems/crafting/alchemyRecipes.ts`; `docs/projects/crafting/GAPS.md` G9 | UI extraction needs panel-flow proof and should not be mixed with recipe-corpus sharding. | Define UI-owned split boundaries and keep systems recipe ownership separate. | Alchemy bench UI proof and reducer/panel tests named before code movement |

## Classification Guide

- `in_scope_now`: blocks reliable continuation if left unresolved.
- `support_needed_now`: required so implementation decisions are safe.
- `adjacent_follow_up`: real gap, but not needed to finish the current docs-only pass.

## Routing note

- This project stays focused on UI surface continuity and contract gaps.
- Cross-project ownership of core mechanics remains in `docs/projects/PROJECT_TRACKER.md` under `Crafting System`.
- If a gap is fully accepted by systems owners, import or route it there and keep this project's status aligned.

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


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
