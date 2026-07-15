# Action Pane — absorbed spec

**Status:** parked (idle). No open gaps as of 2026-07-11.

## What it is

The Action Pane is the primary player command surface in the PLAYING layout. It emits movement, interaction, and context actions. The action dispatch entrypoint is `processAction` in `src/hooks/useGameActions.ts`. Action routing is centralized in `src/hooks/actions/actionHandlers.ts` with system UI handling in `src/hooks/actions/handleSystemAndUi.ts`.

## Current action surface

- **Dynamic context**: generated from `useActionGeneration` (exit, item pickup, NPC talk rules)
- **Manual commands**: `ask_oracle`, `ANALYZE_SITUATION`, `SHORT_REST`, `LONG_REST`
- **Town actions**: `APPROACH_TOWN`, `OBSERVE_TOWN` (triggered in PLAYING phase from the world map)
- **System actions**: toggle_* actions, save_game, go_to_main_menu, game-guide/logs/book/modals

## Stable decisions (recorded)

**D-01:** Pane system-menu and quick-command contract is validated by focused integration tests (not by deleting legacy surfaces). See `src/components/ActionPane/__tests__/ActionPane.test.tsx`.

**D-02:** `isDevDummyActive` prop removed from the ActionPane render path. Developer-entry flow stays owned by menu surfaces.

**D-03:** Move actions arrive with string `targetId` from `useActionGeneration`; `ActionButton` passes them through unchanged (no rewrite at click time).

**D-04:** `APPROACH_TOWN` and `OBSERVE_TOWN` ownership stays with exploration/movement action handlers (triggered in PLAYING phase).

## Resolved gap (G1, done 2026-07-11)

**Issue:** `LongRestModal` dispatched `LONG_REST` directly from `GameModals`, bypassing `processAction` and the full `handleLongRest` — skipping planar-rest rules, overnight events, journal rollover, and time advance.

**Fix:** Confirmation now emits the gameplay `LONG_REST` action through `onAction`; the handler owns all overnight effects plus the eight-hour advance.

**Verification:** 48 focused tests; live 10:40-to-18:40 advance with overnight messages.

## Next step

Keep action contracts stable. Reopen only when new action types or dispatch paths are added to PLAYING phase.
