# Command Effects Runtime Decisions

Status: review-required
Last updated: 2026-06-09

This file records durable command-effects runtime decisions that future agents
should preserve while closing the remaining execution gaps.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | Teleport resolution belongs to `MovementCommand`, including bounds/fallback handling and combat-log budget metadata. | recorded | `src/commands/effects/MovementCommand.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts` | Keep teleport landing semantics in the command layer instead of duplicating them in ability factories. |
| D-02 | Ability teleport effects should create `MovementCommand` objects through `AbilityCommandFactory`; other movement-economy effects still stay outside this factory path until their owner is explicit. | recorded | `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.teleport.test.ts` | This closes G4 without moving Dash/Disengage economy mutation away from the current action-executor path. |

## Open Follow-Up

- G1 is now review-required: decide whether delegated reactive payloads are rehydrated in command context or executed by the combat/turn executor before any forward implementation resumes.
