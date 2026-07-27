import type { TravelEncounterMonster } from '../travel/travelEncounterMonsters';
/**
 * Per-day base encounter chance at danger = 1.0 (tuning knob). Sized so a calm
 * lane crossing (danger 0.12) is roughly a 1-in-70 day and a long open-water haul
 * (danger 0.5) is roughly a 1-in-17 day — dangerous over a multi-day voyage but
 * not a coin-flip every morning. Mirrors land's PER_CELL_AT_MAX_DANGER framing.
 */
export declare const PER_DAY_AT_MAX_DANGER = 0.12;
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
export declare const SEA_ENCOUNTER_TABLE: SeaEncounterOutcome[];
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
export declare function rollSeaEncounter({ danger, dayAtSea, voyageSig }: SeaEncounterRollInput): SeaEncounterRoll;
