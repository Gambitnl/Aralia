# Documentation Cleanup Living Tracker

Status: complete — G3 decision recorded 2026-06-10; project closed as complete-enough
Last updated: 2026-06-10

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
| T1 | done | Create durable scaffold outside ignored documentation-cleanup task folder. | Codex integration pass | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Use this folder as the registered living-project surface. | Three files exist under `docs/projects/documentation-cleanup/`. |
| T2 | done | Curate stale/duplicate docs with evidence. | iteration 2 agent | 2026-06-08 | `docs/projects/documentation-cleanup/DECISIONS.md`, `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md`, `docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md`, `docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md`, `docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md`, `docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md` | 1G drift wording corrected where stale (`1G.7`, `1G.9`, `1G.10`) and historical intent preserved for `1G.8`. | G1 resolved by D-03; evidence is mirrored in `GAPS.md`. |
| T3 | done | Resolve G3 completion-scope routing for duplicate cleanup. | human/project owner | 2026-06-10 | `docs/projects/documentation-cleanup/GAPS.md`, `docs/projects/documentation-cleanup/NORTH_STAR.md` Required Review Brief, **decision recorded 2026-06-10 (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D23)** | **Decided:** close as complete-enough; scope not widened; evidence preserved. Project closes; re-open only via an explicitly scoped future cleanup campaign. | Decision row D-04 in `DECISIONS.md`; `NORTH_STAR.md` status complete. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | iteration 2 | `docs/projects/documentation-cleanup/DECISIONS.md` | registry migration evidence review | Correct stale historical packet wording for `1G.7`-`1G.10` and confirm preservation boundaries. | `docs/projects/documentation-cleanup/DECISIONS.md` (D-03), `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md`, `docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md`, `docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md`, `docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md`, `docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md` | Stale wording can make historical packets look like live migration authority. | Keep packets in historical-preservation mode and only apply corrections where source state changed. | Source-backed decisions in D-03 and tracker status in `GAPS.md`. |
| G3 | resolved | blocked_human_decision | human/project owner | `docs/projects/documentation-cleanup/TRACKER.md` | ignored task evidence refresh | Duplicate-cleanup scope is still partial and has no explicit completion check in the durable project surface. | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/TRACKER.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` (D23) | Without an explicit stop rule, later agents can assume the duplicate pass is fully resolved or widen cleanup scope without authorization. | **Decided 2026-06-10:** closed as complete-enough; scope not widened; evidence preserved (`DECISIONS.md` D-04). | Decision row D-04 recorded; project status complete. |
| G5 | resolved | adjacent_follow_up | iteration 3 | `docs/projects/documentation-cleanup/GAPS.md` | projects audit | Documentation Cleanup still lacked the repository-required `RUNBOOK.md` in the living project surface. | `npm run projects:audit`, `docs/projects/PROJECT_TRACKER.md`, `docs/projects/documentation-cleanup/NORTH_STAR.md`, `docs/projects/documentation-cleanup/RUNBOOK.md` | The project audit contract is complete for this requirement now that the runbook exists. | Resolved by `docs/projects/documentation-cleanup/RUNBOOK.md`. | `npm run projects:audit` no longer reports missing `RUNBOOK.md` for documentation-cleanup. |

## Resume Note

T2 is now done. Iteration 2 resolved G2 (path-drift verification) with full evidence in `DECISIONS.md` D-01 and `AUDIT_OR_PROOF.md`. G4 (stale PROJECT_TRACKER.md link) and G5 (missing RUNBOOK requirement) are resolved in the living docs. G1 is resolved by D-03 in `DECISIONS.md`; G3 is review-blocked on a duplicate-cleanup scope decision.

2026-06-10 update: the G3 scope decision is recorded (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D23, local D-04) — closed as complete-enough; scope not widened; evidence preserved. The project is closed; no further iteration work is queued.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
