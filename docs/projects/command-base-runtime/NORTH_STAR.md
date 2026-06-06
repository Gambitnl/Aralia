# NORTH_STAR: Command Base Runtime

Status: active
Last updated: 2026-06-05

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
- The active rollback-policy decision is still open, so `T3` remains blocked until the production path is explicitly chosen.
- Durable open findings are still tracked in `GAPS.md` as `G1`-`G4`.

## Dashboard Card Schema

Project: Command Base Runtime
Slug: command-base-runtime
Category: Runtime Infrastructure
Status: active
Confidence: high
Evidence: docs/projects/command-base-runtime
Gap signal: 4 open gaps (G1-G4); T3 blocked on rollback policy decision
Protocol: living project doc set
Next step: Decide whether `executeWithRollback` is the production path, then align tests and call sites to that decision.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Active Task

| Field | Value |
|---|---|
| Task | Decide rollback execution policy for `CommandExecutor` (`executeWithRollback` adoption vs explicit fallback) |
| Acceptance criteria | The decision is recorded in `TRACKER.md` and `GAPS.md`; if rollback is adopted, the next implementation slice has call-site and test follow-up; if not, `G1`/`G2` are closed with rationale and `G3` stays as regression coverage for the chosen execution path |
| Allowed boundaries | `docs/projects/command-base-runtime/*`, `src/commands/base`, `src/hooks/useAbilitySystem.ts`, `src/commands/__tests__/CommandExecutor.test.ts` |
| Stop condition | a cold-start agent can resume from one explicit rollback policy and one explicit test plan |
| Verification | docs consistency against `TRACKER.md`/`GAPS.md` and targeted `CommandExecutor` tests when implementation resumes |
| Owner | Worker C |
| Next action | write down the rollback decision, then align the tracker, gap log, and implementation plan |

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
| `executeWithRollback` and `undo` are currently not exercised in normal call-sites | adjacent_follow_up | Worker C | `src/commands/base/CommandExecutor.ts`, `src/hooks/useAbilitySystem.ts` | decide if production execution should switch to rollback mode |
| No concrete `undo` implementations are visible in `src/commands/effects` | support_needed_now | Worker C | `src/commands/base/CommandExecutor.ts`, `src/commands/effects` | add implementations or remove rollback dependency with explicit rationale |
| Test coverage is strong on command creation/effects, but light on rollback and failure-recovery behavior | support_needed_now | Worker C | `src/commands/__tests__/CommandExecutor.test.ts`, `src/commands/__tests__/combat-pilot/CombatDeterministicSpells.test.ts` | expand test coverage before touching rollback semantics |
| Partial/uncertain: contract-level state freshness guarantees (`context` vs live state) are not formally specified | adjacent_follow_up | Worker C | `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/SpellCommand.ts` | add an explicit interpretation note in implementation planning |
- `G1` through `G3` are the decision gate for `T3`; do not assume rollback is adopted until the policy is written down.
- `G4` stays as the lower-priority state-freshness follow-up once the rollback decision is resolved.

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
| Runtime integration | hook-level integration uses `CommandExecutor` and command factories | `src/hooks/useAbilitySystem.ts` |
| Domain framing | command stack is wider than spell-only execution | `docs/architecture/domains/commands.md` |
| Current test scope | `CommandExecutor.execute` tested; rollback/edge paths not yet covered | `src/commands/__tests__/CommandExecutor.test.ts` |

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
