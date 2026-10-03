// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 07:53:48
 * Dependents: components/CharacterSheet/Skills/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SkillsTab.tsx
 * Tab version of skill details display for the character sheet.
 * Shows all skills with modifiers, proficiency, and bonuses in a table.
 */
import React from 'react';
import { PlayerCharacter, Skill as SkillType } from '../../../types';
import { SKILLS_DATA } from '../../../data/skills';
import { getAbilityModifierValue, getCheckAdvantageSources } from '../../../utils/character';
import { calculateExpertiseBonus, getExpertiseSkillIds } from '../../../utils/character/skillModifierUtils';
import { SkillIcon } from '../../../utils/skillIcons';
import { ProficiencyIcon } from '../../../utils/proficiencyIcons';
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
    // Expertise doubles the proficiency bonus on the skills the character chose it
    // for. The picks are read once per render and shared by every row.
    const expertiseSkillIds = getExpertiseSkillIds(character);
    const skillRows = allGameSkills.map(skill => {
        const baseAbilityScore = character.finalAbilityScores[skill.ability];
        const abilityModifier = getAbilityModifierValue(baseAbilityScore);
        const isProficient = character.skills.some(profSkill => profSkill.id === skill.id);
        const proficiencyBonusApplied = isProficient ? profBonus : 0;
        const hasExpertise = expertiseSkillIds.includes(skill.id);
        const expertiseBonus = calculateExpertiseBonus({
            hasProficiency: isProficient,
            hasExpertise,
            proficiencyBonus: profBonus,
        });
        const totalBonus = abilityModifier + proficiencyBonusApplied + expertiseBonus;

        const notes: string[] = [];
        const tooltipParts: string[] = [];

        // Check for race-specific advantages
        if (skill.id === 'stealth' && character.race.id === 'deep_gnome') {
            const svirfneblinCamouflageTrait = character.race.traits.find(trait =>
                trait.toLowerCase().includes('svirfneblin camouflage')
            );
            if (svirfneblinCamouflageTrait) {
                notes.push('Advantage (Racial)');
                tooltipParts.push('Advantage on Dexterity (Stealth) checks due to Svirfneblin Camouflage.');
            }
        }

        // Active status riders, such as the divine blessing Scales of Justice, carry
        // their own advantage scope. Read the same source the check resolver reads so
        // the sheet cannot promise an advantage the roll will not grant.
        const structuredAdvantage = getCheckAdvantageSources(character, skill.ability, skill.name);
        structuredAdvantage.advantage.forEach(source => {
            notes.push(`Advantage (${source})`);
            tooltipParts.push(`${source} grants advantage on ${skill.name} checks.`);
        });
        structuredAdvantage.disadvantage.forEach(source => {
            notes.push(`Disadvantage (${source})`);
            tooltipParts.push(`${source} imposes disadvantage on ${skill.name} checks.`);
        });

        const advantageNotes = notes.length > 0 ? notes.join(', ') : '-';
        const advantageTooltip = tooltipParts.join(' ');

        return {
            skill,
            abilityModifier,
            isProficient,
            expertiseBonus,
            totalBonus,
            advantageNotes,
            advantageTooltip,
        };
    });

    return (
        <div className="h-full overflow-y-auto scrollable-content">
            <div className="max-w-4xl mx-auto">
                <h3 className="text-xl font-cinzel text-amber-400 mb-4">Skill Statistics</h3>

                {/* Phone-width sheets need every skill column visible without
                    side-scrolling, so they use compact per-skill cards. Wider
                    sheets retain the comparison table, with x-scroll as a
                    fallback for manually resized windows. */}
                <div data-testid="skills-compact-list" className="space-y-2 min-[521px]:hidden">
                    {skillRows.map(({ skill, abilityModifier, isProficient, expertiseBonus, totalBonus, advantageNotes, advantageTooltip }) => (
                        <div key={skill.id} className="rounded-lg border border-gray-700 bg-gray-800/80 p-3">
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-amber-200 flex items-center gap-1.5">
                                        <SkillIcon name={skill.id} className="w-4 h-4 text-amber-300 shrink-0" />
                                        {skill.name} <span className="text-xs text-gray-400">({skill.ability.substring(0, 3)})</span>
                                    </p>
                                    {skill.description && (
                                        <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{skill.description}</p>
                                    )}
                                    {advantageTooltip ? (
                                        <Tooltip content={advantageTooltip}>
                                            <span className="text-xs text-sky-300 underline decoration-dotted cursor-help">
                                                {advantageNotes}
                                            </span>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-xs text-gray-400">Notes: {advantageNotes}</span>
                                    )}
                                </div>
                                <div className={`text-lg font-bold ${totalBonus >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                    {totalBonus >= 0 ? '+' : ''}{totalBonus}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded bg-gray-900/60 px-2 py-1">
                                    <span className="block text-gray-400">Mod</span>
                                    <span className="font-semibold text-gray-100">{abilityModifier >= 0 ? '+' : ''}{abilityModifier}</span>
                                </div>
                                <div className="rounded bg-gray-900/60 px-2 py-1">
                                    <GlossaryTooltip termId="proficiency_bonus" onNavigateToGlossary={onNavigateToGlossary}>
                                        <span className="block text-gray-400 underline decoration-dotted cursor-help">Prof.</span>
                                    </GlossaryTooltip>
                                    <span className={`inline-flex items-center gap-1 ${isProficient ? 'font-semibold text-green-400' : 'text-gray-400'}`}>
                                        <ProficiencyIcon level={isProficient ? 'proficient' : 'unskilled'} className={`w-3 h-3 ${isProficient ? 'text-green-400' : 'text-gray-600'}`} />
                                        {isProficient ? `+${profBonus}` : '-'}
                                    </span>
                                </div>
                                <div className="rounded bg-gray-900/60 px-2 py-1">
                                    <GlossaryTooltip termId="expertise" onNavigateToGlossary={onNavigateToGlossary}>
                                        <span className="block text-gray-400 underline decoration-dotted cursor-help">Expert</span>
                                    </GlossaryTooltip>
                                    <span className={`inline-flex items-center gap-1 ${expertiseBonus > 0 ? 'font-semibold text-green-400' : 'text-gray-400'}`}>
                                        <ProficiencyIcon level={expertiseBonus > 0 ? 'expertise' : 'unskilled'} className={`w-3 h-3 ${expertiseBonus > 0 ? 'text-green-400' : 'text-gray-600'}`} />
                                        {expertiseBonus > 0 ? `+${expertiseBonus}` : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div data-testid="skills-table-scroll" className="max-[520px]:hidden overflow-x-auto">
                    <table className="min-w-[44rem] divide-y divide-gray-600 border border-gray-600 rounded-lg">
                        <thead className="bg-gray-700 sticky top-0 z-[var(--z-index-content-overlay-low)]">
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
                            {skillRows.map(({ skill, abilityModifier, isProficient, expertiseBonus, totalBonus, advantageNotes, advantageTooltip }) => (
                                <tr key={skill.id} className={alternatingRowClass}>
                                    <td className={`${tableCellClass} font-medium text-amber-200`}>
                                        <Tooltip content={skill.description ?? skill.name}>
                                            <span className="inline-flex items-center gap-1.5 cursor-help" data-testid={`skill-name-${skill.id}`}>
                                                <SkillIcon name={skill.id} className="w-4 h-4 text-amber-300 shrink-0" />
                                                <span className="underline decoration-dotted decoration-amber-300/50 underline-offset-2">{skill.name}</span>
                                                <span className="text-xs text-gray-400">({skill.ability.substring(0, 3)})</span>
                                            </span>
                                        </Tooltip>
                                        {/* First sentence inline: what the skill covers. The tooltip carries both sentences (agora-d1c7.7). */}
                                        <div className="mt-0.5 max-w-[22rem] whitespace-normal text-[11px] font-normal leading-snug text-gray-400">
                                            {(skill.description ?? '').split('. ')[0]}{skill.description ? '.' : ''}
                                        </div>
                                    </td>
                                    <td className={`${tableCellClass} text-center`}>
                                        {abilityModifier >= 0 ? '+' : ''}{abilityModifier}
                                    </td>
                                    <td className={`${tableCellClass} text-center`}>
                                        <span className="inline-flex items-center justify-center gap-1.5">
                                            <ProficiencyIcon level={isProficient ? 'proficient' : 'unskilled'} className={`w-3.5 h-3.5 ${isProficient ? 'text-green-400' : 'text-gray-600'}`} />
                                            {isProficient ? (
                                                <span className="text-green-400">+{profBonus}</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className={`${tableCellClass} text-center text-gray-500`}>
                                        <span className="inline-flex items-center justify-center gap-1.5">
                                            <ProficiencyIcon level={expertiseBonus > 0 ? 'expertise' : 'unskilled'} className={`w-3.5 h-3.5 ${expertiseBonus > 0 ? 'text-green-400' : 'text-gray-600'}`} />
                                            {expertiseBonus > 0 ? (
                                                <span className="text-green-400">+{expertiseBonus}</span>
                                            ) : '-'}
                                        </span>
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
                                            <span className="text-gray-400">{advantageNotes}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SkillsTab;
