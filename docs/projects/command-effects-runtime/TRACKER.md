# Command Effects Runtime Living Tracker

Status: active - T2/G1 delegated reactive payload execution implemented
Last updated: 2026-06-19

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
| T2 | done | Resolve the delegated reactive payload ownership question before any forward implementation | Worker C | 2026-06-19 | `src/commands/base/SpellCommand.ts` now exposes `delegatedReactivePayload`; `src/commands/effects/ReactiveEffectCommand.ts` rehydrates supported sibling commands through `CommandExecutor`; `src/commands/effects/__tests__/ReactiveEffectCommand.test.ts` proves a movement trigger commits delegated damage. | Closed for the T2 slice; keep inline executor behavior untouched until a later owner explicitly redirects uncovered cases | `npx vitest run src\commands\effects\__tests__\ReactiveEffectCommand.test.ts` passed 2 tests on 2026-06-19 |

## Gap Log

- `T1` closed by this docs update.
- `T2` is done for this slice. The command context owns a minimal delegated reactive payload handle, and `ReactiveEffectCommand` can execute that payload through `CommandExecutor` when its registered trigger fires.
- Gap surface tracked in `docs/projects/command-effects-runtime/GAPS.md`:
  - `G1` Reactive callback path is resolved for command-context-owned delegated payloads.
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
