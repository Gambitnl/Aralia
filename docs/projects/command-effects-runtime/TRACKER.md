# TRACKER: Command Effects Runtime

Status: active
Last updated: 2026-06-08

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
| T2 | active | Track and close core execution gaps: reactive execution, teleport/budget behavior, ability movement mapping | Worker C | 2026-06-08 | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/effects/MovementCommand.ts`, `src/commands/factory/AbilityEffectMapper.ts` | Keep G1 and G4 as the active slice; G2 is resolved and documented in `GAPS.md` | Run focused grep on effect and factory files after each change |

## Gap Log

- `T1` closed by this docs update.
- `T2` remains active and is currently centered on `G1` and `G4`.
- Gap surface tracked in `docs/projects/command-effects-runtime/GAPS.md`:
  - `G1` Reactive callback path is incomplete.
  - `G3` Rider support scope is limited.
  - `G4` Ability movement mapping can collapse semantics.
  - `G5` Status cleanup lifecycle is cross-system.
  - `G2` Teleport budget and movement metadata behavior is resolved with source-backed log proof.
