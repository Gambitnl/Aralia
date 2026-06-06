# Documentation Cleanup Gap Registry

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | future agent | `docs/projects/documentation-cleanup/TRACKER.md` | registry migration | Curate stale/duplicate docs without premature pruning. | `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/documentation-cleanup` | Aralia prefers preserving unfinished intent; cleanup needs evidence-backed routing. | Review candidate docs and record keep/merge/supersede decisions. | Durable decision or tracker rows. |
| G2 | open | in_scope_now | future agent | `docs/projects/documentation-cleanup/TRACKER.md` | ignored task evidence refresh | Historical packets `1G.7` to `1G.10` still describe target paths with wording that no longer matches current source-adjacent targets. | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md`, `docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md`, `docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md`, `docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md` | Future agents can misread these packets as current path authority unless the notes are reconciled or clearly marked historical. | Compare each brief against its real target and update the surviving notes in place. | Confirm each packet is either updated or explicitly historical. |
| G3 | open | adjacent_follow_up | future agent | `docs/projects/documentation-cleanup/TRACKER.md` | ignored task evidence refresh | Duplicate-cleanup scope is still partial and has no explicit completion check in the durable project surface. | `docs/tasks/documentation-cleanup/GAPS.md`, `docs/tasks/documentation-cleanup/TRACKER.md` | Without an explicit stop rule, later agents can assume the duplicate pass is fully resolved when it is not. | Add a follow-up tracker row if the duplicate scope is formally widened. | Tracker row or project decision note that closes the scope. |
