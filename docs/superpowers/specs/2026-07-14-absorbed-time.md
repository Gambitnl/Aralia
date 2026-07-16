# Absorbed: Time system (docs/projects/time)

Absorbed into the planmap topic `generational-time` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live operational context.

## What this project was

Documentation of the implemented Time System boundary: time advances through one action
contract (`ADVANCE_TIME`) and routes through shared reducers/systems.

## Implemented state

- Canonical clock: `gameTime` (UTC `Date`) + `shortRestTracker` in state.
- Progression path: handlers dispatch `ADVANCE_TIME`; `worldReducer` owns the transition and downstream triggering (rituals/world events; underdark and day-bound systems on day boundary).
- Calendar split: `CalendarSystem` (textual/calendar, holiday/moon), `SeasonalSystem` (movement/resource modifiers).
- Passive ticks gated via `timekeeperUtils.ts` (non-combat/eligible UI state); `src/App.tsx` runs the passive clock loop.

## File map

`src/state/actionTypes.ts`, `src/types/state.ts`, `src/initialState.ts`,
`src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts`,
`src/utils/core/timeUtils.ts`, `src/utils/core/timekeeperUtils.ts`,
`src/systems/time/CalendarSystem.ts`, `src/systems/time/SeasonalSystem.ts`,
handlers: `handleMovement.ts`, `handleResourceActions.ts`, `handleObservation.ts`,
`handleOracle.ts`, `actionHandlers.ts`. UI: `CompassPane/index.tsx`, `PassTimeModal.tsx`,
`TimeWidget.tsx`, `useQuickTravel.ts`, `useDayNightOverlay.ts`.

## Open gaps carried into the planmap (as features on `generational-time`)

| Gap | Summary | Evidence |
|---|---|---|
| G1 | World-time semantics are `Date`-based and implicitly Gregorian; define a bounded in-world time contract before calendar/era rules expand | `src/utils/core/timeUtils.ts`, `src/systems/time/Time_Ralph.md` |
| G3 | Seasonal modifiers are not a universal simulation contract; decide hard global contract vs movement-only subsystem | `src/systems/time/SeasonalSystem.ts`, `handleMovement.ts` |
| G4 | Rest transitions across ticks/rest boundaries still fragile; add targeted short/long-rest + day-boundary tests | `handleResourceActions.ts`, `worldReducer.ts` |
| G5 | Social-context builders derive day-part labels from raw `Date` hours while shared helper uses UTC + Dawn/Day/Dusk/Night vocabulary; decide the dialogue label contract | `timeUtils.ts`; `handleNpcInteraction.ts`; `useConversation.ts`; `useCompanionBanter.ts` |

## Done work on record

- G2 resolved: day-boundary regression test across world/ritual reducers —
  `src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts` (7 tests) proves
  day-boundary crossing, literal elapsed-second ritual advance, completion-at-boundary
  stamps POST-advance gameTime, ritualReducer-alone stamps PRE-advance time.
