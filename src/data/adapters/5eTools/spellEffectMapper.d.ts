import { AbilityEffect, TargetingType } from '../../../types/combat';
import { Spell } from '../../../types/spells';
/**
 * Maps a rich Spell object (from Aralia's spell database) into
 * lightweight Ability properties used by the combat engine.
 */
export declare function mapSpellToAbilityProperties(spell: Spell): {
    effects: AbilityEffect[];
    targeting: TargetingType;
    range: number;
    areaShape?: 'circle' | 'cone' | 'line' | 'square';
    areaSize?: number;
};
