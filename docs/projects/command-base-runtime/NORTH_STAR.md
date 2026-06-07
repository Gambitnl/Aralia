# NORTH_STAR: Command Base Runtime

Status: active
Last updated: 2026-06-07

## Why This Project Exists

The command base runtime under `src/commands/base` is the shared execution surface for combat command generation and application.
It is the layer that spell/ability factories and combat hooks rely on for sequencing and state application.

## Intended Outcome

1. Preserve concrete evidence of what exists today in `src/commands/base`.
2. Keep a durable warm-start guide for implementation and handoff work.
3. Capture durable command-runtime gaps before implementation teams start narrowing scope further.

## Current State

- Registry anchor exists: `docs/projects/PROJECT_TRACKER.md` (`src/commands/base`).
- Runtime files are present and actively used:
  - `src/commands/base/SpellCommand.ts` (command contract + context metadata)
  - `src/commands/base/BaseEffectCommand.ts` (abstract base + immutable-state helpers)
  - `src/commands/base/CommandExecutor.ts` (execution + rollback-capable API)
- `SpellCommand.ts` defines execution contract details (`execute`, optional `undo`, `description`, `metadata`) and runtime context fields such as `weaponProperties`, `isMagical`, and `requestReaction`.
- `BaseEffectCommand` centralizes up-to-date state reads (`getCaster`, `getTargets`) plus immutable character updates and combat-log append helpers.
- `CommandExecutor` executes command chains, returns `ExecutionResult`, and includes `executeWithRollback(...)`.
- `useAbilitySystem.ts` is a primary integration point: it creates command lists via `SpellCommandFactory`/`AbilityCommandFactory` and applies them through `CommandExecutor.execute`.
- Architecture framing in `docs/architecture/domains/commands.md` treats this as a broader lane for spell JSON and combat ability execution, not a spell-only pipeline.
- **Rollback policy decided (2026-06-07):** `executeWithRollback` is NOT adopted as production path. Current immutable-state `execute` already returns pre-failure state on error. `executeWithRollback` retained as explicit fallback API only. `T3` unblocked.
- Durable open findings tracked in `GAPS.md`: `G1`/`G2` closed with rationale; `G3` remains for non-rollback failure coverage; `G4` as state-freshness follow-up.

## Dashboard Card Schema

Project: Command Base Runtime
Slug: command-base-runtime
Category: Runtime Infrastructure
Status: active
Confidence: high
Evidence: docs/projects/command-base-runtime
Gap signal: 2 open gaps (G3, G4); T3 done — rollback not adopted
Protocol: living project doc set
Next step: Expand `CommandExecutor.execute` failure-path tests (G3); document state-freshness contract (G4).
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency
Last proof: 2026-06-07
Workflow gaps reviewed: 2026-06-07

## Active Task

| Field | Value |
|---|---|
| Task | **DONE** — Decide rollback execution policy for `CommandExecutor` (`executeWithRollback` adoption vs explicit fallback) |
| Acceptance criteria | The decision is recorded in `TRACKER.md` and `GAPS.md`; if rollback is adopted, the next implementation slice has call-site and test follow-up; if not, `G1`/`G2` are closed with rationale and `G3` stays as regression coverage for the chosen execution path |
| Allowed boundaries | `docs/projects/command-base-runtime/*`, `src/commands/base`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts` |
| Stop condition | a cold-start agent can resume from one explicit rollback policy and one explicit test plan |
| Verification | docs consistency against `TRACKER.md`/`GAPS.md` and targeted `CommandExecutor` tests when implementation resumes |
| Owner | Worker C |
| Next action | **COMPLETED** — Rollback NOT adopted. `G1`/`G2` closed with rationale. `G3` retargeted to non-rollback failure coverage. Next work: expand `CommandExecutor.execute` failure-path tests. |

## Scope Boundaries

In scope:
- documentation updates that preserve command runtime intent and evidence
- contract + execution + integration notes needed for next implementation slices
- in-project gap capture and continuity guidance

Adjacent but not in scope:
- source-level refactors in `src/commands/base`
- code-level test modernization or broad coverage expansion

Out of scope:
- `docs/projects/PROJECT_TRACKER.md` edits (owner-managed)
- repository-wide architecture edits

## What Must Not Be Lost

- The command contract in `SpellCommand.ts`, especially `CommandMetadata`, `CommandContext`, and optional `undo`.
- The two execution entry modes in `CommandExecutor` (`execute` + `executeWithRollback`) and documented partial-failure behavior.
- The active hook-level integration path through `useAbilitySystem.ts`.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next action |
|---|---|---|---|---|
| `executeWithRollback` and `undo` are currently not exercised in normal call-sites | **closed** — not adopted | Worker C | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts` | **Decision recorded:** Rollback not adopted. Immutable `execute` returns pre-failure state. `executeWithRollback` kept as explicit fallback. |
| No concrete `undo` implementations are visible in `src/commands/effects` | **closed** — not required | Worker C | `src/commands/base/CommandExecutor.ts`, `src/commands/effects` | **Decision recorded:** Since rollback not adopted, `undo` not needed. Fallback path handles missing `undo` gracefully. |
| Test coverage is strong on command creation/effects, but light on rollback and failure-recovery behavior | support_needed_now | Worker C | `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/__tests__/combat-pilot/CombatDeterministicSpells.test.ts` | **Retargeted:** Expand `CommandExecutor.execute` failure-path tests (async errors, partial execution state, error propagation, immutable-state guarantees). |
| Partial/uncertain: contract-level state freshness guarantees (`context` vs live state) are not formally specified | adjacent_follow_up | Worker C | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts` | Add an explicit state-freshness note in implementation planning. |
- `G1`/`G2` closed with rationale (rollback not adopted).
- `G3` retargeted to non-rollback failure coverage.
- `G4` stays as the state-freshness follow-up.

## Global Gap Imports

Check `docs/projects/GLOBAL_GAPS.md` before adding cross-project gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | current findings are local to command-base runtime ownership |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Registry row | project ownership and scope are recorded | `docs/projects/PROJECT_TRACKER.md` |
| Contract API | command interface + context design is implemented | `src/commands/base/SpellCommand.ts` |
| Base shared behavior | immutable helpers and log/target/caster accessors are implemented | `src/commands/base/BaseEffectCommand.ts` |
| Execution orchestration | command sequencing + rollback-capable execution path exists | `src/commands/base/CommandExecutor.ts` |
| Runtime integration | hook-level integration uses `CommandExecutor.execute` (non-rollback) | `src/hooks/useAbilitySystem.ts` |
| Domain framing | command stack is wider than spell-only execution | `docs/architecture/domains/commands.md` |
| Current test scope | `CommandExecutor.execute` tested; failure-path coverage gap (G3) | `src/commands/__tests__/CommandExecutor.test.ts` |
| Rollback policy | explicit decision: rollback not adopted; fallback retained | `docs/projects/command-base-runtime/GAPS.md` (G1/G2 closed) |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md` | Current cold-start handoff packet | active |
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing evidence | active |
| `docs/projects/command-base-runtime/TRACKER.md` | Active queue and status | active |
| `docs/projects/command-base-runtime/GAPS.md` | Durable unresolved findings | active |

## Artifact Boundary

Keep durable intent, decisions, and evidence-backed gaps here.
Do not store raw logs, temporary test runs, or one-off notes.

## Resume Path For A Cold Agent

1. Read `docs/projects/command-base-runtime/COLD_START_AGENT_PROMPT.md`.
2. Read this file.
3. Read `docs/projects/command-base-runtime/TRACKER.md`.
4. Read `docs/projects/command-base-runtime/GAPS.md`.
5. Confirm `src/commands/base` in `docs/projects/PROJECT_TRACKER.md`.
6. Read integration wiring in `src/hooks/useAbilitySystem.ts`.
7. Read domain framing in `docs/architecture/domains/commands.md`.
8. Continue from: `Decide rollback execution policy for CommandExecutor`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
