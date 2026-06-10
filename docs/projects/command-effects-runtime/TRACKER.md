# TRACKER: Command Effects Runtime

Status: review-required
Last updated: 2026-06-09

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
| T1 | done | Document command-effects runtime state and gap surface from `src/commands/effects` | Worker C | 2026-05-31 | `src/commands/effects`, `src/commands/factory`, `src/types/spells.ts` | Keep docs aligned if source changes | `NORTH_STAR.md` and this tracker remain source-accurate |
| T2 | blocked | Resolve the delegated reactive payload ownership question before any forward implementation | Human/product owner | 2026-06-09 | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/combat/useActionExecutor.ts` | Record the Required Review Brief decision, then resume G1 only if a concrete payload-owner contract is approved | Source-backed command/effect tests after the decision |

## Gap Log

- `T1` closed by this docs update.
- `T2` is now blocked on the G1 review brief; `G4` remains resolved through explicit teleport dispatch in `AbilityCommandFactory`.
- Gap surface tracked in `docs/projects/command-effects-runtime/GAPS.md`:
  - `G1` Reactive callback path is review-required until the delegated payload owner is decided.
  - `G3` Rider support scope is limited.
  - `G4` Ability movement mapping can collapse semantics. This is now resolved through explicit teleport dispatch in `AbilityCommandFactory`.
  - `G5` Status cleanup lifecycle is cross-system.
  - `G2` Teleport budget and movement metadata behavior is resolved with source-backed log proof.
