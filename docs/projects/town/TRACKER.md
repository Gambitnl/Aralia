# Town Tracker

Status: active
Last updated: 2026-06-05

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Convert Town to implementation-grounded docs and replace initial scaffolding. | Codex | 2026-05-31 | `src/components/Town`, `src/hooks/actions`, `src/state`, `src/types` | Keep doc scope to `docs/projects/town` files only. | File map and integration text now present in NORTH_STAR.md. |
| T2 | active | Validate town entry contract and town-description coupling boundaries. | future owner | 2026-05-31 | `src/App.tsx`, `src/hooks/actions/handleMovement.ts`, `src/state/appState.ts` | Confirm canonical transition is `ENTER_VILLAGE` or document active exception. | Decision note added to GAPS.md with proof location. |
| T3 | active | Stabilize city-state coupling expectations. | future owner | 2026-05-31 | `src/utils/world/settlementGeneration.ts`, `src/types/world.ts`, `src/types/state.ts` | Define whether governing-body/cultural profile belongs in Town state or world state. | Gap row updated with decision check in next review. |
| T4 | done | Register and keep unresolveds in durable GAPS. | Codex | 2026-05-31 | `docs/projects/town/GAPS.md` | Ensure each active gap has a next proof/check. | GAPS table includes status, owner, next check. |

## Update Rules

- Only edit files under `docs/projects/town` in this task.
- Preserve cross-project boundaries:
  - Keep persistence/city-profile implementation decisions in `town-description-system` and world-level contracts in `world`.
- New technical debt items must be logged in `docs/projects/town/GAPS.md` before further claims.

## Next Checks

- Verify whether `TownCanvas` or `VillageScene` should remain the runtime primary and document that decision.
- Verify whether `settlementInfo` should be used by active renderer logic.
- Verify city-state/culture fields that are currently generated but not persisted in town state.
