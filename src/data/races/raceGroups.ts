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
export const RACE_GROUPS: RaceGroupMeta[] = [
    {
        id: 'dwarf',
        name: 'Dwarf',
        description:
            'Dwarves are stout, resilient folk known for their craftsmanship, endurance, and deep connection to stone and earth. They excel as warriors, smiths, and artisans.',
        comparisonTraits: ['Speed', 'Darkvision', 'Poison Resistance', 'Stonecunning', 'Special Traits'],
    },
    // Future groups will be added here as we migrate each race
];

/**
 * Lookup a race group by its ID.
 */
export const getRaceGroupById = (id: string): RaceGroupMeta | undefined => {
    return RACE_GROUPS.find((g) => g.id === id);
};
