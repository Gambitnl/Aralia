# Command Effects Runtime Decisions

Status: active
Last updated: 2026-06-10

This file records durable command-effects runtime decisions that future agents
should preserve while closing the remaining execution gaps.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | Teleport resolution belongs to `MovementCommand`, including bounds/fallback handling and combat-log budget metadata. | recorded | `src/commands/effects/MovementCommand.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts` | Keep teleport landing semantics in the command layer instead of duplicating them in ability factories. |
| D-02 | Ability teleport effects should create `MovementCommand` objects through `AbilityCommandFactory`; other movement-economy effects still stay outside this factory path until their owner is explicit. | recorded | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.teleport.test.ts` | This closes G4 without moving Dash/Disengage economy mutation away from the current action-executor path. |
| D-03 | The command context owns the delegated reactive payload (Required Review Brief Option A). Expose a safe delegated-payload source-of-truth in `CommandContext` so `ReactiveEffectCommand` rehydrates sibling effect commands on trigger and reactive effects execute through the normal command pipeline. | recorded 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9); Required Review Brief in `NORTH_STAR.md`; `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/combat/useActionExecutor.ts` | Decided by Remy (project owner) in the 2026-06-10 batched decision session. Rationale: keeping reactive execution in the command pipeline preserves a single delegated-payload owner instead of splitting it with the inline `useActionExecutor.ts` path. Resolves G1; unblocks T2 implementation with focused trigger-path tests. |

## Open Follow-Up

- G1 is now review-required: decide whether delegated reactive payloads are rehydrated in command context or executed by the combat/turn executor before any forward implementation resumes.
  - *Resolved 2026-06-10 by D-03: command context owns the delegated payload; T2 implementation lane open.*
