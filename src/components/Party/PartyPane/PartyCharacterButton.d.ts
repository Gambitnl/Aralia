import React from 'react';
import { PlayerCharacter, MissingChoice } from '../../../types';
interface PartyCharacterButtonProps {
    character: PlayerCharacter;
    onClick: () => void;
    onMissingChoiceClick: (char: PlayerCharacter, missing: MissingChoice) => void;
}
declare const PartyCharacterButton: React.FC<PartyCharacterButtonProps>;
export default PartyCharacterButton;
