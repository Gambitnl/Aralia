/**
 * @file NameAndReview.tsx
 * This component is the final step in character creation. It allows the player
 * to name their character and review all their selections (race, class, ability scores,
 * skills, features, spells) before finalizing the character.
 */
import React, { useState, useEffect, useContext } from 'react';
import { PlayerCharacter, AbilityScoreName, Spell, Item, DraconicAncestryInfo } from '../../types';
import { RACES_DATA, WEAPONS_DATA, MASTERY_DATA, DRAGONBORN_ANCESTRIES } from '../../constants'; // For lineage/subrace name & item names
import { FEATS_DATA } from '../../data/feats/featsData';
import { getCharacterSpells } from '../../utils/spellUtils';
import { getAbilityModifierString, getCharacterRaceDisplayString } from '../../utils/characterUtils';
import SpellContext from '../../context/SpellContext'; // Import the new context
import Tooltip from '../Tooltip';

interface NameAndReviewProps {
  characterPreview: PlayerCharacter; // A temporary PlayerCharacter object with all selections made so far
  onConfirm: (name: string) => void; // Callback when character is confirmed
  onBack: () => void; // Function to go back to the previous step
  initialName?: string; // Optional initial name for the input field
  initialAge?: number;
  onAgeChange?: (age: number) => void;
}

/**
 * NameAndReview component.
 * Allows final review of character details and naming before creation.
 */
const NameAndReview: React.FC<NameAndReviewProps> = ({ characterPreview, onConfirm, onBack, initialName = '', initialAge = 25, onAgeChange }) => {
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState(initialAge);

  const { 
    race, 
    class: charClass, 
    finalAbilityScores, 
    skills, 
    selectedFightingStyle, 
    selectedDivineOrder, 
    selectedDruidOrder,
    selectedWarlockPatron,
    racialSelections,
    selectedWeaponMasteries,
    speed,
    feats
  } = characterPreview;

  const allSpells = useContext(SpellContext);
  if (!allSpells) return <div>Loading spell details for review...</div>;

  // Use the new centralized utility to get all spells
  const { cantrips: allKnownCantrips, spells: allKnownSpells } = getCharacterSpells(characterPreview, allSpells);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
      setAge(initialAge);
  }, [initialAge]);

  const handleAgeChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setAge(val);
      if (onAgeChange) onAgeChange(val);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };
  
  const selectedDraconicAncestryId = racialSelections?.['dragonborn']?.choiceId;
  const selectedDraconicAncestry = selectedDraconicAncestryId ? (DRAGONBORN_ANCESTRIES as Record<string, DraconicAncestryInfo>)[selectedDraconicAncestryId] : null;

  const selectedElvenLineageId = racialSelections?.['elf']?.choiceId;
  const elvenLineageSpellcastingAbility = racialSelections?.['elf']?.spellAbility;
  const elvenLineageDetails = selectedElvenLineageId ? RACES_DATA['elf']?.elvenLineages?.find(l => l.id === selectedElvenLineageId) : null;
  
  const selectedGnomeSubraceId = racialSelections?.['gnome']?.choiceId;
  const gnomeSubraceSpellcastingAbility = racialSelections?.['gnome']?.spellAbility;
  const gnomeSubraceDetails = selectedGnomeSubraceId ? RACES_DATA['gnome']?.gnomeSubraces?.find(sr => sr.id === selectedGnomeSubraceId) : null;


  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">Name Your Character & Review</h2>
      
      <div className="bg-gray-700 p-4 rounded-lg mb-6 max-h-72 overflow-y-auto scrollable-content border border-gray-600">
        <h3 className="text-xl font-semibold text-amber-400 mb-3">Character Summary</h3>
        <p><strong>Race:</strong> {getCharacterRaceDisplayString(characterPreview)}</p>

        {selectedDraconicAncestry && (
          <p className="text-sm ml-2">
            <strong>Draconic Ancestry:</strong> {selectedDraconicAncestry.type} Dragon ({selectedDraconicAncestry.damageType} resistance)
          </p>
        )}
        {elvenLineageDetails && (
          <div className="text-sm ml-2">
            <p><strong>Elven Lineage:</strong> {elvenLineageDetails.name}</p>
            {elvenLineageSpellcastingAbility && <p className="text-xs"> (Spellcasting Ability: {elvenLineageSpellcastingAbility})</p>}
            {elvenLineageDetails.benefits.filter(b => b.level === 1).map(benefit => (
              <p key={`${elvenLineageDetails.id}-${benefit.cantripId || benefit.description}`} className="text-xs text-gray-400">
                - {benefit.description}
                {benefit.cantripId && ` Cantrip: ${allSpells[benefit.cantripId]?.name || benefit.cantripId}.`}
                {benefit.speedIncrease && ` Speed increased by ${benefit.speedIncrease}ft.`}
                {benefit.darkvisionRange && ` Darkvision ${benefit.darkvisionRange}ft.`}
              </p>
            ))}
          </div>
        )}
        {gnomeSubraceDetails && (
          <div className="text-sm ml-2">
            <p><strong>Gnome Subrace:</strong> {gnomeSubraceDetails.name}</p>
            {(gnomeSubraceDetails.grantedCantrip || gnomeSubraceDetails.grantedSpell) && gnomeSubraceSpellcastingAbility &&
              <p className="text-xs"> (Spellcasting Ability: {gnomeSubraceSpellcastingAbility})</p>
            }
            {gnomeSubraceDetails.traits.map(trait => (
              <p key={`${gnomeSubraceDetails.id}-${trait}`} className="text-xs text-gray-400" title={trait.length > 50 ? trait : undefined}>
                - {trait.length > 50 ? trait.substring(0, 47) + "..." : trait}
              </p>
            ))}
             {gnomeSubraceDetails.superiorDarkvision && <p className="text-xs text-gray-400">- Darkvision: 120ft</p>}
             {/* Base Gnome traits like Gnomish Cunning are part of characterPreview.race.traits and not explicitly iterated here but are included in the final character object */}
          </div>
        )}

        <p><strong>Class:</strong> {charClass.name}</p>
        <div className="my-2">
            <strong>Ability Scores:</strong>
            <ul className="list-disc list-inside ml-4 text-sm">
            {Object.entries(finalAbilityScores).map(([key, value]: [string, number]) => (
                <li key={key}>{key as AbilityScoreName}: {value} ({getAbilityModifierString(value)})</li>
            ))}
            </ul>
        </div>
        <div className="my-2">
            <strong>Skills:</strong> {skills.length > 0 ? skills.map(s => `${s.name} (${s.ability.substring(0,3)})`).join(', ') : 'None selected'}
        </div>
        {selectedFightingStyle && <p><strong>Fighting Style:</strong> {selectedFightingStyle.name}</p>}
        {feats && feats.length > 0 && (
            <div className="my-2">
                <strong>Feats:</strong>
                <ul className="list-disc list-inside ml-4 text-sm">
                    {feats.map(featId => {
                        const feat = FEATS_DATA.find(f => f.id === featId);
                        return feat ? (
                            <li key={featId}>
                                <Tooltip content={feat.description}>
                                    <span className="cursor-help underline decoration-dotted">{feat.name}</span>
                                </Tooltip>
                            </li>
                        ) : null;
                    })}
                </ul>
            </div>
        )}
        {selectedWeaponMasteries && selectedWeaponMasteries.length > 0 && (
          <div className="my-2">
            <strong>Weapon Masteries:</strong>
            <ul className="list-disc list-inside ml-4 text-sm">
              {selectedWeaponMasteries.map(id => {
                const weapon = WEAPONS_DATA[id];
                if (!weapon || !weapon.mastery) return null;
                const mastery = MASTERY_DATA[weapon.mastery];
                if (!mastery) return null;
                return (
                  <li key={id}>
                    <Tooltip content={mastery.description}>
                      <span className="cursor-help underline decoration-dotted">{weapon.name} ({mastery.name})</span>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {selectedDivineOrder && 
            <p><strong>Divine Order:</strong> {selectedDivineOrder}</p>
        }
        {selectedDruidOrder && 
            <p><strong>Primal Order:</strong> {selectedDruidOrder}</p>
        }
        {selectedWarlockPatron && 
            <p><strong>Otherworldly Patron:</strong> {selectedWarlockPatron}</p>
        }
        { (allKnownCantrips.length > 0 || allKnownSpells.length > 0) &&
            <div className="my-2">
                <strong>Spells:</strong>
                {allKnownCantrips.length > 0 && <p className="text-xs">Cantrips: {allKnownCantrips.map(s => s.name).join(', ')}</p>}
                {allKnownSpells.length > 0 && <p className="text-xs">Known Spells: {allKnownSpells.map(s => `${s.name} (L${s.level})`).join(', ')}</p>}
            </div>
        }
         <p className="text-sm mt-1"><strong>HP:</strong> {characterPreview.maxHp}</p>
         <p className="text-sm"><strong>AC:</strong> {characterPreview.armorClass}</p>
         <p className="text-sm"><strong>Speed:</strong> {speed}ft</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="characterName" className="block text-md font-medium text-gray-300 mb-1">
            Character Name:
          </label>
          <input
            type="text"
            id="characterName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            placeholder="E.g., Valerius Stonebeard"
            required
            aria-required="true"
            aria-label="Enter your character's name"
          />
        </div>

        <div>
            <label htmlFor="characterAge" className="block text-md font-medium text-gray-300 mb-1">
                Character Age:
            </label>
            <input
                type="number"
                id="characterAge"
                value={age}
                onChange={handleAgeChangeLocal}
                min={1}
                max={9999}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                aria-label="Enter your character's age"
            />
        </div>
        
        <div className="flex gap-4 pt-2">
            <button
                type="button"
                onClick={onBack}
                className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
                aria-label="Go back to previous step"
            >
                Back
            </button>
            <button
                type="submit"
                disabled={!name.trim()}
                className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg shadow transition-all duration-150 ease-in-out"
                aria-label="Confirm character and begin adventure"
            >
                Begin Adventure!
            </button>
        </div>
      </form>
    </div>
  );
};

export default NameAndReview;