/**
 * @file FamilyTreeTab.tsx
 * Displays the character's family tree with visual relationship indicators.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
interface FamilyTreeTabProps {
    character: PlayerCharacter;
}
declare const FamilyTreeTab: React.FC<FamilyTreeTabProps>;
export default FamilyTreeTab;
