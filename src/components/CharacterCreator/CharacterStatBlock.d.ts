import React from 'react';
import { AbilityScores, Race, Class as CharClass } from '../../types';
interface CharacterStatBlockProps {
    baseScores: AbilityScores;
    race: Race;
    selectedClass: CharClass | null;
}
declare const CharacterStatBlock: React.FC<CharacterStatBlockProps>;
export default CharacterStatBlock;
