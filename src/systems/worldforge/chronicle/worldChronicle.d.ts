/**
 * A world-chronicle entry kind. `war`/`plague`/`eruption` overlap the dungeon
 * `ChronicleKind` (adopted zones reuse them); the four new kinds are inferred
 * from present atlas structure.
 */
export type WorldEntryKind = 'war' | 'schism' | 'crusade' | 'migration' | 'fall' | 'plague' | 'eruption';
/** Event-shaped ("burned IN the war") vs faction-shaped ("fell TO the Rebels"). */
export type WorldEntryShape = 'event' | 'faction';
/** The real present-day actors an entry involves (all optional; ids into pack). */
export interface WorldEntryActors {
    stateIds?: number[];
    religionIds?: number[];
    cultureIds?: number[];
    burgIds?: number[];
}
/**
 * One inferred (or adopted) episode of world history. `evidence` is a single
 * plain-English sentence naming the PRESENT fact this entry explains. `cells` is
 * where it happened (for proximity queries from a dungeon site).
 */
export interface ChronicleEntry {
    id: string;
    kind: WorldEntryKind;
    name: string;
    yearsAgo: number;
    shape: WorldEntryShape;
    actors: WorldEntryActors;
    evidence: string;
    cells: number[];
}
export interface WorldChronicle {
    entries: ChronicleEntry[];
}
/**
 * Build the reverse-generational world chronicle for a seed (cached). Runs each
 * inference pass on its own stream, adopts the atlas zones at their existing
 * eras, caps to a chronicle-sized set, and orders the whole into a coherent
 * oldest-first arc.
 */
export declare function worldChronicleFor(worldSeed: number): WorldChronicle;
/** "~490 years ago — the fall of Old Kobern. (explains: …)" one line per entry. */
export declare function renderChronicle(worldSeed: number): string;
/** Test-only: clear the per-seed cache (never called in production). */
export declare function __clearWorldChronicleCache(): void;
