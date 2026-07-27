/**
 * @file characters/characterActor/defenseBadges.tsx
 * The 3D actor's defense-badge strip (resistance / vulnerability / immunity)
 * — the 3D counterpart to the 2D token-perimeter badges. Extracted verbatim
 * from CharacterActor.tsx.
 */
import React from 'react';
import { CombatCharacter } from '../../../../types/combat';
export declare const DefenseBadgeRow: React.FC<{
    character: CombatCharacter;
}>;
