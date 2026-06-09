# NORTH_STAR: Command Base Runtime

Status: active
Last updated: 2026-06-08

## Why This Project Exists

`src/commands/base` is the shared execution layer for combat command sequencing. It
hosts the interfaces and execution policy that command factories and `useAbilitySystem`
use to apply effects safely.

## Intended Outcome

Keep a narrow, durable handoff for command-runtime execution behavior, evidence of
active gaps, and verification that non-rollback failure semantics remain stable.

## Current State

- Rollback policy is decided (`T3`): `executeWithRollback` is not used by production
  call-sites; `CommandExecutor.execute` is the standard path.
- `G1` and `G2` are closed in `GAPS.md` with rationale (undo/rollback not required
  for the chosen path).
- `G3` is complete: focused non-rollback failure-path coverage was added.
- `G4` is complete: state-snapshot and live-state read expectations are now explicit in
  `BaseEffectCommand` and `CommandContext`, with locked proof in
  `src/commands/__tests__/BaseEffectCommand.test.ts`.
- Primary runtime evidence:
  - `src/commands/base/SpellCommand.ts`
  - `src/commands/base/BaseEffectCommand.ts`
  - `src/commands/base/CommandExecutor.ts`
  - `src/commands/__tests__/CommandExecutor.test.ts`

## Dashboard Card Schema

Project: Command Base Runtime
Slug: command-base-runtime
Category: Runtime Infrastructure
Status: active
Confidence: high
Evidence: docs/projects/command-base-runtime
Gap signal: 0 open gaps
Protocol: living project doc set
Next step: Keep the contract test and docs comments aligned when context/command interfaces evolve.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs: tasks/, architecture notes, migration notes
Compaction status: not_needed
Lifecycle status: active
Human decision required: no

## Active Task

| Field | Value |
|---|---|
| Task | **DONE** — Capture explicit state-freshness contract for `G4` and keep failure-path evidence in place |
| Acceptance criteria | Keep `G3` command-executor coverage in `src/commands/__tests__/CommandExecutor.test.ts` and add a focused state-freshness proof for `G4` in `src/commands/__tests__/BaseEffectCommand.test.ts`. |
| Allowed boundaries | `docs/projects/command-base-runtime/*`, `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts`, `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts` |
| Stop condition | Tests pass and `G4` marked done with proof in project docs. |
| Verification | `npx vitest run src/commands/__tests__/CommandExecutor.test.ts`; `npx vitest run src/commands/__tests__/BaseEffectCommand.test.ts` |
| Owner | Worker A |
| Next action | Monitor adjacent contract drift if `CommandContext` or BaseEffectCommand helpers are refactored. |

## Scope Boundaries

- In scope: execution-facing docs, source contract comments in `src/commands/base`, and state-freshness/execution tests.
- Adjacent but not in scope: behavior-changing logic changes in effect command implementations.
- Out of scope: cross-project or unrelated command-system rewrites.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next action |
|---|---|---|---|---|
| `G3`: Command failure-path coverage | closed | Worker A | `src/commands/__tests__/CommandExecutor.test.ts` | Added async-failure and partial-state tests with immutable snapshot check on failure. |
| `G4`: State-freshness contract between context snapshots and live reads | done | Worker A | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts` | Added contract notes and a focused assertion that `getCaster`/`getTargets` resolves from live state. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Test coverage | `CommandExecutor.execute` failure path now includes async rejection handling, failed command reporting, and pre-failure state preservation. | `src/commands/__tests__/CommandExecutor.test.ts` |
| State freshness contract | `BaseEffectCommand.getCaster` and `getTargets` now have explicit inline contract and a focused proof test ensuring live-state reads are based on IDs in current `CombatState`. | `src/commands/base/BaseEffectCommand.ts`, `src/commands/__tests__/BaseEffectCommand.test.ts` |
| Runtime integration | `useAbilitySystem` still uses `CommandExecutor.execute` as the production path. | `src/hooks/useAbilitySystem.ts` |

## Resume Path

1. Read `docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md`.
2. Read this file.
3. Read `docs/projects/command-base-runtime/TRACKER.md` and `GAPS.md`.
4. Continue with next command-base runtime follow-up if contract-sensitive changes land in base command APIs.

## Cold-Start Gap Routing

Check `docs/projects/GLOBAL_GAPS.md` before adding cross-project gaps. `G3` and `G4` are now
closed and in-scope; route only real out-of-scope findings there when encountered.
