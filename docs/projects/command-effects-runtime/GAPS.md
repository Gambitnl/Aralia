# GAPS: Command Effects Runtime

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong to command-effects-runtime.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Reactive effects register but do not execute delegated command payloads | `src/commands/effects/ReactiveEffectCommand.ts` | Reactive spells and defensive loops are currently listener-only and lose effect impact | implement command execution on trigger and add regression test | trigger path tested via unit/integration run |
| G2 | active | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Teleport and forced movement have TODO-driven budget/bounds semantics | `src/commands/effects/MovementCommand.ts` | Movement outcomes can be inconsistent across range-limited and map-bound cases | add explicit movement metadata contract and tests | confirm with move/teleport-focused command test updates |
| G3 | active | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Non-damage/complex riders are only partially routed through `RegisterRiderCommand` | `src/commands/effects/RegisterRiderCommand.ts`, `src/commands/factory/SpellCommandFactory.ts` | Hit riders can silently do nothing beyond damage-only support | decide rider schema expansion or add owner note to prevent silent drops | update command selection docs and tests |
| G4 | active | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Ability movement mapping can collapse `teleport` into default push | `src/commands/factory/AbilityEffectMapper.ts` | Movement ability semantics can change unintentionally across command boundaries | define explicit ability-to-movement mapping and add migration checks | confirm mapping in factory tests |
| G5 | active | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Status and condition turn cleanup lifecycle is implemented outside this command layer | `src/commands/effects/StatusConditionCommand.ts` | Status expiry can diverge from expected cleanup timing | hand off to owning lifecycle subsystem and keep API contract here | add follow-up in owner project if behavior changes |

## Classification Reference

- `in_scope_now`: must be handled before task completion.
- `support_needed_now`: immediate follow-up required before full parity.
- `adjacent_follow_up`: known but outside this task slice.
- `out_of_scope`: intentionally ignored for this project.
- `blocked_human_decision`: blocked on owner or external policy choice.
- `blocked_external_state`: blocked by another actor or system state.

## Update Rules

- Keep each gap tied to source evidence and a next proof condition.
- Move resolved gaps out of this table only with evidence or explicit blocker update.
- Prefer adjacent tracking to avoid expanding this project into unrelated lifecycle ownership.
