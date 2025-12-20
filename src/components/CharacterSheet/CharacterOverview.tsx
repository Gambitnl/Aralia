import React from 'react';
import { PlayerCharacter, AbilityScoreName } from '../../types';
import Tooltip from '../Tooltip';
import { getAbilityModifierValue, getAbilityModifierString, getCharacterRaceDisplayString } from '../../utils/characterUtils';
import { FEATS_DATA } from '../../data/feats/featsData';
import { useCharacterProficiencies } from '../../hooks/useCharacterProficiencies';

interface CharacterOverviewProps {
  character: PlayerCharacter;
  onOpenSkillDetails: () => void;
}

const CharacterOverview: React.FC<CharacterOverviewProps> = ({ character, onOpenSkillDetails }) => {
  const proficiencies = useCharacterProficiencies(character);

  const spellcastingAbilityName = character.spellcastingAbility
    ? (character.spellcastingAbility.charAt(0).toUpperCase() + character.spellcastingAbility.slice(1)) as AbilityScoreName
    : null;

  const spellcastingScore: number = spellcastingAbilityName ? (character.finalAbilityScores[spellcastingAbilityName] as number) : 0;
  const spellcastingModifier = getAbilityModifierValue(spellcastingScore);
  const profBonus = character.proficiencyBonus || 2;

  const spellSaveDc = 8 + profBonus + spellcastingModifier;
  const spellAttackModifier = profBonus + spellcastingModifier;
  const spellAttackModifierString = spellAttackModifier >= 0 ? `+${spellAttackModifier}` : `${spellAttackModifier}`;

  return (
     <div className="grid grid-cols-1 gap-y-4 h-full overflow-hidden">
        {/* Column 1: Core Stats & Features */}
        <div className="space-y-4 overflow-y-auto scrollable-content p-1 pr-2 h-full">
            <p className="text-lg text-sky-300">{getCharacterRaceDisplayString(character)} {character.class.name}</p>

            {/* Vitals */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Vitals</h4>
                <p className="text-sm">Hit Points: <span className="font-semibold text-green-400">{character.hp}</span> / {character.maxHp}</p>
                <p className="text-sm">Armor Class: <span className="font-semibold text-blue-400">{character.armorClass}</span></p>
                <p className="text-sm">Speed: <span className="font-semibold">{character.speed}ft</span></p>
                {character.darkvisionRange > 0 && <p className="text-sm">Darkvision: {character.darkvisionRange}ft</p>}
            </div>

            {/* Spellcasting Stats */}
            {character.spellcastingAbility && spellcastingAbilityName && (
              <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                  <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Spellcasting</h4>
                  <div className="text-sm space-y-1">
                      <Tooltip content={`The core ability used for your spells.`}>
                          <p>Ability: <span className="font-semibold text-amber-300">{spellcastingAbilityName}</span></p>
                      </Tooltip>
                      <Tooltip content={`Formula: 8 + Proficiency Bonus (${profBonus}) + ${spellcastingAbilityName.substring(0,3)} Mod (${spellcastingModifier})`}>
                          <p>Save DC: <span className="font-semibold text-blue-400">{spellSaveDc}</span></p>
                      </Tooltip>
                      <Tooltip content={`Formula: Proficiency Bonus (${profBonus}) + ${spellcastingAbilityName.substring(0,3)} Mod (${spellcastingModifier})`}>
                          <p>Attack Mod: <span className="font-semibold text-green-400">{spellAttackModifierString}</span></p>
                      </Tooltip>
                  </div>
              </div>
            )}

            {/* Ability Scores */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Ability Scores</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {Object.entries(character.finalAbilityScores).map(([key, value]) => (
                    <p key={key}>{key.substring(0,3)}: <span className="font-semibold text-amber-300">{value as number}</span> ({getAbilityModifierString(value as number)})</p>
                ))}
                </div>
            </div>

            {/* Features & Traits */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Features & Traits</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                    {/* Class Features */}
                    {character.class.features.map(feature => (
                         <li key={feature.id}>
                            <Tooltip content={feature.description}>
                                <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">{feature.name}</span>
                            </Tooltip>
                        </li>
                    ))}
                    {/* Fighting Style */}
                    {character.selectedFightingStyle && (
                         <li key={character.selectedFightingStyle.id}>
                            <Tooltip content={character.selectedFightingStyle.description}>
                                <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">Fighting Style: {character.selectedFightingStyle.name}</span>
                            </Tooltip>
                        </li>
                    )}
                    {/* Divine Order (Cleric) */}
                    {character.selectedDivineOrder && (
                         <li><span className="font-medium text-amber-200">Divine Order: {character.selectedDivineOrder}</span></li>
                    )}
                     {/* Primal Order (Druid) */}
                    {character.selectedDruidOrder && (
                         <li><span className="font-medium text-amber-200">Primal Order: {character.selectedDruidOrder}</span></li>
                    )}
                     {/* Warlock Patron */}
                    {character.selectedWarlockPatron && (
                         <li><span className="font-medium text-amber-200">Patron: {character.selectedWarlockPatron}</span></li>
                    )}

                    {/* Feats */}
                    {character.feats && character.feats.length > 0 && character.feats.map(featId => {
                        const feat = FEATS_DATA.find(f => f.id === featId);
                        if (!feat) return null;

                        const featChoice = character.featChoices?.[featId];
                        const selectedASI = featChoice?.selectedAbilityScore;

                        // Build display text with choices
                        let displayText = feat.name;
                        if (selectedASI && feat.benefits?.selectableAbilityScores) {
                            displayText += ` (${selectedASI} +1)`;
                        }

                        return (
                            <li key={featId}>
                                <Tooltip content={feat.description}>
                                    <span className="font-medium text-emerald-200 cursor-help border-b border-dotted border-emerald-200/50">
                                        {displayText}
                                    </span>
                                </Tooltip>
                            </li>
                        );
                    })}

                    {/* Racial Traits */}
                    {character.race.traits.map((trait, index) => {
                        // Simple heuristic to get trait name: split by colon
                        const parts = trait.split(':');
                        const traitName = parts[0];
                        const traitDesc = parts.slice(1).join(':').trim();

                        return (
                            <li key={`race-trait-${index}`}>
                                {traitDesc ? (
                                    <Tooltip content={traitDesc}>
                                        <span className="font-medium text-sky-200 cursor-help border-b border-dotted border-sky-200/50">{traitName}</span>
                                    </Tooltip>
                                ) : (
                                    <span className="text-sky-200">{trait}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Proficiencies */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
              <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Proficiencies</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-300">Armor:</p>
                  <p className="text-xs text-gray-400 pl-2">{proficiencies.armor}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Weapons:</p>
                  <p className="text-xs text-gray-400 pl-2">{proficiencies.weapons}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Tools:</p>
                  {proficiencies.tools.length > 0 ? (
                    <ul className="list-disc list-inside pl-2 text-xs text-gray-400">
                      {proficiencies.tools.map(t => <li key={t}>{t}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">None</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Languages:</p>
                  {proficiencies.languages.length > 0 ? (
                    <ul className="list-disc list-inside pl-2 text-xs text-gray-400">
                      {proficiencies.languages.map(l => <li key={l}>{l}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">None</p>
                  )}
                </div>
              </div>
            </div>

            {/* Skill Details Button */}
            <div className="mt-4">
                <button
                    onClick={onOpenSkillDetails}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                    View Skill Details
                </button>
            </div>

        </div>
     </div>
  );
};

export default CharacterOverview;
