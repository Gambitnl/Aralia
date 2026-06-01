# TRACKER: Command Base Runtime

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
| T1 | done | Create initial protocol surface files in `docs/projects/command-base-runtime/` | Worker C | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files scoped and aligned to registry evidence | Verify `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` exist |
| T2 | done | Enrich protocol docs with runtime contracts, integration evidence, and gap log | Worker C | 2026-05-31 | `src/commands/base/CommandExecutor.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/useAbilitySystem.ts` | Keep gap data in `GAPS.md` and avoid source edits | Re-read `NORTH_STAR.md` + `GAPS.md` and confirm new gap IDs |
| T3 | blocked | Decide execution policy for rollback (whether `executeWithRollback` becomes production path) | Worker C | 2026-05-31 | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts` | produce an implementation task that resolves G2/G3 coverage and ownership | Update project docs + implementation task with decision and verification command |

## Gap Log

- `T3` is blocked on implementation scope decision rather than missing evidence.
- Durable gaps currently tracked in `docs/projects/command-base-runtime/GAPS.md`:
  - `G1`: rollback API has no call-site coverage
  - `G2`: `undo` methods are not implemented in effect commands
  - `G3`: rollback/async/failure edge tests are not yet covered in CommandExecutor tests
- Cross-project gap routing stays at project scope unless one of the execution/coverage items is reprioritized away.
