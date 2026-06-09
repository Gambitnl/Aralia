# GAPS: Command Base Runtime

Status: active
Last updated: 2026-06-08

Use only durable unresolved findings that belong to this command-runtime project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | closed | in_scope_now | Worker A | `docs/projects/command-base-runtime/TRACKER.md` | Project documentation enrichment | `executeWithRollback` is defined but no normal production call-site uses it | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts` | Runtime now uses non-rollback execution as the standard path; rollback path is optional fallback only | Keep `executeWithRollback` explicit and avoid normalizing it as the primary path | Confirm `useAbilitySystem.ts` still calls `CommandExecutor.execute` |
| G2 | closed | support_needed_now | Worker A | `src/commands/base/CommandExecutor.ts` + command implementations | Project documentation enrichment | `undo` is optional and not implemented in current effect command classes | `src/commands/base/CommandExecutor.ts`, `rg -n \"undo\" src/commands/effects` | Rollback can be incomplete if an explicit rollback path is used | Keep `undo` optional and document rollback status under `G1`/`T3` rationale | Verify no production call-site depends on rollback |
| G3 | done | support_needed_now | Worker A | `src/commands/__tests__/CommandExecutor.test.ts` | Command test iteration | Non-rollback failure semantics were missing explicit coverage for async failures and pre-failure state integrity | `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/base/CommandExecutor.ts` | Without targeted failure-path coverage, regressions in atomicity/error propagation are easy to introduce silently | Added tests for async failure propagation, partial execution state, and snapshot immutability on failure | `npx vitest run src/commands/__tests__/CommandExecutor.test.ts` |
| G4 | done | support_needed_now | Worker A | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts` | Project documentation enrichment | State-freshness contract between `CommandContext` snapshots and live state reads was only partially explicit | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts` | Refactors can accidentally violate snapshot-vs-live assumptions in helper methods and runtime reads | Added explicit snapshot-vs-live contract comments and a focused assertion that `getCaster`/`getTargets` resolve from current state by ID | `npx vitest run src/commands/__tests__/BaseEffectCommand.test.ts` |

## Notes

- `G1`/`G2` stay closed under the rollback-not-adopted decision from `T3`.
- `G3` is now closed by the focused failure-path coverage in `src/commands/__tests__/CommandExecutor.test.ts`.
- `G4` is now closed by explicit snapshot-vs-live contract comments and a focused assertion in `src/commands/__tests__/BaseEffectCommand.test.ts`.
