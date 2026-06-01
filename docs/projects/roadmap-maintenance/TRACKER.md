# Roadmap Maintenance Living Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create durable scaffold documents from registry evidence. | previous worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Maintain durable ownership in this folder. | This file trio remains the project entry surface. |
| T2 | in_progress | Normalize project docs with evidence-backed ownership/storage/operational facts and gap classification. | future agent | 2026-05-31 | `package.json`; `devtools/roadmap/scripts/roadmap-storage.ts`; `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`; `.agent/roadmap-local/README.md` | Update `TRACKER.md` + `NORTH_STAR.md` + `GAPS.md` with explicit evidence and open uncertainty. | New entries in `GAPS.md` and updated resume path. |
| T3 | active | Audit and route open roadmap-local gaps that should be project-owned vs cross-project. | future agent | 2026-05-31 | `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md` | Classify each unresolved item and keep this project-specific routing explicit. | Confirm no cross-project gap is left here without explicit rationale. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | adjacent_follow_up | future agent | `docs/projects/roadmap-maintenance` | Project scope setup | Project tracking docs were created, but schema/ownership alignment details remain partial versus tracked roadmap tooling evidence. | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/roadmap/TRACKER.md`; `package.json`; `devtools/roadmap/scripts/roadmap-storage.ts` | Without this alignment, maintenance work repeatedly re-creates the same gap. | Update all three project docs with explicit evidence and ownership links. | Proof of completed docs update and updated last-updated field in this tracker. |
| G2 | not_started | support_needed_now | future agent | `.agent/roadmap-local` -> `roadmap-maintenance` bridge | Cross-check with open tasks | `task-number collision validation` and `queue-driven processing flow` remain open and need a durable routing decision. | `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md` | This blocks a clean handoff because local open-tasks are no longer reflected in project docs. | Add explicit classification row(s) to `GAPS.md` for each open item + evidence of expected proof source. | Re-run cross-check and verify classification in `GAPS.md`. |
| G3 | not_started | uncertainty | future agent | `docs/projects/roadmap-maintenance` | Local evidence pass | Compatibility outputs (`ROADMAP_FEATURE_CROSSCHECK.md`, `ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`) may be stale versus current head; freshness is not yet confirmed. | `devtools/roadmap/ROADMAP_FEATURE_CROSSCHECK.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md` | Risk of building on stale audit output and reifying outdated labels. | Refresh timestamps or explicitly mark these as historical in project evidence. | Evidence timestamp check and refresh decision logged. |

## Update Rules

- Update this tracker before starting a new slice.
- Keep active tasks with owner, evidence, and proof path.
- Add every unresolved item to `GAPS.md` with explicit owner, classification, and proof target.
