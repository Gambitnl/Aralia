
import React, { useState } from 'react';
import { Discovery, DiscoveryOption, DiscoveryReward, DiscoveryConsequence, PlayerCharacter, AbilityScoreName } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getAbilityModifierValue } from '../../utils/characterUtils';

interface DiscoveryModalProps {
  discovery: Discovery;
  onClose: () => void;
  onResolveInteraction: (option: DiscoveryOption, success: boolean) => void;
  onLeave: () => void;
  character: PlayerCharacter | null; // Pass the active character
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({
  discovery,
  onClose,
  onResolveInteraction,
  onLeave,
  character
}) => {
  const [selectedOption, setSelectedOption] = useState<DiscoveryOption | null>(null);
  const [resolution, setResolution] = useState<{ success: boolean; resultText: string } | null>(null);

  const modalRef = useFocusTrap(true);

  const handleOptionClick = (option: DiscoveryOption) => {
    setSelectedOption(option);

    // Default roll
    let roll = Math.floor(Math.random() * 20) + 1;
    let modifier = 0;

    // Apply character stats if available
    if (character && option.skillCheck) {
        // Map skill to ability (simplified mapping)
        const skillToAbility: Record<string, string> = {
            'Arcana': 'Intelligence',
            'Religion': 'Intelligence',
            'Nature': 'Intelligence',
            'Investigation': 'Intelligence',
            'History': 'Intelligence',
            'Athletics': 'Strength',
            'Acrobatics': 'Dexterity',
            'Sleight of Hand': 'Dexterity',
            'Stealth': 'Dexterity',
            'Survival': 'Wisdom',
            'Perception': 'Wisdom',
            'Medicine': 'Wisdom',
            'Insight': 'Wisdom',
            'Animal Handling': 'Wisdom',
            'Persuasion': 'Charisma',
            'Deception': 'Charisma',
            'Intimidation': 'Charisma',
            'Performance': 'Charisma'
        };

        const abilityName = skillToAbility[option.skillCheck.skill];
        if (abilityName && character.finalAbilityScores) {
             const score = character.finalAbilityScores[abilityName as AbilityScoreName] || 10;
             modifier = getAbilityModifierValue(score);

             // Check proficiency (simplified: check if skill is in character skills list)
             // character.skills is an array of Skill objects
             if (character.skills.some(s => s.name === option.skillCheck!.skill)) {
                 modifier += (character.proficiencyBonus || 2);
             }
        }
    }

    const total = roll + modifier;
    const difficulty = option.skillCheck?.difficulty || 10;
    const success = total >= difficulty;

    const resultText = success
        ? `Success! (Rolled ${roll} + ${modifier} = ${total} vs DC ${difficulty})`
        : `Failure. (Rolled ${roll} + ${modifier} = ${total} vs DC ${difficulty})`;

    setResolution({ success, resultText });
    onResolveInteraction(option, success);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" role="dialog" aria-modal="true" aria-labelledby="discovery-title">
      <div
        ref={modalRef}
        className="bg-stone-900 border-2 border-amber-700/50 rounded-lg max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none bg-[url('/texture-paper.png')] opacity-10 mix-blend-overlay"></div>

        <h2 id="discovery-title" className="text-3xl font-serif text-amber-500 mb-4 text-center border-b border-stone-700 pb-2">
          {discovery.name}
        </h2>

        <div className="prose prose-invert mb-6 text-stone-300 italic text-lg leading-relaxed text-center">
          {discovery.description}
        </div>

        {!resolution ? (
          <div className="grid gap-4">
            <h3 className="text-xl text-stone-400 font-semibold mb-2">How do you proceed?</h3>
            {discovery.interactions?.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                className="group relative w-full text-left p-4 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-amber-100 group-hover:text-amber-400">{option.label}</span>
                  {option.skillCheck && (
                    <span className="text-xs text-stone-500 uppercase tracking-widest bg-stone-900 px-2 py-1 rounded">
                      {option.skillCheck.skill} DC {option.skillCheck.difficulty}
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-400">{option.description}</p>
              </button>
            ))}

            <button
              onClick={onLeave}
              className="mt-4 w-full p-3 text-stone-400 hover:text-stone-200 border border-transparent hover:border-stone-600 rounded text-center transition-colors"
            >
              Leave it be
            </button>
          </div>
        ) : (
          <div className="text-center animate-in fade-in duration-300">
             <div className={`text-2xl font-bold mb-4 ${resolution.success ? 'text-green-500' : 'text-red-500'}`}>
               {resolution.resultText}
             </div>

             <div className="mb-6 text-stone-300">
                {resolution.success ? (
                    <div className="space-y-2">
                        {selectedOption?.successRewards?.map((r, i) => (
                            <div key={i} className="text-green-400">+ {r.description}</div>
                        ))}
                        {selectedOption?.successConsequences?.map((c, i) => (
                            <div key={i} className="text-blue-400">Effect: {c.description}</div>
                        ))}
                         {(!selectedOption?.successRewards?.length && !selectedOption?.successConsequences?.length) &&
                            <p>Nothing happens.</p>
                        }
                    </div>
                ) : (
                    <div className="space-y-2">
                        {selectedOption?.failureConsequences?.map((c, i) => (
                            <div key={i} className="text-red-400">Effect: {c.description}</div>
                        ))}
                        {(!selectedOption?.failureConsequences?.length) && <p>You fail, but suffer no ill effects.</p>}
                    </div>
                )}
             </div>

             <button
               onClick={onClose}
               className="bg-amber-700 hover:bg-amber-600 text-white px-8 py-2 rounded font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
             >
               Continue Journey
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
