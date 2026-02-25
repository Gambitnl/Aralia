/**
 * @file raceGroups.ts
 * Defines parent race group metadata for accordion-style race selection.
 * Each group contains a generic description and optional comparison table config.
 */
export interface RaceGroupMeta {
    /** Unique identifier for the race group (e.g., 'dwarf', 'elf') */
    id: string;
    /** Display name for the group header */
    name: string;
    /** Generic description shown when the group is expanded (not a specific variant) */
    description: string;
    /** Traits to highlight in the comparison table */
    comparisonTraits?: string[];
}
/**
 * Metadata for parent race groups.
 * Used by RaceSelection to render accordion headers and generic descriptions.
 */
export declare const RACE_GROUPS: RaceGroupMeta[];
/**
 * Lookup a race group by its ID.
 */
export declare const getRaceGroupById: (id: string) => RaceGroupMeta | undefined;
