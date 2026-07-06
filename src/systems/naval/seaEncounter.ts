/**
 * @file seaEncounter.ts — deterministic "danger on the water" roll for a day at sea.
 *
 * The sea counterpart of `travel/travelEncounter.ts` (land ambushes). Where land
 * rolls ONCE for a whole trip compounded over its cells, a voyage plays out
 * day-by-day (VoyageManager.advanceDay), so we roll ONCE PER DAY AT SEA. Each day
 * is an independent exposure whose probability scales with the route's sea-danger
 * (Plan 3A tiers: lane 0.12 / coastal 0.3 / open 0.5, carried on the voyage from
 * the multi-modal route's aggregate `danger`).
 *
 * Reuses the SAME odds framing as land: base per-unit chance × danger, seeded off
 * a stable signature so replaying the same day of the same voyage resolves the
 * same way (no save-scumming). Pure: no React/DOM, no store access. The reducer
 * maps a hostile outcome to the existing battle-map flow and a peaceful one to a
 * log/salvage line — no new bespoke subsystem.
 */
import { rngFromPath, streamPath } from '../worldforge/seedPath';
import type { TravelEncounterMonster } from '../travel/travelEncounterMonsters';

/**
 * Per-day base encounter chance at danger = 1.0 (tuning knob). Sized so a calm
 * lane crossing (danger 0.12) is roughly a 1-in-70 day and a long open-water haul
 * (danger 0.5) is roughly a 1-in-17 day — dangerous over a multi-day voyage but
 * not a coin-flip every morning. Mirrors land's PER_CELL_AT_MAX_DANGER framing.
 */
export const PER_DAY_AT_MAX_DANGER = 0.12;

/** A single entry on the sea-encounter table. */
export interface SeaEncounterOutcome {
  id: string;
  /** Short, data-derived one-liner for the log / voyage entry. */
  summary: string;
  /** True → resolves through the tactical combat flow (battle-map arena). */
  hostile: boolean;
  /**
   * Combat foes for a hostile encounter, sized for an early party. Reuses the
   * land `TravelEncounterMonster` stub shape so the existing
   * `handleStartBattleMapEncounter` path resolves them against the bestiary.
   */
  monsters?: TravelEncounterMonster[];
  /**
   * Optional salvage for a peaceful discovery (drifting wreck), applied through
   * the existing gold reducer. Non-hostile only.
   */
  salvageGold?: number;
}

/**
 * The starter sea-encounter table. Small on purpose — a handful of iconic beats
 * that each resolve through machinery that already exists:
 *   hostile → tactical combat (placeless battle-map fight, like a road ambush)
 *   non-hostile → narrative log + optional salvage gold (existing reducer)
 */
export const SEA_ENCOUNTER_TABLE: SeaEncounterOutcome[] = [
  {
    id: 'pirates',
    summary: 'A pirate cutter runs up the black flag and closes to board!',
    hostile: true,
    monsters: [
      { name: 'Bandit', quantity: 3, cr: '1/8', description: 'A cutlass-waving pirate swinging across on a boarding line.' },
      { name: 'Bandit Captain', quantity: 1, cr: '2', description: 'The pirate captain, all teeth and pistols, leading the boarders.' },
    ],
  },
  {
    id: 'sea_beast',
    summary: 'The water heaves — a great sea beast rises against the hull.',
    hostile: true,
    monsters: [
      { name: 'Giant Octopus', quantity: 1, cr: '1', description: 'A vast octopus, tentacles slapping the rail as it drags at the ship.' },
    ],
  },
  {
    id: 'drifting_wreck',
    summary: 'You come upon a drifting wreck and salvage what stores remain.',
    hostile: false,
    salvageGold: 25,
  },
  {
    id: 'merchant_vessel',
    summary: 'A friendly merchant vessel hails you and trades news of safe harbors.',
    hostile: false,
  },
  {
    id: 'squall',
    summary: 'A sudden squall lashes the deck; the crew rides it out, shaken but whole.',
    hostile: false,
  },
];

export interface SeaEncounterRollInput {
  /** Route sea-danger in [0,1] (multi-modal aggregate → lane/coastal/open tiers). */
  danger: number;
  /** 1-based day of the voyage being resolved. */
  dayAtSea: number;
  /** Stable per-voyage signature (ship id + destination + distance). */
  voyageSig: string;
}

export interface SeaEncounterRoll {
  encounter: boolean;
  /** This day's encounter probability in [0,1] (for display / debugging). */
  chance: number;
  /** The chosen table outcome, or null when no encounter fired. */
  outcome: SeaEncounterOutcome | null;
}

/**
 * Roll a single day's sea encounter. `chance = clamp(danger) × PER_DAY_AT_MAX_DANGER`.
 * On a hit, pick an outcome uniformly from the table with the SAME seeded stream so
 * the day is fully deterministic (encounter yes/no AND which outcome).
 */
export function rollSeaEncounter({ danger, dayAtSea, voyageSig }: SeaEncounterRollInput): SeaEncounterRoll {
  const d = Math.max(0, Math.min(1, danger));
  const chance = Math.max(0, Math.min(1, d * PER_DAY_AT_MAX_DANGER));
  if (chance <= 0) return { encounter: false, chance: 0, outcome: null };

  // Stable per-day RNG keyed by the voyage signature + day, so re-resolving the
  // same day of the same voyage (StrictMode / reload) rolls identically.
  const rng = rngFromPath(streamPath(`sea-enc:${voyageSig}`, `day:${dayAtSea}`));
  const encounter = rng.next() < chance;
  if (!encounter) return { encounter: false, chance, outcome: null };

  // nextInt is MAX-EXCLUSIVE (architecture memory): [0, length) picks a valid index.
  const idx = rng.nextInt(0, SEA_ENCOUNTER_TABLE.length);
  return { encounter: true, chance, outcome: SEA_ENCOUNTER_TABLE[idx] };
}
