# Physics System Gap Registry

Status: review-required
Last updated: 2026-06-05

The routing classes below follow the shared iteration workflow: `in_scope_now`,
`support_needed_now`, `adjacent_follow_up`, `out_of_scope`,
`blocked_human_decision`, and `blocked_external_state`.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Elemental reaction resolution is single-step only. A result state is applied and the function returns without checking a second reaction pair. | `src/systems/physics/ElementalInteractionSystem.ts`, `src/systems/physics/Physics_Ralph.md` | Rules may under-model chained effects like `frozen + burning` when `burning` arrived first. | Add a recursive resolution policy and tests, or explicitly document single-step behavior as intentional. | Add regression tests for chained interactions.
| G2 | open | in_scope_now | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | `stateTags` are defined on `CombatCharacter`, but elemental state transitions are not called from damage/status execution. | `src/types/elemental.ts`, `src/commands/effects/DamageCommand.ts`, `src/commands/effects/StatusConditionCommand.ts`, `src/types/combat.ts` | Combat currently applies damage, resistances, and status, but misses structured state propagation for Wet/Burning/Frozen-like reactions. | Define command-level mapping from damage element to target state and wire it through command execution. | Add coverage for at least one physical spell/effect flow using elemental transitions.
| G3 | open | in_scope_now | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Tile environment effects are persisted and consumed through mixed fields (`environmentalEffects` vs `environmentalEffect`). | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | Inconsistent consumers can skip cleanup, double-apply, or miss effects at round boundaries. | Choose one canonical map shape and migrate both mutators and readers. | Run round and movement tests after migration proof.
| G4 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | LOS ignores elevation and only checks `blocksLoS`, while map tiles track elevation. | `src/utils/spatial/lineOfSight.ts`, `src/utils/spatial/__tests__/lineOfSight.test.ts` | Tactical visibility may diverge from intended 3d edge behavior. | Decide if elevation-aware LOS is required for project scope and add tests if adopted. | Add line-of-sight test cases with elevation contrasts.
| G5 | open | support_needed_now | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Movement opportunity handling is retroactive after commit with explicit note. | `src/hooks/combat/useActionExecutor.ts` movement execution comments and flow | OA timing can alter edge-case outcomes for Sentinel, disengage-like effects, and forced movement. | Decide whether event order must be made event-based with pre-commit trigger order. | Add deterministic event-order tests around move + OA interaction.
| G6 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Object-level collision/AC/HP hooks are utility stubs and are not fully connected to combat target flow. | `src/utils/physicsUtils.ts`, `src/systems/physics/ElementalInteractionSystem.ts` | Missing behavior can block future rules work and keep combat targeting assumptions implicit. | Classify the object-combat hooks as near-term work or deferred debt. | Add a concrete owner and next proof once the route is chosen.
| G7 | open | blocked_human_decision | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Suffocation integration remains a TODO in `physicsUtils` and is not routed into combat or environment resolution. | `src/utils/physicsUtils.ts` | Oxygen and pressure style rules can stay invisible to later tasks if they remain unowned. | Pick an owner and either slot it into near-term scope or explicitly defer it. | Add a narrow task or a documented deferral decision.
| G8 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/TRACKER.md` | Documentation pass | Throw-distance integration remains a TODO and is not linked to inventory or forced-movement flow. | `src/utils/physicsUtils.ts` | Future throw and shove rules need a stable distance contract. | Define the distance source and route it to the owning system. | Add one physics or combat proof once the route is chosen.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
