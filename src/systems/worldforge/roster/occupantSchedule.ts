/**
 * @file occupantSchedule.ts
 * @description The smallest real step into Worldforge agent BEHAVIOR (SPEC §6
 * "later schedule pass", anticipated by roster/types.ts): a pure, deterministic
 * answer to "where is occupant O, and what are they doing, at hour H?".
 *
 * This is data, not simulation — no ticking, no mutation, no rendering. It
 * derives a daily routine from a single occupant's static roster record so any
 * consumer (3D agent placement, debug overlays, future needs/economy sim) can
 * ask the same question and get the same answer for a given (occupant, hour).
 *
 * Routine model (a conventional medieval day, deterministic per person):
 *   - SLEEP overnight at home (wake/sleep times jittered ±a couple hours by id).
 *   - WORKERS (have a workPlotId) commute out and WORK their trade by day; age
 *     shortens an elder's shift and a child never works.
 *   - Non-workers are HOME, with a midday OUT block (market/errands/play).
 * Location is always a concrete plot id (home or work) so consumers can place
 * the agent; `activity` carries the intent.
 *
 * Determinism: a per-occupant jitter is hashed from `occupant.id` only — same
 * occupant, same hour → identical block, no RNG/seed-path plumbing needed.
 */

import type { Occupant } from './types';

export type ActivityKind = 'sleeping' | 'home' | 'working' | 'out';

export interface ScheduleBlock {
  /** What the occupant is doing this hour. */
  activity: ActivityKind;
  /** The plot they are at: their work plot while `working`, else their home plot. */
  plotId: number;
  /** 0–23 hour this block answers. */
  hour: number;
}

const HOURS_PER_DAY = 24;

/** Small stable hash of an id → a non-negative integer (no RNG dependency). */
function idHash(id: number): number {
  let h = 2166136261 ^ id;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

interface DayShape {
  wake: number;
  sleep: number;
  workStart: number;
  workEnd: number;
  worksToday: boolean;
}

/** The occupant's per-day timing, derived deterministically from id + age band. */
function dayShape(occupant: Occupant): DayShape {
  const h = idHash(occupant.id);
  const wake = 5 + (h % 3); // 5–7
  const sleep = 20 + ((h >> 3) % 3); // 20–22
  const isWorker = occupant.workPlotId !== undefined && occupant.ageBand !== 'child';
  // Elders keep a shorter, gentler shift; adults a full day.
  const baseStart = 7 + ((h >> 5) % 2); // 7–8
  const workStart = occupant.ageBand === 'elder' ? baseStart + 1 : baseStart;
  const baseEnd = 17 + ((h >> 7) % 2); // 17–18
  const workEnd = occupant.ageBand === 'elder' ? baseEnd - 2 : baseEnd;
  return { wake, sleep, workStart, workEnd, worksToday: isWorker };
}

/** Normalize any integer hour into 0–23. */
function wrapHour(hour: number): number {
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

/**
 * Where the occupant is, and what they are doing, at `hour` (0–23). Pure.
 */
export function occupantLocationAt(occupant: Occupant, hour: number): ScheduleBlock {
  const hr = wrapHour(hour);
  const home = occupant.homePlotId;
  const work = occupant.workPlotId ?? home;
  const { wake, sleep, workStart, workEnd, worksToday } = dayShape(occupant);

  // Overnight (after sleep, before wake) — asleep at home.
  if (hr >= sleep || hr < wake) return { activity: 'sleeping', plotId: home, hour: hr };

  if (worksToday) {
    if (hr >= workStart && hr < workEnd) return { activity: 'working', plotId: work, hour: hr };
    // Morning before the shift / evening after it — at home.
    return { activity: 'home', plotId: home, hour: hr };
  }

  // Non-workers (children, idle adults, retired elders): one OUT block for
  // market/errands/play, home the rest of their waking hours. The block STARTS
  // at a per-person hour spread across the daytime (not a synchronized noon
  // rush — the first town snapshot had everyone out at 12:00 in lockstep), kept
  // inside the wake→sleep window.
  const h = idHash(occupant.id);
  const outDur = 2 + (occupant.ageBand === 'child' ? 1 : 0) + ((h >> 4) & 1); // 2–4 h
  const earliest = wake + 2; // a beat after waking
  const latest = Math.max(earliest, sleep - 1 - outDur); // home before bed
  const outStart = earliest + (h % Math.max(1, latest - earliest + 1));
  if (hr >= outStart && hr < outStart + outDur) return { activity: 'out', plotId: home, hour: hr };
  return { activity: 'home', plotId: home, hour: hr };
}

/** The occupant's full 24-hour routine (one block per hour, 0→23). Pure. */
export function occupantDayRoutine(occupant: Occupant): ScheduleBlock[] {
  const day: ScheduleBlock[] = [];
  for (let hr = 0; hr < HOURS_PER_DAY; hr++) day.push(occupantLocationAt(occupant, hr));
  return day;
}
