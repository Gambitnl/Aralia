# Roadmap Maintenance Gap Registry

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | Project handoff pass | Project-level schema/ownership alignment is incomplete between `PROJECT_TRACKER.md` and this living project surface. | `docs/projects/PROJECT_TRACKER.md` (row exists); `docs/tasks/roadmap/` docs; `package.json` scripts | Without explicit alignment, future agents may read contradictory or partial state. | Complete `NORTH_STAR.md`/`TRACKER.md` as durable canonical alignment and confirm row-level evidence mapping. | `TRACKER.md` task `T2` marked done and `NORTH_STAR.md` evidence table updated. |
| G2 | not_started | support_needed_now | future agent | `docs/projects/roadmap-maintenance` + `roadmap-local` bridge | Local open-task pass | Task-number collision validation and queue-driven one-doc flow remain open and project-unowned in this folder. | `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md` | These are operationally real gaps that affect roadmap health but currently live only in local evidence files. | Decide whether each belongs here, `docs/projects/GLOBAL_GAPS.md`, or `ROADMAP`-local internal state and move/update accordingly. | `PROJECT_TRACKER.md` row updated only for cross-project gaps after routing. |
| G3 | not_started | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | Evidence capture | Cross-check output files may be stale if not regenerated with the current repo state. | `devtools/roadmap/ROADMAP_FEATURE_CROSSCHECK.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | Stale cross-check artifacts can cause false confidence in roadmap alignment and downstream decisions. | Add an explicit freshness rule: regenerate if older than the latest local roadmap run referenced by local state. | Add timestamp check + update note before using values as current proof. |
| G4 | in_progress | uncertainty | future agent | `docs/projects/roadmap-maintenance` | General evidence review | Scope split between ignored `docs/tasks/roadmap` evidence and live tooling docs is clear, but which docs must remain durable here versus `docs/tasks/roadmap` for continuity is partially uncertain. | `docs/tasks/roadmap/NORTH_STAR.md`; `docs/projects/GLOBAL_GAPS.md`; `docs/tasks/roadmap` | Preserving continuity without duplicating local/tooling noise remains a judgment call; must not overfit with unverified claims. | Keep this uncertainty explicit in `NORTH_STAR.md` until local follow-up confirms the minimal durable corpus. | Evidence review update with one stable decision row. |

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
