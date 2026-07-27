import React from 'react';
import { AbilityScores, Race, AbilityScoreName, Class as CharClass } from '../../types';
import { ABILITY_SCORE_NAMES } from '../../constants';

interface CharacterStatBlockProps {
  baseScores: AbilityScores;
  race: Race;
  selectedClass: CharClass | null;
}

const getAbilityModifier = (score: number) => Math.floor((score - 10) / 2);
const getAbilityModifierString = (score: number) => {
  const mod = getAbilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const CharacterStatBlock: React.FC<CharacterStatBlockProps> = ({
  baseScores,
  race,
  selectedClass,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-700 pb-4 mb-6">
        <h2 className="text-3xl font-bold text-amber-400 font-cinzel">Ability Snapshot</h2>
        <p className="text-sm text-gray-400">Final scores include racial bonuses.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ABILITY_SCORE_NAMES.map((ability) => {
          const base = baseScores[ability];
          const racial = race.abilityBonuses?.find(b => b.ability === ability)?.bonus || 0;
          const final = base + racial;
          const mod = getAbilityModifierString(final);
          const isPrimary = selectedClass?.primaryAbility.includes(ability);
          const isSave = selectedClass?.savingThrowProficiencies.includes(ability);

          return (
            <div key={ability} className="bg-gray-900/40 border border-gray-700 rounded-xl p-4 flex flex-col items-center relative overflow-hidden group">
              {/* Background "watermark" letter */}
              <span className="absolute -bottom-4 -right-2 text-6xl font-black text-gray-800/50 select-none group-hover:text-gray-800/80 transition-colors">
                {ability.charAt(0)}
              </span>

              <h3 className={`font-cinzel font-bold text-lg mb-1 z-[var(--z-index-content-overlay-low)] ${isPrimary ? 'text-amber-400' : 'text-gray-400'}`}>
                {ability.toUpperCase()}
              </h3>
              
              <div className="text-4xl font-black text-white z-[var(--z-index-content-overlay-low)] mb-1">
                {final}
              </div>
              
              <div className={`px-3 py-0.5 rounded-full text-sm font-bold z-[var(--z-index-content-overlay-low)] ${
                parseInt(mod) >= 0 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
              }`}>
                {mod}
              </div>

              <div className="w-full mt-4 pt-3 border-t border-gray-700/50 z-[var(--z-index-content-overlay-low)] text-xs space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Base</span>
                  <span>{base}</span>
                </div>
                {racial !== 0 && (
                  <div className="flex justify-between text-sky-400">
                    <span>{race.name}</span>
                    <span>+{racial}</span>
                  </div>
                )}
                {isSave && (
                  <div className="mt-2 text-center text-purple-300 font-medium bg-purple-900/20 rounded py-1 border border-purple-500/20">
                    Saving Throw Prof.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CharacterStatBlock;
