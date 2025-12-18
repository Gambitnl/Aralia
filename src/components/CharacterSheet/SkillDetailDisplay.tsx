/**
 * @file SkillDetailDisplay.tsx
 * This component displays detailed statistics for each character skill as a modal overlay.
 * It includes base ability, modifier, proficiency, expertise (placeholder),
 * total bonus, and any advantage notes, presented in a table format.
 */
import React, { useEffect, useRef } from 'react';
import { PlayerCharacter, Skill as SkillType } from '../../types';
import { SKILLS_DATA } from '../../constants';
import { getAbilityModifierValue } from '../../utils/characterUtils';
import Tooltip from '../Tooltip'; 
import GlossaryTooltip from '../Glossary/GlossaryTooltip';

interface SkillDetailDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  character: PlayerCharacter;
  onNavigateToGlossary?: (termId: string) => void; 
}

const PROFICIENCY_BONUS_VALUE = 2; // Assuming Level 1 for now

const SkillDetailDisplay: React.FC<SkillDetailDisplayProps> = ({ isOpen, onClose, character, onNavigateToGlossary }) => {
  const allGameSkills: SkillType[] = Object.values(SKILLS_DATA);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const tableHeaderClass = "px-3 py-2.5 text-left text-xs font-medium text-sky-300 uppercase tracking-wider border-b-2 border-gray-600";
  const tableCellClass = "px-3 py-2.5 text-sm text-gray-200 whitespace-nowrap";
  const alternatingRowClass = "even:bg-gray-700/50 odd:bg-gray-700/20 hover:bg-sky-700/30 transition-colors";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4" // z-index higher than CharacterSheetModal
      aria-modal="true"
      role="dialog"
      aria-labelledby="skill-detail-overlay-title"
    >
      <div
        ref={modalContentRef}
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-600">
          <h2 id="skill-detail-overlay-title" className="text-2xl font-bold text-amber-400 font-cinzel">
            Detailed Skill Statistics
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Close skill details"
          >
            &times;
          </button>
        </div>

        {/* Skill Table */}
        <div className="overflow-y-auto scrollable-content flex-grow pr-1">
          <table className="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg">
            <thead className="bg-gray-700 sticky top-0 z-10">
              <tr>
                <th scope="col" className={`${tableHeaderClass}`}>Skill</th>
                <th scope="col" className={`${tableHeaderClass} text-center`}>Mod</th>
                <th scope="col" className={`${tableHeaderClass} text-center`}>
                  <GlossaryTooltip termId="proficiency_bonus" onNavigateToGlossary={onNavigateToGlossary}>
                    <span className="underline decoration-dotted cursor-help">Proficiency Bonus</span>
                  </GlossaryTooltip>
                </th>
                <th scope="col" className={`${tableHeaderClass} text-center`}>
                  <GlossaryTooltip termId="expertise" onNavigateToGlossary={onNavigateToGlossary}>
                    <span className="underline decoration-dotted cursor-help">Expertise Bonus</span>
                  </GlossaryTooltip>
                </th>
                <th scope="col" className={`${tableHeaderClass} text-center`}>Total</th>
                <th scope="col" className={`${tableHeaderClass}`}>Advantage Notes</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {allGameSkills.map(skill => {
                const baseAbilityScore = character.finalAbilityScores[skill.ability];
                const abilityModifier = getAbilityModifierValue(baseAbilityScore);
                const isProficient = character.skills.some(profSkill => profSkill.id === skill.id);
                const proficiencyBonusApplied = isProficient ? PROFICIENCY_BONUS_VALUE : 0;
                const expertiseBonus = 0; // Placeholder
                const totalBonus = abilityModifier + proficiencyBonusApplied + expertiseBonus;

                let advantageNotes = '-';
                let advantageTooltip = '';

                if (skill.id === 'stealth' && character.race.id === 'deep_gnome') {
                  const svirfneblinCamouflageTrait = character.race.traits.find(trait => trait.toLowerCase().includes('svirfneblin camouflage'));
                  if (svirfneblinCamouflageTrait) {
                    advantageNotes = 'Svirfneblin Camouflage';
                    advantageTooltip = 'Advantage on Dexterity (Stealth) checks due to Svirfneblin Camouflage.';
                  }
                }
                
                return (
                  <tr key={skill.id} className={alternatingRowClass}>
                    <td className={`${tableCellClass} font-medium text-amber-200`}>
                      {skill.name} <span className="text-xs text-gray-400">({skill.ability.substring(0, 3)})</span>
                    </td>
                    <td className={`${tableCellClass} text-center`}>{abilityModifier >= 0 ? '+' : ''}{abilityModifier}</td>
                    <td className={`${tableCellClass} text-center`}>
                      {isProficient ? <span className="text-green-400">+{PROFICIENCY_BONUS_VALUE}</span> : <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className={`${tableCellClass} text-center text-gray-400`}>
                      {expertiseBonus > 0 ? <span className="text-green-400">+{expertiseBonus}</span> : 'N/A'}
                    </td>
                    <td className={`${tableCellClass} text-center font-bold ${totalBonus >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {totalBonus >= 0 ? '+' : ''}{totalBonus}
                    </td>
                    <td className={`${tableCellClass}`}>
                      {advantageTooltip ? (
                        <Tooltip content={advantageTooltip}>
                          <span className="text-sky-300 underline decoration-dotted cursor-help">
                            {advantageNotes}
                          </span>
                        </Tooltip>
                      ) : (
                        advantageNotes
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Close skill details"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillDetailDisplay;