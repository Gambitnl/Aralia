import React from 'react';
import { CombatCharacter } from '../../types/combat';
interface Props {
    character: CombatCharacter;
    onClose: () => void;
}
export declare const CombatCharacterInspector: React.FC<Props>;
export {};
