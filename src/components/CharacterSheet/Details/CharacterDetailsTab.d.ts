/**
 * @file CharacterDetailsTab.tsx
 * Displays personality traits, backstory, and character details.
 * Elegant gold-themed design with corner decorations.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
import { Companion } from '../../../types/companions';
interface CharacterDetailsTabProps {
    character: PlayerCharacter;
    companion?: Companion | null;
}
declare const CharacterDetailsTab: React.FC<CharacterDetailsTabProps>;
export default CharacterDetailsTab;
