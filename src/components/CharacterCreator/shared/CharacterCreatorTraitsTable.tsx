/**
 * @file CharacterCreatorTraitsTable.tsx
 * Reusable traits table component for character creator steps.
 * Uses the spell progression table style (TRAIT | DESCRIPTION columns).
 */
import React, { useMemo } from 'react';
import { GlossarySpellsOfTheMarkTable } from '../../Glossary/GlossarySpellsOfTheMarkTable';
import { GlossaryContentRenderer } from '../../Glossary/GlossaryContentRenderer';
import { GlossaryIcon } from '../../Glossary/IconRegistry';
import { getTraitIcon } from '../../../utils/traits/traitIcons';

interface BaseTraits {
    type?: string;
    size?: string;
    speed?: number;
    darkvision?: number;
}

interface Trait {
    name: string;
    description: string;
}

interface SpellProgression {
    level: string;
    name: string;
    usage: string;
}

interface CharacterCreatorTraitsTableProps {
    baseTraits?: BaseTraits;
    traits: Trait[];
    onSpellClick?: (spellId: string) => void;
    spellsOfTheMark?: { minLevel: number; spells: string[] }[];
}

const parseSpellProgression = (description: string): { spells: SpellProgression[], remainingDescription: string } => {
    const spells: SpellProgression[] = [];
    let remainingDescription = description;

    const cantripRegex = /you know the (.*?) cantrip\./i;
    const leveledSpellRegex = /starting at (\d+)(?:st|nd|rd|th) level, you can (?:also )?cast the (.*?) spell/gi;

    const cantripMatch = remainingDescription.match(cantripRegex);
    if (cantripMatch && cantripMatch[1]) {
        spells.push({ level: '1st', name: cantripMatch[1].trim(), usage: 'Cantrip' });
        remainingDescription = remainingDescription.replace(cantripRegex, '').trim();
    }

    let match;
    while ((match = leveledSpellRegex.exec(description)) !== null) {
        const level = match[1];
        const spellName = match[2].trim();
        let usage = '1 per Long Rest';
        if (description.toLowerCase().includes('or using any spell slots')) {
            usage += ' or Spell Slot';
        }
        spells.push({ level: `${level}${level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th'}`, name: spellName, usage });
        const sentenceRegex = new RegExp(`Starting at ${level}(?:st|nd|rd|th) level, you can also? cast the ${spellName} spell with this trait, without requiring a material component.`, 'i');
        remainingDescription = remainingDescription.replace(sentenceRegex, '').trim();
    }

    remainingDescription = remainingDescription.replace(/Once you cast.*?Long Rest\./gi, '').trim();
    remainingDescription = remainingDescription.replace(/You can also cast.*?level\./gi, '').trim();
    const spellAbilityRegex = /Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait \(choose when you select this race\)\./i;
    const spellcastingAbilityInfo = description.match(spellAbilityRegex);

    remainingDescription = remainingDescription.replace(spellAbilityRegex, '').trim();
    remainingDescription = remainingDescription.replace(/\s{2,}/g, ' ');

    if (spells.length > 0 && spellcastingAbilityInfo) {
        remainingDescription = `${spellcastingAbilityInfo[0]}`.trim();
    }

    return { spells, remainingDescription };
};

const toKebabCase = (str: string) => str.toLowerCase().replace(/[\s/]+/g, '-');

/**
 * Reusable traits table for character creator using spell progression style.
 * Automatically includes base stats (Creature Type, Size, Speed, Vision) at the top.
 */
export const CharacterCreatorTraitsTable: React.FC<CharacterCreatorTraitsTableProps> = ({
    baseTraits,
    traits,
    onSpellClick,
    spellsOfTheMark
}) => {
    // Determine vision text
    const visionText = useMemo(() => {
        if (baseTraits?.darkvision && baseTraits.darkvision > 0) {
            const isSuperior = baseTraits.darkvision > 60;
            return isSuperior ? 'Superior Darkvision' : 'Standard Darkvision';
        }
        return 'Normal';
    }, [baseTraits?.darkvision]);

    const visionDescription = useMemo(() => {
        if (baseTraits?.darkvision && baseTraits.darkvision > 0) {
            const range = baseTraits.darkvision;
            const prefix = range > 60 ? '[[darkvision|Superior Darkvision]]. ' : '';
            return `${prefix}You can see in [[dim_light|dim light]] within ${range} feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.`;
        }
        return 'You have normal [[vision]].';
    }, [baseTraits?.darkvision]);

    return (
        <div className="overflow-hidden rounded-lg border border-gray-600 shadow-lg bg-gray-900/40">
            <table className="w-full text-left text-xs bg-black/20 rounded border-collapse [&_p]:m-0 [&_p]:leading-relaxed">
                <thead>
                    <tr className="border-b border-gray-600">
                        <th className="py-3 px-4 font-semibold text-amber-300 uppercase tracking-wider w-1/3">Trait</th>
                        <th className="py-3 px-4 font-semibold text-amber-300 uppercase tracking-wider">Description</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                    {/* Creature Type */}
                    {baseTraits?.type && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <div className="flex items-center gap-2">
                                    <span className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400">
                                        <GlossaryIcon name={getTraitIcon('Creature Type')} className="w-4 h-4" />
                                    </span>
                                    <span className="text-sky-400 font-semibold">Creature Type</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                                <GlossaryContentRenderer markdownContent={baseTraits.type} onNavigate={onSpellClick} />
                            </td>
                        </tr>
                    )}

                    {/* Size */}
                    {baseTraits?.size && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <div className="flex items-center gap-2">
                                    <span className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400">
                                        <GlossaryIcon name={getTraitIcon('Size')} className="w-4 h-4" />
                                    </span>
                                    <span className="text-sky-400 font-semibold">Size</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                                <GlossaryContentRenderer markdownContent={baseTraits.size} onNavigate={onSpellClick} />
                            </td>
                        </tr>
                    )}

                    {/* Speed */}
                    {baseTraits?.speed !== undefined && (
                        <tr className="hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-4 align-top">
                                <div className="flex items-center gap-2">
                                    <span className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400">
                                        <GlossaryIcon name={getTraitIcon('Speed')} className="w-4 h-4" />
                                    </span>
                                    <span className="text-sky-400 font-semibold">Speed</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{baseTraits.speed} feet</td>
                        </tr>
                    )}

                    {/* Vision (always shown) */}
                    <tr className="hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2">
                                <span className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400">
                                    <GlossaryIcon name={getTraitIcon('Vision')} className="w-4 h-4" />
                                </span>
                                <span className="text-sky-400 font-semibold">Vision</span>
                            </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                            <div className="font-medium">{visionText} ({baseTraits?.darkvision || 0} feet)</div>
                            <div className="text-xs text-gray-400 mt-1">
                                <GlossaryContentRenderer markdownContent={visionDescription} onNavigate={onSpellClick} />
                            </div>
                        </td>
                    </tr>

                    {/* All other racial traits */}
                    {traits.map((trait, index) => {
                        const { spells, remainingDescription } = parseSpellProgression(trait.description);
                        const iconName = getTraitIcon(trait.name);

                        return (
                            <tr key={index} className="hover:bg-gray-800/50 transition-colors">
                                <td className="py-3 px-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <span className="flex-shrink-0 p-1 rounded bg-sky-900/30 text-sky-400">
                                            <GlossaryIcon name={iconName} className="w-4 h-4" />
                                        </span>
                                        <span className="text-sky-400 font-semibold">{trait.name}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-gray-300">
                                    {trait.name === 'Spells of the Mark' && spellsOfTheMark ? (
                                        <>
                                            <GlossaryContentRenderer markdownContent={trait.description} onNavigate={onSpellClick} className="mb-2" />
                                            <GlossarySpellsOfTheMarkTable
                                                spells={spellsOfTheMark}
                                                onNavigate={(termId) => onSpellClick?.(toKebabCase(termId))}
                                                variant="embedded"
                                            />
                                        </>
                                    ) : spells.length > 0 ? (
                                        <>
                                            <table className="w-full text-left text-xs my-2 bg-black/30 rounded border border-gray-700/50">
                                                <thead>
                                                    <tr className="border-b border-gray-600">
                                                        <th className="py-2 px-3 font-semibold text-amber-300">LEVEL</th>
                                                        <th className="py-2 px-3 font-semibold text-amber-300">SPELL/ABILITY</th>
                                                        <th className="py-2 px-3 font-semibold text-amber-300">USAGE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {spells.map((spell, spellIndex) => (
                                                        <tr key={spellIndex} className="border-b border-gray-700/30 last:border-0">
                                                            <td className="py-2 px-3 text-amber-400">{spell.level}</td>
                                                            <td className="py-2 px-3">
                                                                {onSpellClick ? (
                                                                    <button
                                                                        onClick={() => onSpellClick(toKebabCase(spell.name))}
                                                                        className="text-sky-400 hover:text-sky-200 underline transition-colors"
                                                                    >
                                                                        {spell.name}
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-sky-400">{spell.name}</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3">{spell.usage}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {remainingDescription && (
                                                <GlossaryContentRenderer markdownContent={remainingDescription} onNavigate={onSpellClick} className="mt-2 italic text-xs" />
                                            )}
                                        </>
                                    ) : (
                                        <GlossaryContentRenderer markdownContent={trait.description} onNavigate={onSpellClick} />
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
