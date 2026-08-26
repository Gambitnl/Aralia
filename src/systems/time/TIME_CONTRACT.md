# In-World Time Contract (G1)

**Status:** Active (2026-08-28)
**Canonical source:** `src/systems/time/seasonContract.ts` (seasonal modifiers),
`src/utils/core/timeUtils.ts` (clock primitives), `src/systems/time/CalendarSystem.ts` (calendar names)

## Purpose

This contract defines what the in-world clock **means** — its structure, bounds,
and rules — so every system that reads `gameTime` agrees on the same semantics.
Before this contract, calendar behavior was implicit in JavaScript `Date` usage
patterns. This document makes the rules explicit and testable.

## Core Rules

### 1. The Clock

- `gameTime` is a **UTC `Date`** persisted in game state (`GameState.gameTime`).
- All game-visible time reads use **UTC fields** (`getUTCHours`, `getUTCMonth`, etc.).
  Never use local-timezone fields (`.getHours()`, `.getMonth()`) for game logic or
  player-facing text.
- The epoch is **Year 351, January 1, 00:00:00 UTC** (`GAME_EPOCH` in `timeUtils.ts`).
  Year 351 is an arbitrary fantasy date chosen to avoid collision with real-world
  years while keeping the `Date` API's full precision.

### 2. Calendar Structure

The in-world calendar follows **proleptic Gregorian** semantics:

- **12 months** per year, indexed 0–11 (January = 0).
- **Month names** are fantasy aliases for Gregorian months (see `CalendarSystem.ts`):
  | Index | Gregorian | In-World Name |
  |-------|-----------|---------------|
  | 0 | January | Deepwinter |
  | 1 | February | The Claw of Winter |
  | 2 | March | The Claw of Sunsets |
  | 3 | April | The Claw of Storms |
  | 4 | May | The Melting |
  | 5 | June | The Time of Flowers |
  | 6 | July | Highsun |
  | 7 | August | The Fading |
  | 8 | September | Leaffall |
  | 9 | October | The Rotting |
  | 10 | November | The Drawing Down |
  | 11 | December | The Long Night |

- **Leap years** follow Gregorian rules (divisible by 4, except centuries,
  except 400-century exceptions). Year 352 is a leap year (352 % 4 === 0).
- **Days per month** follow Gregorian rules (28/29/30/31).
- **Year length** is 365 or 366 days (leap year).

### 3. Time Progression

- Time advances via the `ADVANCE_TIME` action, dispatched by player actions
  (movement, resting, crafting, etc.).
- The reducer in `worldReducer.ts` owns the transition and triggers downstream
  systems on day boundaries (rituals, world events, underdark mechanics).
- Passive time ticks are gated via `timekeeperUtils.ts` (non-combat/eligible
  UI state); `App.tsx` runs the passive clock loop.

### 4. Bounded Range

The in-world calendar is **bounded** to prevent overflow and undefined behavior:

- **Minimum valid date:** Year 351, January 1, 00:00:00 UTC (the epoch).
  No date before the epoch is valid — the world did not exist.
- **Maximum valid date:** Year 9999, December 31, 23:59:59 UTC.
  This is the `Date` API's practical upper bound. In-world, this represents
  "the distant future" — far beyond any generational timescale.
- **Practical range:** The generational-time system projects ~8 in-game years
  per real-world year of play. A 50-year campaign spans ~6 real-world years
  and ~20,000 game days — well within bounds.

### 5. Seasons

Seasons are derived deterministically from `gameTime` via `getSeason()` in
`timeUtils.ts`:

| Season | Months (UTC) |
|--------|-------------|
| Winter | Dec (11), Jan (0), Feb (1) |
| Spring | Mar (2), Apr (3), May (4) |
| Summer | Jun (5), Jul (6), Aug (7) |
| Autumn | Sep (8), Oct (9), Nov (10) |

Seasonal modifiers live in `seasonContract.ts` (G3 — hard global contract).
Every system reads through `getSeasonState(gameTime)` — no duplicate tables.

### 6. Time of Day

Time of day is derived from `gameTime.getUTCHours()`:

| Period | Hours (UTC) |
|--------|-------------|
| Dawn | 5–6 |
| Day | 7–16 |
| Dusk | 17–19 |
| Night | 20–4 |

Day-part labels for dialogue/social context (G5) use `getDayPartLabel()`:
Morning (6–11), Afternoon (12–17), Evening (18–23), Night (0–5).

### 7. Moon Phases

The moon cycles every **28 game days**, deterministic from `getGameDay()`:
New Moon → Waxing Crescent → First Quarter → Waxing Gibbous → Full Moon →
Waning Gibbous → Last Quarter → Waning Crescent.

### 8. Holidays

Five fixed-date holidays (see `CalendarSystem.ts`):

| Holiday | Date | Season |
|---------|------|--------|
| Midwinter Festival | Jan 15 | Winter |
| Greengrass | Apr 1 | Spring |
| Midsummer Feast | Jul 15 | Summer |
| Harvestide | Oct 1 | Autumn |
| Feast of the Moon | Nov 10 | Autumn |

## What This Contract Does NOT Cover

- **Era system:** No in-world eras or age counts exist yet. When eras are
  added, they layer on top of this contract (e.g., "Year 3 of the Third Era"
  = Gregorian year 351 + offset).
- **Fantasy calendar divergence:** The calendar is Gregorian-aliased today.
  If a future design calls for a 13-month or 360-day calendar, this contract
  must be updated and all consumers audited.
- **Real-world timezone:** The game clock is always UTC. Real-world timezone
  conversion is irrelevant to game logic.

## Tests

- `src/systems/time/__tests__/seasonContract.test.ts` — determinism, seasonal
  modifiers, save round-trip.
- `src/utils/core/__tests__/timeUtils.test.ts` — epoch, formatting, season,
  time-of-day, day-part labels.
- `src/systems/time/__tests__/CalendarSystem.test.ts` — month names, holidays,
  moon phases.

## Extension Seams

The season contract exposes neutral-1.0 multipliers for systems not yet wired:

- `encounterRateMultiplier` — random-encounter chance per season.
- `priceMultiplier` — market prices per season.
- `growthMultiplier` — crop/plant growth per season.

Set real values **with** the consuming system, not before.
