---
schema_version: 1
gap_schema: project_gap_registry
project: "Scripts: Workflows"
slug: scripts-workflows
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 4
open_gap_count: 4
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/scripts-workflows/NORTH_STAR.md
tracker: docs/projects/scripts-workflows/TRACKER.md
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
# Scripts: Workflows Gap Registry

Status: active
Last updated: 2026-06-25

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Summary

The open docs gaps are G1 through G4. They are mirrored in `TRACKER.md` as T3 through T6 so the next agent has one queue surface instead of hunting across the packet. G2 also owns the surviving environment-variable documentation concern from the retired configuration refactor plan: `src/config/env.ts` exists, but env knobs and intentional direct `import.meta.env` exceptions need one operator-readable matrix. G3 owns the surviving workflow-drift concern from the retired development-flow improvement note. G4 owns the surviving version-bump guidance idea from the retired version-sizing concept note.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | medium | adjacent_follow_up | Worker C | confirmed | project |  | none | none | not_recorded | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh | Workflow command examples are distributed across `package.json`, `run` .cmd files, handoff docs, and this project surface, with no single canonical table. | package scripts, `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd`, `docs/portraits/race_portrait_regen_handoff.md` | Operators can use stale or duplicate launch patterns and hit avoidable runtime confusion. | Create one canonical command matrix entry point in project-owned docs and point legacy docs to it. | `Get-Content` check across project docs and `package.json` |  |
| G2 | not_started | medium | support_needed_now | Worker C | confirmed | project |  | none | none | source_checked | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh + retired config refactor plan | Runtime env-var tuning for image generation/research and app config is not normalized into one list, and intentional direct `import.meta.env` exceptions are not documented beside the central `ENV` surface. | `scripts/workflows/gemini/image-gen/*.ts`, `scripts/workflows/gemini/core/image-gen-mcp.ts`, `src/config/env.ts`, `src/config/features.ts`, `src/components/SaveLoad/SaveSlotSelector.tsx`, `src/components/BattleMap/camera/CameraController.tsx`, `src/components/BattleMap/TargetingDecals.tsx`, `docs/plans/refactors/CONFIG_REFACTOR_PLAN.md` retirement 2026-06-25 | Small env mistakes can cause brittle CDP runs, silent fallback behavior, or accidental drift between Vite-static debug flags and runtime-readable config. | Add one environment-variable matrix in project doc, include defaults from runbooks, and explicitly list the few direct `import.meta.env` call sites that are intentional because Vite must statically analyze them. | `Get-Content`/`rg` check against latest header comments, package scripts, `src/config/env.ts`, and direct `import.meta.env` call sites. | Retired `docs/plans/refactors/CONFIG_REFACTOR_PLAN.md`; the remaining direct env access is a documentation/ownership task, not evidence that central `ENV` is absent. |
| G3 | not_started | low | adjacent_follow_up | Worker C | confirmed | retired improvement note | docs/projects/roadmap-maintenance/GAPS.md G2 | none | none | source_checked | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | retired development-flow improvement note | Workflow truth surfaces exist, but there is no small project-owned reconciliation note that ties review/migration ledger discipline, roadmap-local state, verification habits, and dependency-sync reminders into one maintainable operator checklist. | Retired `docs/improvements/DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md`; root `AGENTS.md`; `docs/registry/@DOC-REVIEW-LEDGER.md`; `docs/registry/@DOC-MIGRATION-LEDGER.md`; `docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md`; `.agent/roadmap-local/tooling_state.sqlite`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md`; `docs/projects/roadmap-maintenance/GAPS.md` G2 | Agents can either skip wrap-up state updates or invent a broad automation layer. A narrow checklist should reinforce the existing control surfaces without replacing source-backed judgment. | Add a concise workflow-reconciliation reference or checklist that tells agents when to update review/migration ledgers, when to refresh roadmap-local evidence, when dependency-sync is required, and when automation must stop for human/owner judgment. | `Get-Content` check proves the checklist points to the existing ledgers, Roadmap Maintenance G2, AGENTS dependency-sync rule, and does not duplicate roadmap-local open-task ownership. | This narrows the old improvement plan to workflow discipline; roadmap-local feature work remains owned by Roadmap Maintenance G2. |
| G4 | not_started | low | adjacent_follow_up | future workflow maintainer | confirmed | retired tooling concept |  | none | none | source_checked | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | retired version-sizing concept note | Release/version-bump guidance is currently implicit; the retired concept recommended starting with simple human-readable version-bump guidelines before considering a specialized agent. | Retired `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md`; `package.json`; no existing `VERSION-BUMP-GUIDELINES.md` or SemVer workflow doc found during source search | If the project starts versioning releases more formally, agents need a lightweight policy for patch/minor/major decisions without prematurely adding automation. | Create `docs/VERSION-BUMP-GUIDELINES.md` or a Scripts: Workflows release-guidance section only when release/version decisions become active; keep the specialized review agent deferred until inconsistency is proven. | Source/docs check shows the guidance exists, is linked from the workflow docs, and does not require a per-task AI review gate by default. | This preserves the useful part of the parked concept while deleting the stale standalone note. |

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
