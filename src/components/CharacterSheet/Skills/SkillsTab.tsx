/**
 * @file SkillsTab.tsx
 * Tab version of skill details display for the character sheet.
 * Shows all skills with modifiers, proficiency, and bonuses in a table.
 */
import React from 'react';
import { PlayerCharacter, Skill as SkillType } from '../../../types';
import { SKILLS_DATA } from '../../../data/skills';
import { getAbilityModifierValue } from '../../../utils/characterUtils';
import Tooltip from '../../ui/Tooltip';
import GlossaryTooltip from '../../Glossary/GlossaryTooltip';

interface SkillsTabProps {
    character: PlayerCharacter;
    onNavigateToGlossary?: (termId: string) => void;
}

const SkillsTab: React.FC<SkillsTabProps> = ({ character, onNavigateToGlossary }) => {
    const allGameSkills: SkillType[] = Object.values(SKILLS_DATA);
    const profBonus = character.proficiencyBonus || 2;

    const tableHeaderClass = "px-3 py-2.5 text-left text-xs font-medium text-sky-300 uppercase tracking-wider border-b-2 border-gray-600";
    const tableCellClass = "px-3 py-2.5 text-sm text-gray-200 whitespace-nowrap";
    const alternatingRowClass = "even:bg-gray-700/50 odd:bg-gray-700/20 hover:bg-sky-700/30 transition-colors";

    return (
        <div className="h-full overflow-y-auto scrollable-content">
            <div className="max-w-4xl mx-auto">
                <h3 className="text-xl font-cinzel text-amber-400 mb-4">Skill Statistics</h3>

                <table className="min-w-full divide-y divide-gray-600 border border-gray-600 rounded-lg">
                    <thead className="bg-gray-700 sticky top-0 z-10">
                        <tr>
                            <th scope="col" className={tableHeaderClass}>Skill</th>
                            <th scope="col" className={`${tableHeaderClass} text-center`}>Mod</th>
                            <th scope="col" className={`${tableHeaderClass} text-center`}>
                                <GlossaryTooltip termId="proficiency_bonus" onNavigateToGlossary={onNavigateToGlossary}>
                                    <span className="underline decoration-dotted cursor-help">Prof.</span>
                                </GlossaryTooltip>
                            </th>
                            <th scope="col" className={`${tableHeaderClass} text-center`}>
                                <GlossaryTooltip termId="expertise" onNavigateToGlossary={onNavigateToGlossary}>
                                    <span className="underline decoration-dotted cursor-help">Expertise</span>
                                </GlossaryTooltip>
                            </th>
                            <th scope="col" className={`${tableHeaderClass} text-center`}>Total</th>
                            <th scope="col" className={tableHeaderClass}>Notes</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {allGameSkills.map(skill => {
                            const baseAbilityScore = character.finalAbilityScores[skill.ability];
                            const abilityModifier = getAbilityModifierValue(baseAbilityScore);
                            const isProficient = character.skills.some(profSkill => profSkill.id === skill.id);
                            const proficiencyBonusApplied = isProficient ? profBonus : 0;
                            const expertiseBonus = 0; // Placeholder for expertise
                            const totalBonus = abilityModifier + proficiencyBonusApplied + expertiseBonus;

                            let advantageNotes = '-';
                            let advantageTooltip = '';

                            // Check for race-specific advantages
                            if (skill.id === 'stealth' && character.race.id === 'deep_gnome') {
                                const svirfneblinCamouflageTrait = character.race.traits.find(trait =>
                                    trait.toLowerCase().includes('svirfneblin camouflage')
                                );
                                if (svirfneblinCamouflageTrait) {
                                    advantageNotes = 'Advantage (Racial)';
                                    advantageTooltip = 'Advantage on Dexterity (Stealth) checks due to Svirfneblin Camouflage.';
                                }
                            }

                            return (
                                <tr key={skill.id} className={alternatingRowClass}>
                                    <td className={`${tableCellClass} font-medium text-amber-200`}>
                                        {skill.name} <span className="text-xs text-gray-400">({skill.ability.substring(0, 3)})</span>
                                    </td>
                                    <td className={`${tableCellClass} text-center`}>
                                        {abilityModifier >= 0 ? '+' : ''}{abilityModifier}
                                    </td>
                                    <td className={`${tableCellClass} text-center`}>
                                        {isProficient ? (
                                            <span className="text-green-400">+{profBonus}</span>
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className={`${tableCellClass} text-center text-gray-500`}>
                                        {expertiseBonus > 0 ? (
                                            <span className="text-green-400">+{expertiseBonus}</span>
                                        ) : '-'}
                                    </td>
                                    <td className={`${tableCellClass} text-center font-bold ${totalBonus >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {totalBonus >= 0 ? '+' : ''}{totalBonus}
                                    </td>
                                    <td className={tableCellClass}>
                                        {advantageTooltip ? (
                                            <Tooltip content={advantageTooltip}>
                                                <span className="text-sky-300 underline decoration-dotted cursor-help">
                                                    {advantageNotes}
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-gray-500">{advantageNotes}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SkillsTab;
