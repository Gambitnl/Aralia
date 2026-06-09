# TRACKER: Command Base Runtime

Status: active
Last updated: 2026-06-08

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
| T3 | done | Decide rollback execution policy for `CommandExecutor` (`executeWithRollback` adoption vs explicit fallback) | Worker C | 2026-06-07 | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts`, `docs/projects/command-base-runtime/GAPS.md` | Policy recorded: rollback NOT adopted; `G1`/`G2` closed with rationale; `G3` scoped to non-rollback failure coverage | docs consistency; G1/G2 closed with rationale in GAPS.md |
| T4 | done | Expand `CommandExecutor.execute` failure-path test coverage (G3) | Worker A | 2026-06-08 | `src/commands/__tests__/CommandExecutor.test.ts`, `docs/projects/command-base-runtime/GAPS.md`, `docs/projects/command-base-runtime/NORTH_STAR.md` | Add focused Vitest for async errors, partial execution state, and immutable snapshot behavior on failure | `npx vitest run src/commands/__tests__/CommandExecutor.test.ts`; docs consistency against TRACKER/NORTH_STAR/GAPS |
| T5 | done | Capture explicit state-freshness contract for context-vs-live state reads (`G4`) | Worker A | 2026-06-08 | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts` | Add concise contract text and test where `G4` needs evidence | `npx vitest run src/commands/__tests__/BaseEffectCommand.test.ts`; docs consistency against TRACKER/NORTH_STAR/GAPS |

## Gap Log

- `T3` **completed** — rollback policy decided: `executeWithRollback` is not adopted as production path.
- `T4` **completed** — `CommandExecutor.execute` failure path now covered for async errors, partial execution, and pre-failure snapshot behavior.
- `G1`: **closed** — rollback API has no call-site requirement in production; no change needed.
- `G2`: **closed** — undo methods are not required for current non-rollback policy.
- `G3`: **closed** — failure-path coverage for async errors and immutability guarantees added in tests.
- `G4`: done — state-freshness contract follow-up complete and locked by focused test.
