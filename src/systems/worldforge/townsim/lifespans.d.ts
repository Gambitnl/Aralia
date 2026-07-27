export interface Lifespan {
    /** Age (years) at which a villager becomes an adult / can marry & bear children. */
    comingOfAge: number;
    /** Typical natural lifespan (years); death chance ramps to near-certainty past it. */
    maxAge: number;
}
export declare const RACE_LIFESPAN: Record<string, Lifespan>;
export declare const DEFAULT_LIFESPAN: Lifespan;
export declare function lifespanForRace(race: string): Lifespan;
/**
 * Per-DAY death probability for a villager of the given age and race.
 * Negligible (baseline illness/accident) until ~60% of maxAge, then ramps
 * quadratically, approaching near-certainty past maxAge.
 */
export declare function dailyDeathProbability(age: number, race: string): number;
/** Age window (years) in which a villager can produce children. */
export declare function childbearingWindow(race: string): {
    min: number;
    max: number;
};
/** Age window (years) in which a villager can marry (wider than childbearing —
 * allows later-life and second marriages). */
export declare function marriageableWindow(race: string): {
    min: number;
    max: number;
};
