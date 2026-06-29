/**
 * @file lifespans.ts — Per-race lifespan data and the death/fertility curves.
 *
 * Net-new for the living-world sim: the existing roster/family layer only
 * snapshots an age band, it never ages anyone or models death. These curves
 * drive aging-to-death and childbearing in townSim.rollTownDay.
 *
 * Lore lifespans follow common 5e conventions (elves ~750, dwarves ~350,
 * humans ~80). Unknown races fall back to a human-like default.
 */
import { DAYS_PER_YEAR, BASELINE_DAILY_DEATH } from './constants';

export interface Lifespan {
  /** Age (years) at which a villager becomes an adult / can marry & bear children. */
  comingOfAge: number;
  /** Typical natural lifespan (years); death chance ramps to near-certainty past it. */
  maxAge: number;
}

export const RACE_LIFESPAN: Record<string, Lifespan> = {
  Human: { comingOfAge: 16, maxAge: 80 },
  Elf: { comingOfAge: 100, maxAge: 750 },
  Dwarf: { comingOfAge: 40, maxAge: 350 },
  Halfling: { comingOfAge: 20, maxAge: 150 },
  Gnome: { comingOfAge: 40, maxAge: 425 },
  'Half-Elf': { comingOfAge: 18, maxAge: 180 },
  Greenskins: { comingOfAge: 14, maxAge: 60 },
  Goliath: { comingOfAge: 16, maxAge: 90 },
  Tiefling: { comingOfAge: 16, maxAge: 96 },
  Aasimar: { comingOfAge: 16, maxAge: 160 },
  'Draconic Kin': { comingOfAge: 15, maxAge: 80 },
  Beastfolk: { comingOfAge: 14, maxAge: 70 },
};

export const DEFAULT_LIFESPAN: Lifespan = { comingOfAge: 16, maxAge: 80 };

export function lifespanForRace(race: string): Lifespan {
  return RACE_LIFESPAN[race] ?? DEFAULT_LIFESPAN;
}

/**
 * Per-DAY death probability for a villager of the given age and race.
 * Negligible (baseline illness/accident) until ~60% of maxAge, then ramps
 * quadratically, approaching near-certainty past maxAge.
 */
export function dailyDeathProbability(age: number, race: string): number {
  const { maxAge } = lifespanForRace(race);
  const rampStart = maxAge * 0.6;
  if (age < rampStart) return BASELINE_DAILY_DEATH;
  const t = Math.min(1.5, (age - rampStart) / (maxAge - rampStart)); // 0 .. 1.5
  const annual = Math.min(0.95, 0.01 + t * t * 0.55);
  const daily = 1 - Math.pow(1 - annual, 1 / DAYS_PER_YEAR);
  return Math.max(BASELINE_DAILY_DEATH, daily);
}

/** Age window (years) in which a villager can produce children. */
export function childbearingWindow(race: string): { min: number; max: number } {
  const { comingOfAge, maxAge } = lifespanForRace(race);
  return { min: comingOfAge, max: comingOfAge + 0.4 * (maxAge - comingOfAge) };
}
