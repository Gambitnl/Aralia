/**
 * @file gameClock.ts
 * @description The pure, safe bridge from the game clock to the agent schedule:
 * the game stores time as a UTC `Date` (epoch year 351), and the occupant
 * schedule is keyed on hour-of-day 0–23. This maps between them in one place so
 * the live overlay / 3D agent pass and any tests agree on "what hour is it".
 *
 * No game-state coupling beyond the `Date` itself — callers read `state.gameTime`
 * and pass it in. Pure and deterministic.
 */

/** Whole hour-of-day (0–23) for the schedule, from a game-clock `Date`. */
export function scheduleHourFromGameTime(gameTime: Date): number {
  return gameTime.getUTCHours();
}

/**
 * Fractional hour-of-day (0–24) — hour plus minute fraction — for smoothly
 * interpolating an agent across its commute window (feeds `positionAlongPath`).
 */
export function scheduleClockFromGameTime(gameTime: Date): number {
  return gameTime.getUTCHours() + gameTime.getUTCMinutes() / 60 + gameTime.getUTCSeconds() / 3600;
}

/**
 * Progress (0–1) through an [startHour, endHour) window at the given fractional
 * clock, e.g. how far along a commute or work shift. Clamped; returns 0 before
 * the window and 1 after. Windows that wrap past midnight are not handled here
 * (commutes/shifts are intraday in the current schedule).
 */
export function windowProgress(clock: number, startHour: number, endHour: number): number {
  if (endHour <= startHour) return clock >= startHour ? 1 : 0;
  if (clock <= startHour) return 0;
  if (clock >= endHour) return 1;
  return (clock - startHour) / (endHour - startHour);
}
