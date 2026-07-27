import { Spell } from '../../../../../types/spells';
/**
 * Reads all spell JSON files for a given level from disk and returns them as
 * parsed Spell objects. Returns an empty array if the level directory doesn't
 * exist (e.g., if level-10 is never added).
 */
export declare function getSpells(level: number): Spell[];
export declare const filterReviewedMonolithicClearance: (spell: Spell, errors: string[]) => string[];
