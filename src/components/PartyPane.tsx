
/**
 * @file PartyPane.tsx
 * This component displays the player's party members' core stats.
 * It shows a button for each member, which opens their detailed character sheet on click.
 * It now includes a warning indicator if a character has missing required choices.
 */
import React, { useMemo } from 'react';
import { PlayerCharacter, MissingChoice } from '../types'; // Path relative to src/components/
import Tooltip from './Tooltip'; 
import { validateCharacterChoices } from '../utils/characterValidation';

interface PartyCharacterButtonProps {
  character: PlayerCharacter;
  onClick: () => void;
  onMissingChoiceClick: (char: PlayerCharacter, missing: MissingChoice) => void;
}

const PartyCharacterButton: React.FC<PartyCharacterButtonProps> = ({ character, onClick, onMissingChoiceClick }) => {
  const healthPercentage = (character.hp / character.maxHp) * 100;
  
  // Check for missing choices
  const missingChoices = useMemo(() => validateCharacterChoices(character), [character]);
  const hasMissingChoices = missingChoices.length > 0;

  return (
    <div className="relative w-full group">
        <button
        onClick={onClick}
        className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg shadow-md transition-colors border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-left"
        aria-label={`View details for ${character.name}, AC: ${character.armorClass}, HP: ${character.hp}/${character.maxHp}`}
        >
        <div className="flex justify-between items-center mb-1.5">
            <p className="text-lg font-semibold text-amber-300 truncate pr-6" title={character.name}>{character.name}</p>
            <Tooltip content={`Armor Class: ${character.armorClass}`}>
            <div className="flex items-center relative text-xs text-white group">
                <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 20 20" 
                fill="currentColor" 
                className="w-6 h-6 text-gray-500 group-hover:text-sky-400 transition-colors"
                aria-hidden="true"
                >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
                <span 
                className="absolute inset-0 flex items-center justify-center text-white font-bold text-[10px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] group-hover:text-yellow-300 transition-colors"
                aria-hidden="true"
                >
                {character.armorClass}
                </span>
            </div>
            </Tooltip>
        </div>

        <div className="w-full bg-gray-900 rounded-full h-6 shadow-inner overflow-hidden relative border border-gray-500">
            <div
            className="bg-red-600 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center"
            style={{ width: `${healthPercentage}%` }}
            role="progressbar"
            aria-valuenow={character.hp}
            aria-valuemin={0}
            aria-valuemax={character.maxHp}
            >
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                {character.hp} / {character.maxHp} HP
            </p>
            </div>
        </div>
        <p className="text-xs text-sky-300 mt-1 text-center">{character.race.name} {character.class.name}</p>
        </button>
        
        {/* Warning Icon Overlay */}
        {hasMissingChoices && (
            <div className="absolute -top-1 -right-1 z-10">
                <Tooltip content={`Missing Selection: ${missingChoices[0].label}. Click to fix.`}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMissingChoiceClick(character, missingChoices[0]); }}
                        className="bg-red-900 text-yellow-400 rounded-full p-1 border-2 border-yellow-500 shadow-lg animate-pulse hover:scale-110 transition-transform"
                        aria-label="Fix missing character selection"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </Tooltip>
            </div>
        )}
    </div>
  );
};

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
