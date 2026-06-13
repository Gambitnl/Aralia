# Companions System Gap Registry

Status: active (G6 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G6 | not_started | in_scope_now | Worker A | `docs/projects/companions/TRACKER.md` | `src/systems/companions/Companions_Ralph.md` review | Romance state lock-in can keep a companion flagged as `romance` even after approval collapses to hostile territory. Decision recorded 2026-06-10 (DECISION_BLITZ D10): hysteresis exit â€” romance survives temporary dips but exits after sustained low approval; threshold + duration are specified in the implementation slice. | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D10 | The system can present a companion as romantically committed while the approval state says the opposite; story logic needs an explicit breakup/downgrade contract. | Encode the hysteresis breakup semantics in `RelationshipManager` (define threshold and sustained-duration values first). | Run a regression that drops approval from romance to hostile and verifies the exit fires only after the sustained-low-approval condition. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The current project cannot complete without this gap fixed. |
| `support_needed_now` | Task cannot progress cleanly without resolving this gap. |
| `adjacent_follow_up` | Useful and related, but can be deferred until core needs are complete. |
| `out_of_scope` | Confirmed not part of this project's current contract. |
| `blocked_human_decision` | Needs product or design signoff before engineering can continue. |
| `blocked_external_state` | Depends on external vendor/tooling or unrelated owner. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
