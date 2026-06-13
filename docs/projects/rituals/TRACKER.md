# Rituals System Living Tracker

Status: active  
Last updated: 2026-06-05  
Owning docs: `NORTH_STAR.md`, `GAPS.md`

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
| RIT-3 | active | Capture and verify ritual execution coupling between combat spell casting and ritual start flow. | Worker A | 2026-06-05 | `src/hooks/combat/useActionExecutor.ts` TODO block, `src/systems/rituals/RitualManager.ts`, `docs/projects/rituals/GAPS.md` RG-1 | Keep the live caller-chain evidence in sync with RG-1 and the combat executor TODO. | Search for live `startRitual(...)` usage outside tests and capture the final call chain. |
| RIT-4 | active | Verify ritual typing, event shape, and duplication cleanup path (`ritual.ts` vs `rituals.ts`). | Worker A | 2026-06-05 | `src/types/ritual.ts`, `src/types/rituals.ts`, `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts`, `docs/projects/rituals/GAPS.md` RG-2/RG-6 | Keep the canonical type path and action payload contract aligned; close or merge `ritual.ts` only after imports are confirmed. | Confirm whether any imports resolve to `ritual.ts` after finalization. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | active | functional | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | No live combat-to-reducer start path for ritual-tagged or long-cast spells. | `src/hooks/combat/useActionExecutor.ts` TODO states long casting should call `startRitual` and set character ritual state. | Add explicit call-site owner and required payload contract. | Validate start flow by locating the first non-test caller of `startRitual`. |
| RG-2 | active | technical-debt | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Ritual event shape is opaque (`RitualEvent` is `unknown` in action types) and reduces reducer safety. | `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts` event cast path. | Weak typing can hide broken interrupt source contracts and hide failed cases. | Draft minimal shared event interface and align action + reducer expectations. | Add compile-safe checks through reducer path with typed event payload. |
| RG-3 | active | design | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Ritual cost and influence integration is undocumented and not present in state/action math. | `docs/projects/PROJECT_TRACKER.md` gap signal and absence in `src` ritual timing/value paths. | Cannot implement economy-aware ritual balancing without defined schema. | Create schema proposal for ritual costs and influence modifiers. | Confirm new fields flow through `RitualState`, casting, and resolver actions. |
| RG-4 | active | architecture | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Duplicate ritual type definitions likely drift (`src/types/ritual.ts` orphan). | `src/types/ritual.ts`, `src/types/rituals.ts`, dependents list in files. | Divergent schema copies create serialization and maintenance risk. | Decide ownership: deprecate or merge and re-export. | Verify one canonical type file is imported by all ritual paths. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
