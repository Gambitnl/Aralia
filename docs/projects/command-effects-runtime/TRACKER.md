# TRACKER: Command Effects Runtime

Status: active
Last updated: 2026-05-31

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
| T2 | active | Track and close core execution gaps: reactive execution, teleport/budget behavior, ability movement mapping | Worker C | 2026-05-31 | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/effects/MovementCommand.ts`, `src/commands/factory/AbilityEffectMapper.ts` | Update `GAPS.md` after each behavioral discovery | Run focused grep on effect and factory files after each change |

## Gap Log

- `T1` closed by this docs update.
- Durable unresolved behavior gaps are tracked in `docs/projects/command-effects-runtime/GAPS.md`:
  - `G1` Reactive callback path is incomplete.
  - `G2` Teleport budget and movement metadata behavior is partial.
  - `G3` Ability movement mapping can collapse semantics.
  - `G4` Rider support scope is limited.
  - `G5` Status cleanup lifecycle is cross-system.
