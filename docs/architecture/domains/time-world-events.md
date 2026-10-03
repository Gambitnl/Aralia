# Time & World Events

Verified: 2026-08-28

## Purpose

This domain covers the systems that model game time, seasonal changes, world
events, faction-level world activity, and the reducers or services that expose
those changes to the rest of the game.

## Canonical Files

### Time lane

| File | Role |
|------|------|
| `src/utils/core/timeUtils.ts` | Core clock primitives: epoch, formatting, season, time-of-day, day-part labels, `GameDuration`, `addGameTime` |
| `src/systems/time/seasonContract.ts` | **G3 (resolved 2026-07-21):** Hard global seasonal modifiers - one source of truth for what a season means mechanically |
| `src/systems/time/CalendarSystem.ts` | Fantasy month names, holidays, moon phases, calendar descriptions |
| `src/systems/time/SeasonalSystem.ts` | Thin consumer delegating to `seasonContract.ts` |
| `src/systems/time/TIME_CONTRACT.md` | **G1 (2026-08-28):** Formal in-world time contract - calendar semantics, bounds, rules |
| `src/utils/core/timekeeperUtils.ts` | Passive tick gating (non-combat/eligible UI state) |
| `src/systems/worldforge/roster/gameClock.ts` | Schedule helpers (`scheduleHourFromGameTime`, `scheduleClockFromGameTime`) |

### World-events and faction lane

| File | Role |
|------|------|
| `src/systems/world/WorldEventManager.ts` | World event generation, scheduling, and triggering |
| `src/systems/world/FactionManager.ts` | Faction state management |
| `src/systems/world/FactionEconomyManager.ts` | Faction-economy overlap |
| `src/systems/world/NobleIntrigueManager.ts` | Noble intrigue system |

### Supporting reducers and state

| File | Role |
|------|------|
| `src/state/reducers/worldReducer.ts` | Owns `ADVANCE_TIME` transition + day-boundary triggering |
| `src/state/reducers/religionReducer.ts` | Ritual time tracking |

## Time Progression Contract

- `gameTime` is a **UTC `Date`** in `GameState.gameTime`.
- Time advances via `ADVANCE_TIME` action dispatched by player actions.
- `worldReducer.ts` owns the transition and triggers downstream systems on
  day boundaries (rituals, world events, underdark).
- Passive ticks gated via `timekeeperUtils.ts`; `App.tsx` runs the passive loop.
- Epoch: Year 351, January 1, 00:00:00 UTC.

## Season Contract (G3 - resolved 2026-07-21)

Hard global contract: `getSeasonState(gameTime)` in `seasonContract.ts` is the
one source of truth. Movement wired: route planning reads `timeCostMultiplier`.
Encounters/economy/farming documented as extension seams (neutral 1.0).

## Day-Part Labels (G5 - resolved 2026-07-21)

`getDayPartLabel(gameTime)` in `timeUtils.ts` reads the character's local
in-world clock (`getUTCHours`). Four social builders use this; no more
host-timezone `.getHours()` in dialogue.

## In-World Time Contract (G1 - 2026-08-28)

Formal contract in `src/systems/time/TIME_CONTRACT.md`. Defines:
- Proleptic Gregorian calendar with fantasy month aliases
- Bounded range: year 351-9999
- Season definitions, time-of-day periods, moon phases, holidays
- Extension seams for future era system

## Tests

- `src/systems/time/__tests__/seasonContract.test.ts` - determinism, modifiers, save round-trip
- `src/utils/core/__tests__/timeUtils.test.ts` - epoch, formatting, season, time-of-day, day-part labels
- `src/systems/time/__tests__/CalendarSystem.test.ts` - month names, holidays, moon phases
- `src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts` - day-boundary regression
