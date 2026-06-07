# TRACKER: Command Base Runtime

Status: active
Last updated: 2026-06-07

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
| T3 | done | Decide execution policy for rollback (`executeWithRollback` adoption vs explicit fallback) | Worker C | 2026-06-07 | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts`, `docs/projects/command-base-runtime/GAPS.md` | Policy recorded: rollback NOT adopted. Close G1/G2 with rationale; G3 remains for non-rollback failure coverage | docs consistency; G1/G2 closed with rationale in GAPS.md |
| T4 | not_started | Expand `CommandExecutor.execute` failure-path test coverage (G3) | Worker C | 2026-06-07 | `src/commands/__tests__/CommandExecutor.test.ts`, `docs/projects/command-base-runtime/GAPS.md` | Add focused Vitest for async errors, partial execution state, error propagation, immutable-state guarantees | Run new failure-path tests; verify docs consistency |

## Gap Log

- `T3` **completed** — rollback policy decided: `executeWithRollback` NOT adopted as production path.
- Current immutable-state `execute` already returns pre-failure state on error. `executeWithRollback` retained as explicit fallback API only.
- Durable gaps currently tracked in `docs/projects/command-base-runtime/GAPS.md`:
  - `G1`: **closed** — rollback API has no call-site coverage; not needed since rollback not adopted
  - `G2`: **closed** — `undo` methods not implemented; not required since rollback not adopted
  - `G3`: **active** — non-rollback failure-path tests not yet covered in CommandExecutor tests
  - `G4`: not_started — state-freshness contract between `CommandContext` snapshots and live state reads
- `G3` is the active work item (T4). `G4` remains as adjacent follow-up.
- Cross-project gap routing stays at project scope unless one of the execution/coverage items is reprioritized away.
