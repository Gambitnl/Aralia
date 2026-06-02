# NORTH_STAR: Command Base Runtime

Status: active
Last updated: 2026-05-31

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

## Active Task

| Field | Value |
|---|---|
| Task | Expand protocol scaffold into implementation-aware project handoff for `src/commands/base` |
| Acceptance criteria | Protocol docs now include: contract inventory, integration points, proof sources, and durable gaps |
| Allowed boundaries | `docs/projects/command-base-runtime/*`, `src/commands/base`, `src/hooks/useAbilitySystem.ts`, `docs/architecture/domains/commands.md` |
| Stop condition | current contract/gap handoff is documented without changing source behavior |
| Verification | file inventory + call-site/tests checked against evidence sources |
| Owner | Worker C |
| Next action | decide and ticket rollback/undo execution behavior in implementation work |

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
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing evidence | active |
| `docs/projects/command-base-runtime/TRACKER.md` | Active queue and status | active |
| `docs/projects/command-base-runtime/GAPS.md` | Durable unresolved findings | active |

## Artifact Boundary

Keep durable intent, decisions, and evidence-backed gaps here.
Do not store raw logs, temporary test runs, or one-off notes.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/command-base-runtime/TRACKER.md`.
3. Read `docs/projects/command-base-runtime/GAPS.md`.
4. Confirm `src/commands/base` in `docs/projects/PROJECT_TRACKER.md`.
5. Read integration wiring in `src/hooks/useAbilitySystem.ts`.
6. Read domain framing in `docs/architecture/domains/commands.md`.
7. Continue from: `Expand command-runtime handoff and resolve rollback/undo status`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
