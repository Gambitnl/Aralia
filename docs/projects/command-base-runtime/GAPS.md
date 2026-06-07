# GAPS: Command Base Runtime

Status: active
Last updated: 2026-06-07

Use only durable unresolved findings that belong to this command-runtime project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | closed | in_scope_now | Worker C | `docs/projects/command-base-runtime/TRACKER.md` | Project documentation enrichment | `executeWithRollback` is defined but no normal runtime call-site uses it | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts` | Runtime currently appears to depend on non-rollback execution only, so rollback guarantees are theoretical until this path is either adopted or retired | **Decision: Rollback NOT adopted.** Current immutable-state execution already returns pre-failure state on error. `executeWithRollback` retained as explicit fallback API only. No call-site migration needed. | Verify `useAbilitySystem.ts` uses only `CommandExecutor.execute`; confirm no production path depends on rollback |
| G2 | closed | support_needed_now | Worker C | `src/commands/base/CommandExecutor.ts` + command implementations | Project documentation enrichment | No concrete `undo` methods are implemented in command effect classes, but rollback logic expects optional `undo` support | `src/commands/base/CommandExecutor.ts`, `rg -n \"undo\" src/commands/effects` | Rollback can silently become incomplete if rollback path is used, making failure recovery unreliable | **Decision: Undo NOT required.** Since rollback is not the production path, `undo` implementations are not needed. `executeWithRollback` gracefully handles missing `undo` (logs warning, continues). | Confirm no command class implements `undo`; verify `executeWithRollback` warning path is tested if kept |
| G3 | not_started | support_needed_now | Worker C | `src/commands/__tests__/CommandExecutor.test.ts` | Project documentation enrichment | `CommandExecutor` behavior beyond basic `execute` path (rollback, async failure, partial recovery) is not covered | `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/__tests__/combat-pilot/CombatDeterministicSpells.test.ts` | Without focused coverage, regressions in error handling or atomicity are likely if execution behavior changes | Add focused tests for non-rollback failure path: async errors, partial execution state, error propagation, immutable-state guarantees | Focused Vitest for `CommandExecutor.execute` failure-order assertions and error-state integrity |
| G4 | not_started | adjacent_follow_up | Worker C | `src/commands/base/BaseEffectCommand.ts` | Project documentation enrichment | State-freshness contract between `CommandContext` snapshots and live state reads is only partially explicit | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts` | Refactors can accidentally violate the implicit snapshot-vs-live assumptions in helper methods | Add an explicit state-freshness note in owning implementation tasks | Validate with a focused caster/target staleness test in command execution |

## Notes

- If future work confirms rollback is not required for this runtime, import `G1` + `G2` as closure actions with an explicit rationale.
- `T3` is the decision gate for `G1` and `G2`; do not assume rollback is adopted until the policy is recorded in the project docs.
- `G3` remains the test follow-up regardless of which execution path is chosen.
- Keep these gaps here unless scope is reassigned in `docs/projects/GLOBAL_GAPS.md`.
