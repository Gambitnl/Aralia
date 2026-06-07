# Documentation Cleanup Living Tracker

Status: active
Last updated: 2026-06-07

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create durable scaffold outside ignored documentation-cleanup task folder. | Codex integration pass | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Use this folder as the registered living-project surface. | Three files exist under `docs/projects/documentation-cleanup/`. |
| T2 | in_progress | Curate stale/duplicate docs with evidence. | iteration 2 agent | 2026-06-07 | `docs/projects/documentation-cleanup/DECISIONS.md`, `docs/projects/documentation-cleanup/AUDIT_OR_PROOF.md` | Path-drift packets 1G.7–1G.10 verified against live repo (G2 resolved). Continue curating remaining stale docs (G1). | G2 resolved with evidence table in DECISIONS.md D-01. G1 and G3 remain open. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | future agent | `docs/projects/documentation-cleanup/GAPS.md` | registry migration | Curate stale/duplicate docs without premature pruning. | `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/documentation-cleanup`, `docs/projects/documentation-cleanup/DECISIONS.md` | Cleanup can destroy unfinished intent unless evidence and boundaries are recorded. | Review remaining candidate docs and classify actions. | Evidence-backed cleanup gap rows. |

## Resume Note

T2 is now in_progress. Iteration 2 resolved G2 (path-drift verification) with
full evidence in `DECISIONS.md` D-01 and `AUDIT_OR_PROOF.md`. Discovered and
corrected G4 (stale PROJECT_TRACKER.md link). G1 (broad stale-doc curation)
and G3 (duplicate-cleanup completion check) remain open for the next pass.
