# Spells Task Living Tracker

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
| T1 | done | Preserve and update this task-folder living docs as a cold-start continuity layer | Worker D | 2026-05-31 | `docs/tasks/spells/NORTH_STAR.md`; `docs/tasks/spells/GAPS.md`; `docs/projects/PROJECT_TRACKER.md` | Keep this tracker aligned with package and validation state | `SPELL_PHASE_1_TASK_TRACKER.md` and `SPELL_DATA_VALIDATION_PLAN.md` read as evidence |
| T2 | active | Maintain a stable resume map as Spell Phase advances package-by-package, and record cross-project handoff state | Worker D | 2026-06-03 | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md`; Symphony draft `draft-1780439174507-pzfuhi` | Keep Package 19 launch/readiness state aligned with the live package queue and drift-check notes | One stable proof: Package 19 selected, packet/prompt present, Symphony draft exists, and GitHub sync/Linear/Jules boundary is recorded before launch |
| T3 | done | Await Package 18 execution output for closure transition | Worker D | 2026-06-01 | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; PR [#1143](https://github.com/Gambitnl/Aralia/pull/1143) | Package 18 safe-replacement output arrived and merged remotely; continue with local sync/package-history closeout instead of waiting on Jules | PR #1143 merged on 2026-06-01 at 13:38:41Z |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G101 | done | in_scope_now | Worker D | `docs/tasks/spells` + `docs/tasks/spell-system-overhaul` | this pass | Package 18 needed closure proof before this task-folder could leave wait-state | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; PR [#1143](https://github.com/Gambitnl/Aralia/pull/1143) | Closure proof exists without pretending the full project is complete: PR #1143 merged remotely, and Package 19 has now been selected as the next mechanics-bucket package. | Continue from Package 19 launch/readiness state | Tracker records Package 18 remote merge proof and Package 19 active packet |
| G102 | active | support_needed_now | Worker D | `docs/tasks/spells` + `docs/projects/GLOBAL_GAPS.md` | this pass | Atlas row counts are not automatically drift-checked against tracker totals | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Docs and Atlas can diverge without runtime warning, causing bad resume state | Add and keep one manual reconciliation row per package transition | Manual count check when package state changes |
| G103 | out_of_scope | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul` | this pass | Runtime schema engine questions live in spell-system-overhaul, not this docs folder | `docs/tasks/spell-system-overhaul/NORTH_STAR.md` and `docs/tasks/spell-system-overhaul/TRACKER.md` | Prevent duplicated ownership across living projects | Route new engine-level findings there | Add only if a cross-over issue reaches this folder as a handoff summary |

## Update Rules

- Update this tracker when each package boundary state changes.
- Keep one `active` or one `waiting` queue row for the current task slice.
- Active `waiting` rows must name owner, next proof, and external state dependency.
- Keep durable proof checks in `Next check/proof`, not raw command output only.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/TRACKER.md","sha256WithoutMarker":"c67d8bb2aeb5725eae0c7127985db449bc02d3e47db02da6bd8b93bed42771c0","markedAtUtc":"2026-06-25T22:29:38.566Z"} -->
