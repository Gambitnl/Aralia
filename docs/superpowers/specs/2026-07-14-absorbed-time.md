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
| G4 | Rest transitions across ticks/rest boundaries still fragile; add targeted short/long-rest + day-boundary tests | `handleResourceActions.ts`, `worldReducer.ts` |

## Done work on record

- G2 resolved: day-boundary regression test across world/ritual reducers —
  `src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts` (7 tests) proves
  day-boundary crossing, literal elapsed-second ritual advance, completion-at-boundary
  stamps POST-advance gameTime, ritualReducer-alone stamps PRE-advance time.
- G3 resolved 2026-07-21 (Remy's call: HARD GLOBAL CONTRACT): seasons are one source of
  truth in `src/systems/time/seasonContract.ts` — `getSeasonState(gameTime)` is a pure,
  deterministic, save-safe function of the persisted clock. Movement is wired: route
  planning takes `timeCostMultiplier` (`routePlanning.ts`) and MapPane passes the
  contract's seasonal multiplier (winter routes honestly take 1.5x). The diverged
  winter 1.25 in `timeUtils.getTimeModifiers` is dead — `getTimeModifiers` moved into
  the contract and composes contract season x night. `SeasonalSystem` delegates to the
  contract. Encounters/economy/farming are documented extension seams on the contract
  (neutral 1.0 until a consumer lands). Tests:
  `src/systems/time/__tests__/seasonContract.test.ts` (determinism, save round-trip,
  seams), `src/systems/travel/__tests__/routePlanning.test.ts` (seasonal scaling).
- G5 resolved 2026-07-21 (Remy's call: CHARACTER'S LOCAL IN-WORLD TIME): day-part words
  come from `getDayPartLabel(gameTime)` in `timeUtils.ts`, which reads the local
  in-world clock (`getUTCHours` — the same clock the HUD renders). The four social
  builders (`handleNpcInteraction`, `useConversation`, `useCompanionBanter`,
  `useCompanionCommentary`) no longer call host-timezone `.getHours()`;
  `adventureLog.formatGameClock` now stamps the in-world clock too. Residual: the 3D
  sky/lighting hour sources (`EnhancedSkyDome`, `lighting.ts`, `World3DWrapper`,
  `App.tsx` ambush loader) still use host-local `.getHours()` — visual clock, flagged
  separately.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-07-14-absorbed-time.md","sha256WithoutMarker":"03d24eb56a0efa4ed4b260e0e14588390b710f0a4d9a14c33e0d7fc4511dc8da","markedAtUtc":"2026-08-09T20:24:24.666Z"} -->
