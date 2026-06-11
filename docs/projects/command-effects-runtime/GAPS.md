# Command Effects Runtime Gap Registry

Status: active — G1 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

Use this file for durable unresolved findings that belong to command-effects-runtime.

Current focus: `G1` was review-required because the delegated payload owner
was not exposed in the command context; decided 2026-06-10 — the command
context owns the delegated payload (`docs/projects/DECISION_BLITZ_2026-06-10.md` D9). `G2` was resolved this pass with
explicit teleport budget metadata, and `G4` is now resolved through explicit
teleport dispatch in `AbilityCommandFactory`. `G3` and `G5` remain parked as
follow-ups until the command path or ownership evidence changes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | source/context review | Reactive effects register but do not execute delegated command payloads because the command context does not expose a safe delegated payload source-of-truth | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/types/state.ts`, `src/hooks/combat/useActionExecutor.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9) | Reactive spells and defensive loops are currently listener-only and lose effect impact | **Decided 2026-06-10 (Remy, DECISION_BLITZ D9):** the command context owns the delegated payload — expose a safe delegated-payload source-of-truth in `CommandContext` so `ReactiveEffectCommand` rehydrates delegated commands and reactive effects execute through the normal command pipeline; implementation lane open | focused trigger-path tests proving a reactive payload executes via the command-context owner and logs its state change |
| G3 | active | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Non-damage/complex riders are only partially routed through `RegisterRiderCommand` | `src/commands/effects/RegisterRiderCommand.ts`, `src/commands/factory/SpellCommandFactory.ts` | Hit riders can silently do nothing beyond damage-only support | decide rider schema expansion or add owner note to prevent silent drops | update command selection docs and tests |
| G5 | active | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | docs update scan | Status and condition turn cleanup lifecycle is implemented outside this command layer | `src/commands/effects/StatusConditionCommand.ts` | Status expiry can diverge from expected cleanup timing | hand off to owning lifecycle subsystem and keep API contract here | add follow-up in owner project if behavior changes |

## Resolved Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Evidence/source | Resolution | Next proof/check |
|---|---|---|---|---|---|---|---|
| G2 | done | support_needed_now | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | `src/commands/effects/MovementCommand.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts` | Teleport resolution now records requested budget, tile budget, actual travel, remaining budget, and bounds/fallback flags in the combat log without changing movement behavior. | Revisit only if teleport budget semantics or map clamping rules change. |
| G4 | done | adjacent_follow_up | Worker C | `docs/projects/command-effects-runtime/TRACKER.md` | `src/commands/factory/AbilityEffectMapper.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.teleport.test.ts` | Teleport ability effects now retain explicit dispatch through `AbilityCommandFactory`, so they no longer collapse into the generic push fallback. | Revisit if the ability movement payload shape grows another explicit subtype or the factory bridge changes. |

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
