/**
 * @file crowdRenderClock.ts — a smooth drawing clock for the street crowd.
 *
 * The game clock moves in whole game seconds: `useAppPhaseClock` dispatches
 * ADVANCE_TIME once a real second. A walker covers 1.2 m in that second, so a
 * crowd drawn straight from the game clock hopped 1.2 m once a second (NPC
 * life stock-take, 2026-11-02). This clock runs between those ticks at the
 * rate the source clock has been moving, and never runs past the next
 * expected tick, so the crowd glides and stays in step with the game.
 *
 * Rules:
 * - A small forward step of the source (up to MAX_TICK_GAME_S) is a tick. The
 *   rate is that step over the real time since the last tick.
 * - A step back, or a big step forward (wait, rest, travel), is a jump: the
 *   drawing clock snaps to it and assumes the normal game rate (one game
 *   second per real second) until the next tick measures it. A source that
 *   then stays still lets the clock run at most one second ahead.
 * - Midnight (23.99 → 0.00) is a small forward step, not a jump.
 * - The drawing clock never moves backward between snaps.
 *
 * The returned clock is UNWRAPPED (it may pass 24); motion functions wrap it.
 * Pure state + function, no React and no three.js.
 */

/** A source step larger than this (game seconds) is a time skip, not a tick. */
export const MAX_TICK_GAME_S = 120;
/** Highest believable clock rate (game seconds per real second). */
const MAX_RATE = 600;

export interface CrowdRenderClock {
  /** Last source value seen (hours, as the source gave it). */
  source: number;
  /** The same source value, unwrapped across midnight (hours). */
  sourceUnwrapped: number;
  /** Real time (seconds) when the source last changed. */
  at: number;
  /** Game seconds per real second, measured from the last tick. */
  rate: number;
  /** Game seconds the last tick covered: the lead never passes this. */
  lastTickGameS: number;
  /** The drawing clock (unwrapped hours). */
  render: number;
}

export function createCrowdRenderClock(): CrowdRenderClock {
  return { source: NaN, sourceUnwrapped: NaN, at: 0, rate: 0, lastTickGameS: 0, render: NaN };
}

/**
 * Advance the drawing clock. `source` is the game hour clock now (0–24 or any
 * value), `nowS` is real time in seconds. Returns the unwrapped hour to draw.
 */
export function stepCrowdRenderClock(state: CrowdRenderClock, source: number, nowS: number): number {
  if (source !== state.source) {
    // Forward distance around the 24-hour dial, in game seconds.
    const forwardS = Number.isFinite(state.source)
      ? ((((source - state.source) % 24) + 24) % 24) * 3600
      : NaN;
    const realS = nowS - state.at;
    if (!Number.isFinite(forwardS) || forwardS > MAX_TICK_GAME_S) {
      // First value, a step back (reads as almost 24 h forward), or a skip.
      state.sourceUnwrapped = source;
      state.render = source;
      state.rate = 1;
      state.lastTickGameS = 1;
    } else {
      state.sourceUnwrapped += forwardS / 3600;
      // A tick that arrives in a burst (two in one frame) keeps the old rate.
      if (realS > 0.05) state.rate = Math.min(forwardS / realS, MAX_RATE);
      state.lastTickGameS = forwardS;
      // Catch up to the new source; never step back.
      state.render = Math.max(state.render, state.sourceUnwrapped);
    }
    state.source = source;
    state.at = nowS;
  }
  // Run ahead of the last tick at the measured rate, up to one tick's worth.
  const leadS = Math.min(Math.max(0, nowS - state.at) * state.rate, state.lastTickGameS);
  const target = state.sourceUnwrapped + leadS / 3600;
  state.render = Number.isFinite(state.render) ? Math.max(state.render, target) : target;
  return state.render;
}
