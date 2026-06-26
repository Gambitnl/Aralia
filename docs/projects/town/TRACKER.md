# Town Living Tracker

Status: active
Last updated: 2026-06-25

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
| T2 | active | Validate town entry contract and town-description coupling boundaries. | future owner | 2026-05-31 | `src/App.tsx`, `src/hooks/actions/handleMovement.ts`, `src/state/appState.ts` | Confirm canonical transition is `ENTER_VILLAGE` or document active exception. | Decision note added to GAPS.md with proof location. |
| T3 | active | Stabilize city-state coupling expectations. | future owner | 2026-05-31 | `src/utils/world/settlementGeneration.ts`, `src/types/world.ts`, `src/types/state.ts` | Define whether governing-body/cultural profile belongs in Town state or world state. | Gap row updated with decision check in next review. |
| T4 | not_started | Decide whether `VillageScene` remains a documented secondary surface or should be decommissioned/activated. | future owner | 2026-06-25 | `docs/projects/town/GAPS.md` G4; `src/App.tsx`; `src/components/Town/TownCanvas.tsx`; `src/components/Town/VillageScene.tsx` | Keep App routing through TownCanvas unless an owner explicitly changes the render-surface contract. | Decision note plus tests/integration notes prove the intended primary and secondary surfaces. |

## Update Rules

- Only edit files under `docs/projects/town` in this task.
- Preserve cross-project boundaries:
  - Keep persistence/city-profile implementation decisions in `town-description-system` and world-level contracts in `world`.
- New technical debt items must be logged in `docs/projects/town/GAPS.md` before further claims.

## Next Checks

- Verify whether `TownCanvas` or `VillageScene` should remain the runtime primary and document that decision.
- Verify whether `settlementInfo` should be used by active renderer logic.
- Verify city-state/culture fields that are currently generated but not persisted in town state.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
