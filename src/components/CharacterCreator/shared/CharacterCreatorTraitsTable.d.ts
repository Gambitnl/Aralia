/**
 * @file CharacterCreatorTraitsTable.tsx
 * Reusable traits table component for character creator steps.
 * Uses the spell progression table style (TRAIT | DESCRIPTION columns).
 */
import React from 'react';
interface BaseTraits {
    type?: string;
    size?: string;
    speed?: number;
    darkvision?: number;
}
interface Trait {
    name: string;
    description: string;
}
interface CharacterCreatorTraitsTableProps {
    baseTraits?: BaseTraits;
    traits: Trait[];
    onSpellClick?: (spellId: string) => void;
    spellsOfTheMark?: {
        minLevel: number;
        spells: string[];
    }[];
}
/**
 * Reusable traits table for character creator using spell progression style.
 * Automatically includes base stats (Creature Type, Size, Speed, Vision) at the top.
 */
export declare const CharacterCreatorTraitsTable: React.FC<CharacterCreatorTraitsTableProps>;
export {};
