# Command Effects Runtime Living Tracker

Status: active â€” G1 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

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
| T2 | active | Resolve the delegated reactive payload ownership question before any forward implementation | Worker C | 2026-06-10 | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/combat/useActionExecutor.ts`. **Decision recorded 2026-06-10 (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D9):** command context owns the delegated payload. | Implement the approved contract: expose the delegated-payload source-of-truth in `CommandContext` and rehydrate delegated commands in `ReactiveEffectCommand` | Focused trigger-path tests proving the command-context owner executes a reactive payload |

## Gap Log

- `T1` closed by this docs update.
- `T2` is now blocked on the G1 review brief; `G4` remains resolved through explicit teleport dispatch in `AbilityCommandFactory`. *(2026-06-10: the G1 review brief is resolved â€” command context owns the delegated payload, DECISION_BLITZ D9 â€” so T2 is unblocked for implementation.)*
- Gap surface tracked in `docs/projects/command-effects-runtime/GAPS.md`:
  - `G1` Reactive callback path is review-required until the delegated payload owner is decided.
  - `G3` Rider support scope is limited.
  - `G4` Ability movement mapping can collapse semantics. This is now resolved through explicit teleport dispatch in `AbilityCommandFactory`.
  - `G5` Status cleanup lifecycle is cross-system.
  - `G2` Teleport budget and movement metadata behavior is resolved with source-backed log proof.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
