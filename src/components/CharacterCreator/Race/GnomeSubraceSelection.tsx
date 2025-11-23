/**
 * @file GnomeSubraceSelection.tsx
 * This component is part of the character creation process for Gnome characters.
 * It allows the player to choose their Gnome Subrace (Forest, Rock, or Deep Gnome)
 * and the spellcasting ability for spells granted by that subrace.
 */
import React, { useState, useContext } from 'react';
import { GnomeSubrace, GnomeSubraceType, AbilityScoreName } from '../../../types'; // Path relative to src/components/CharacterCreator/Gnome/
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants'; // Path relative to src/components/CharacterCreator/Gnome/
import SpellContext from '../../../context/SpellContext';

interface GnomeSubraceSelectionProps {
  subraces: GnomeSubrace[];
  onSubraceSelect: (
    subraceId: GnomeSubraceType,
    spellcastingAbility: AbilityScoreName,
  ) => void;
  onBack: () => void;
}

const GnomeSubraceSelection: React.FC<GnomeSubraceSelectionProps> = ({
  subraces,
  onSubraceSelect,
  onBack,
}) => {
  const [selectedSubraceId, setSelectedSubraceId] =
    useState<GnomeSubraceType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] =
    useState<AbilityScoreName | null>(null);
  
  const allSpells = useContext(SpellContext);

  const selectedSubraceDetails = selectedSubraceId
    ? subraces.find((sr) => sr.id === selectedSubraceId)
    : null;
  const needsSpellcastingAbilityChoice =
    selectedSubraceDetails &&
    (selectedSubraceDetails.grantedCantrip ||
      selectedSubraceDetails.grantedSpell);

  const handleSubmit = () => {
    if (selectedSubraceId) {
      if (needsSpellcastingAbilityChoice && selectedSpellcastingAbility) {
        onSubraceSelect(selectedSubraceId, selectedSpellcastingAbility);
      } else if (!needsSpellcastingAbilityChoice) {
        // If no spells are granted, default to Intelligence or any relevant ability as placeholder
        onSubraceSelect(
          selectedSubraceId,
          selectedSpellcastingAbility || 'Intelligence',
        );
      }
    }
  };
  
  if (!allSpells) {
      return <div>Loading spells...</div>
  }

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">
        Choose Your Gnome Subrace
      </h2>

      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Subrace:</h3>
        <div className="space-y-4">
          {subraces.map((subrace) => (
            <button
              key={subrace.id}
              onClick={() => {
                setSelectedSubraceId(subrace.id);
                if (!(subrace.grantedCantrip || subrace.grantedSpell)) {
                  setSelectedSpellcastingAbility(null);
                } else {
                  setSelectedSpellcastingAbility('Intelligence');
                }
              }}
              className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                selectedSubraceId === subrace.id
                  ? 'bg-sky-700 border-sky-500 ring-sky-500'
                  : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 ring-transparent'
              }`}
              aria-pressed={selectedSubraceId === subrace.id}
              aria-label={`Select ${subrace.name} subrace`}
            >
              <h4 className="font-semibold text-amber-400 text-lg">
                {subrace.name}
              </h4>
              <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">
                {subrace.description}
              </p>
              <ul className="text-sm text-sky-200 mt-2 list-disc list-inside space-y-1">
                {subrace.traits.map((trait) => (
                  <li key={`${subrace.id}-${trait}`}>{trait}</li>
                ))}
                {subrace.grantedCantrip && (
                  <li>Grants Cantrip: {allSpells[subrace.grantedCantrip.id]?.name}</li>
                )}
                {subrace.grantedSpell && (
                  <li>Grants Spell: {allSpells[subrace.grantedSpell.id]?.name}</li>
                )}
                {subrace.superiorDarkvision && (
                  <li>Superior Darkvision (120ft)</li>
                )}
              </ul>
            </button>
          ))}
        </div>
      </div>

      {selectedSubraceId && needsSpellcastingAbilityChoice && (
        <div className="mb-6">
          <h3 className="text-xl text-amber-300 mb-3">
            Select Spellcasting Ability for Subrace Spells:
          </h3>
          <div className="flex flex-wrap gap-2">
            {RELEVANT_SPELLCASTING_ABILITIES.map((ability) => (
              <button
                key={ability}
                onClick={() => setSelectedSpellcastingAbility(ability)}
                className={`px-4 py-2 rounded-md transition-colors border ${
                  selectedSpellcastingAbility === ability
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300'
                }`}
                aria-pressed={selectedSpellcastingAbility === ability}
                aria-label={`Select ${ability} as spellcasting ability`}
              >
                {ability}
              </button>
            ))}
          </div>
          {selectedSpellcastingAbility && (
            <p className="text-xs text-gray-400 mt-2">
              Selected: {selectedSpellcastingAbility}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to race selection"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            !selectedSubraceId ||
            (needsSpellcastingAbilityChoice && !selectedSpellcastingAbility)
          }
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected gnome subrace and ability"
        >
          Confirm Subrace
        </button>
      </div>
    </div>
  );
};

export default GnomeSubraceSelection;