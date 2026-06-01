# Rituals System Tracker

Status: active  
Last updated: 2026-05-31  
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
| RIT-1 | done | Replace ritual project scaffold with source-anchored North Star details, file map, and scope boundaries. | Worker A | 2026-05-31 | `src/systems/rituals`, `src/state/reducers/ritualReducer.ts`, `src/utils/core/spellTimeUtils.ts` | Keep docs synchronized with current source and move to gap extraction. | Confirm NORTH_STAR references only owner-scoped files under `src/systems/rituals` and `src/state`. |
| RIT-2 | done | Convert `TRACKER.md` and `GAPS.md` into concrete evidence-backed tasks instead of placeholders. | Worker A | 2026-05-31 | `docs/projects/rituals/TRACKER.md`, `docs/projects/rituals/GAPS.md`, relevant source/tests/docs | Keep `RITUAL`-scoped gaps and remove scaffold-only rows. | All tracked rows should include file evidence and status. |
| RIT-3 | active | Capture and verify ritual execution coupling between combat spell casting and ritual start flow. | Worker A | 2026-05-31 | `src/hooks/combat/useActionExecutor.ts` TODO block, `src/systems/rituals/RitualManager.ts` | Add a concrete gap row for the start path and map required caller contract. | Search for live `startRitual(...)` usage outside tests and document final call chain. |
| RIT-4 | active | Verify ritual typing, event shape, and duplication cleanup path (`ritual.ts` vs `rituals.ts`). | Worker A | 2026-05-31 | `src/types/ritual.ts`, `src/types/rituals.ts`, `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts` | Decide whether `ritual.ts` is removable or merged, then lock action payload typing. | Confirm whether any imports resolve to `ritual.ts` after finalization. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | active | functional | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | No live combat-to-reducer start path for ritual-tagged or long-cast spells. | `src/hooks/combat/useActionExecutor.ts` TODO states long casting should call `startRitual` and set character ritual state. | Add explicit call-site owner and required payload contract. | Validate start flow by locating the first non-test caller of `startRitual`. |
| RG-2 | active | technical-debt | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Ritual event shape is opaque (`RitualEvent` is `unknown` in action types) and reduces reducer safety. | `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts` event cast path. | Weak typing can hide broken interrupt source contracts and hide failed cases. | Draft minimal shared event interface and align action + reducer expectations. | Add compile-safe checks through reducer path with typed event payload. |
| RG-3 | active | design | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Ritual cost and influence integration is undocumented and not present in state/action math. | `docs/projects/PROJECT_TRACKER.md` gap signal and absence in `src` ritual timing/value paths. | Cannot implement economy-aware ritual balancing without defined schema. | Create schema proposal for ritual costs and influence modifiers. | Confirm new fields flow through `RitualState`, casting, and resolver actions. |
| RG-4 | active | architecture | Worker A | `docs/projects/rituals/GAPS.md` | scoped doc pass | Duplicate ritual type definitions likely drift (`src/types/ritual.ts` orphan). | `src/types/ritual.ts`, `src/types/rituals.ts`, dependents list in files. | Divergent schema copies create serialization and maintenance risk. | Decide ownership: deprecate or merge and re-export. | Verify one canonical type file is imported by all ritual paths. |
