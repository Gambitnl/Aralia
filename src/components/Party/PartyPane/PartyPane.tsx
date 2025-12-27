
import React from 'react';
import { PlayerCharacter, MissingChoice } from '../../../types';
import PartyCharacterButton from './PartyCharacterButton';

interface PartyPaneProps {
  party: PlayerCharacter[];
  onViewCharacterSheet: (character: PlayerCharacter) => void;
  onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
}

const PartyPane: React.FC<PartyPaneProps> = ({ party, onViewCharacterSheet, onFixMissingChoice }) => {
  return (
    <div className="w-full bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700">
      <div className="border-b-2 border-amber-500 pb-2 mb-4">
        <h2 className="text-2xl font-bold text-amber-400 font-cinzel text-center tracking-wide">Party</h2>
      </div>
      <div className="space-y-3">
        {party.map(member => (
            <PartyCharacterButton
                key={member.id || member.name}
                character={member}
                onClick={() => onViewCharacterSheet(member)}
                onMissingChoiceClick={onFixMissingChoice}
            />
        ))}
      </div>
    </div>
  );
};

export default PartyPane;
