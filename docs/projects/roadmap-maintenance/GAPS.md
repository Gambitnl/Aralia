# Roadmap Maintenance Gap Registry

Status: active
Last updated: 2026-06-08

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | Project handoff pass | North Star, tracker, and dashboard card schema are now aligned as one compact durable slice. | `docs/projects/PROJECT_TRACKER.md` (row exists); `docs/projects/PROJECT_CARD_SCHEMA.md`; `docs/projects/roadmap-maintenance/NORTH_STAR.md`; `docs/projects/roadmap-maintenance/TRACKER.md` | Without explicit alignment, future agents had to re-derive the same schema/ownership mapping. | Keep this row as resolved history unless the dashboard schema changes again. | Manual docs review plus `git diff --check` on the refreshed project docs. |
| G2 | not_started | support_needed_now | future agent | `docs/projects/roadmap-maintenance` + `roadmap-local` bridge | Local open-task pass | The remaining roadmap-local open items still need durable routing: task-number collision validation, full documentation categorization, queue-driven document processing, vision freshness workflow, and hybrid insights pipeline. | `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | These items are real, remain open in local evidence, and need one glance of project ownership before a fresh roadmap-local run changes anything. | Keep each item here unless a new audit proves it belongs in `docs/projects/GLOBAL_GAPS.md` or in local-only runtime state. | Re-run the open-task snapshot or audit output and confirm the same routing decision. |
| G3 | not_started | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | Evidence capture | The cross-check output files may be historical rather than fresh proof, and this docs pass should not imply otherwise. | `devtools/roadmap/ROADMAP_FEATURE_CROSSCHECK.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | Stale cross-check artifacts can cause false confidence in roadmap alignment and downstream decisions. | Treat them as historical until a new roadmap-local run refreshes the timestamps or proof summary. | Refresh the proof date or add an explicit historical note before using them as current evidence. |
| G4 | done | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | General evidence review | The durable-corpus split is now explicit: ignored `docs/tasks/roadmap` evidence stays external, while this folder keeps the stable handoff slice. | `docs/tasks/roadmap/NORTH_STAR.md`; `docs/projects/GLOBAL_GAPS.md`; `docs/projects/roadmap-maintenance/NORTH_STAR.md` | Preserving continuity without duplicating local/tooling noise is now documented instead of implied. | Keep the boundary small and promote only genuinely cross-project items to `GLOBAL_GAPS.md`. | Future iterations only need to revisit if the durable corpus boundary changes. |
| G5 | blocked | blocked_human_decision | human/product owner + roadmap maintainer | `docs/projects/code-modularization-audit` CMA-G1 | Code modularization audit routing | Roadmap visualizer/generator files are large modularization candidates, but roadmap-local evidence and review gates must be settled before code movement. | `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx`; `devtools/roadmap/scripts/roadmap-engine/generate.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G1 | Roadmap is the project discoverability surface; an unsafe split can corrupt status/routing visibility. | Keep this routing-only until roadmap-local ownership and review gate are clear. | Owner-approved split plan names proof commands and preserves node health/routing behavior. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Task cannot complete without it in this project slice. |
| `support_needed_now` | Needed for this slice to continue meaningfully, but not final ownership here. |
| `adjacent_follow_up` | Useful and related; not required to mark this pass complete. |
| `out_of_scope` | Not part of this project surface. |
| `blocked_human_decision` | Requires explicit human/owner routing choice. |
| `blocked_external_state` | Requires external tool run/state snapshot refresh not available in docs-only pass. |
| `uncertainty` | The gap is real, but exact ownership or scope boundary is still under evidence collection. |

## What to read next for continuity

1. `docs/projects/roadmap-maintenance/NORTH_STAR.md`
2. `docs/projects/roadmap-maintenance/TRACKER.md`
3. `docs/tasks/roadmap/ROADMAP-TOOL-REFERENCE.local.md` and `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`
4. `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`
5. `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` and `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`

## Notes

Open items here are evidence-driven and intentionally scoped. This is documentation maintenance; no source edits are required or expected in this pass.
