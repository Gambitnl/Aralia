# GAPS: Command Base Runtime

Status: active
Last updated: 2026-06-05

Use only durable unresolved findings that belong to this command-runtime project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker C | `docs/projects/command-base-runtime/TRACKER.md` | Project documentation enrichment | `executeWithRollback` is defined but no normal runtime call-site uses it | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts` | Runtime currently appears to depend on non-rollback execution only, so rollback guarantees are theoretical until this path is either adopted or retired | Add an implementation decision (`executeWithRollback` adoption or explicit removal/renaming) and align tests to that decision | `rg -n \"executeWithRollback|CommandExecutor.execute\" src` and verify `src/hooks/useAbilitySystem.ts` dispatch path |
| G2 | not_started | support_needed_now | Worker C | `src/commands/base/CommandExecutor.ts` + command implementations | Project documentation enrichment | No concrete `undo` methods are implemented in command effect classes, but rollback logic expects optional `undo` support | `src/commands/base/CommandExecutor.ts`, `rg -n \"undo\" src/commands/effects` | Rollback can silently become incomplete if rollback path is used, making failure recovery unreliable | Decide if undo support is required now; if yes, implement and test `undo` on command classes; if no, de-scope rollback dependence explicitly | Add tests proving rollback coverage for commands that should support undo |
| G3 | not_started | support_needed_now | Worker C | `src/commands/__tests__/CommandExecutor.test.ts` | Project documentation enrichment | `CommandExecutor` behavior beyond basic `execute` path (rollback, async failure, partial recovery) is not covered | `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/__tests__/combat-pilot/CombatDeterministicSpells.test.ts` | Without focused coverage, regressions in error handling or atomicity are likely if execution behavior changes | Add focused tests for `executeWithRollback`, async errors, and partial-failure expectations | Focused Vitest for `CommandExecutor` rollback and failure-order assertions |
| G4 | not_started | adjacent_follow_up | Worker C | `src/commands/base/BaseEffectCommand.ts` | Project documentation enrichment | State-freshness contract between `CommandContext` snapshots and live state reads is only partially explicit | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts` | Refactors can accidentally violate the implicit snapshot-vs-live assumptions in helper methods | Add an explicit state-freshness note in owning implementation tasks | Validate with a focused caster/target staleness test in command execution |

## Notes

- If future work confirms rollback is not required for this runtime, import `G1` + `G2` as closure actions with an explicit rationale.
- `T3` is the decision gate for `G1` and `G2`; do not assume rollback is adopted until the policy is recorded in the project docs.
- `G3` remains the test follow-up regardless of which execution path is chosen.
- Keep these gaps here unless scope is reassigned in `docs/projects/GLOBAL_GAPS.md`.
