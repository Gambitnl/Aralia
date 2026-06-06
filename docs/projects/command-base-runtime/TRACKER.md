# TRACKER: Command Base Runtime

Status: active
Last updated: 2026-06-05

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
| T1 | done | Create initial protocol surface files in `docs/projects/command-base-runtime/` | Worker C | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files scoped and aligned to registry evidence | Verify `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` exist |
| T2 | done | Enrich protocol docs with runtime contracts, integration evidence, and gap log | Worker C | 2026-05-31 | `src/commands/base/CommandExecutor.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/useAbilitySystem.ts` | Keep gap data in `GAPS.md` and avoid source edits | Re-read `NORTH_STAR.md` + `GAPS.md` and confirm new gap IDs |
| T3 | blocked | Decide execution policy for rollback (`executeWithRollback` adoption vs explicit fallback) | Worker C | 2026-06-05 | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts`, `docs/projects/command-base-runtime/GAPS.md` | record the policy in the project docs, then either promote rollback execution with tests or retire it with rationale | docs consistency plus focused rollback/failure tests if adoption is chosen |

## Gap Log

- `T3` is blocked on a policy decision rather than missing evidence.
- The decision gate is whether `executeWithRollback` becomes the production path or stays an explicit fallback API.
- Durable gaps currently tracked in `docs/projects/command-base-runtime/GAPS.md`:
  - `G1`: rollback API has no call-site coverage
  - `G2`: `undo` methods are not implemented in effect commands
  - `G3`: rollback/async/failure edge tests are not yet covered in CommandExecutor tests
- `G1` and `G2` should only be closed after a deliberate non-rollback decision is written down; otherwise they remain the implementation dependency for `T3`.
- `G3` stays relevant either way because the chosen execution path still needs focused failure-order coverage.
- Cross-project gap routing stays at project scope unless one of the execution/coverage items is reprioritized away.
