/**
 * @file RaceDetailPane.tsx
 * Detailed view of a selected race, designed for the right pane of the Split Config layout.
 */
import React, { useState, useMemo } from 'react';
import ImageModal from '../../ImageModal';
import SingleGlossaryEntryModal from '../../Glossary/SingleGlossaryEntryModal';
import { BTN_PRIMARY } from '../../../styles/buttonStyles';

// Helper to resolve image URLs - prepends BASE_URL for local assets
const resolveImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    // If already absolute URL, use as-is
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // For local asset paths, prepend the Vite base URL
    const baseUrl = import.meta.env.BASE_URL || '/';
    return `${baseUrl}${url}`;
};

export interface RaceDetailData {
    id: string;
    name: string;
    /** @deprecated Use maleImage/femaleImage instead */
    image?: string;
    /** Path to male character illustration */
    maleImage?: string;
    /** Path to female character illustration */
    femaleImage?: string;
    description: string;
    baseTraits: {
        type?: string;
        size?: string;
        speed?: number;
        darkvision?: number;
    };
    feats: { name: string; description: string }[];
    furtherChoicesNote?: string;
    /** Sibling variants for comparison table (if this race belongs to a group) */
    siblingVariants?: Array<{
        id: string;
        name: string;
        speed?: number;
        darkvision?: number;
        keyTraits: string[];
    }>;
    /** Racial spell choice configuration (if race requires spellcasting ability selection) */
    racialSpellChoice?: {
        traitName: string;
        traitDescription: string;
    };
}


interface SpellProgression {
    level: string;
    name: string;
    usage: string;
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

const TraitRow: React.FC<{ trait: { name: string; description: string }, onSpellClick: (id: string) => void }> = ({ trait, onSpellClick }) => {
    const { spells, remainingDescription } = useMemo(() => parseSpellProgression(trait.description), [trait.description]);
    const toKebabCase = (str: string) => str.toLowerCase().replace(/[\s/]+/g, '-');

    return (
        <tr className="hover:bg-gray-800/50 transition-colors border-b border-gray-700/50 last:border-0">
            <td className="px-5 py-4 text-sm align-top">
                <div className="font-bold text-sky-300 text-base mb-2">{trait.name}</div>
                <div className="text-gray-300 text-sm leading-relaxed">
                    {spells.length > 0 ? (
                        <>
                            <table className="w-full text-left text-xs my-2 prose-sm prose-invert bg-black/20 rounded">
                                <thead>
                                    <tr className="border-b border-gray-600">
                                        <th className="py-2 px-3 font-semibold text-amber-300">LEVEL</th>
                                        <th className="py-2 px-3 font-semibold text-amber-300">SPELL/ABILITY</th>
                                        <th className="py-2 px-3 font-semibold text-amber-300">USAGE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spells.map((spell, index) => (
                                        <tr key={index} className="border-b border-gray-700/30 last:border-0">
                                            <td className="py-2 px-3 text-amber-400">{spell.level}</td>
                                            <td className="py-2 px-3">
                                                <button onClick={() => onSpellClick(toKebabCase(spell.name))} className="text-sky-400 hover:text-sky-200 underline transition-colors">
                                                    {spell.name}
                                                </button>
                                            </td>
                                            <td className="py-2 px-3">{spell.usage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {remainingDescription && <p className="mt-2 italic">{remainingDescription}</p>}
                        </>
                    ) : (
                        <p className="whitespace-pre-wrap">{trait.description}</p>
                    )}
                </div>
            </td>
        </tr>
    );
};

const TraitsTable: React.FC<{ traits: { name: string; description: string }[], onSpellClick: (id: string) => void }> = ({ traits, onSpellClick }) => {
    return (
        <div className="overflow-hidden rounded-lg border border-gray-600 shadow-lg bg-gray-900/40">
            <table className="min-w-full divide-y divide-gray-600 border-collapse">
                <tbody className="divide-y divide-gray-700">
                    {traits.map((trait, index) => (
                        <TraitRow key={index} trait={trait} onSpellClick={onSpellClick} />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Collapsible comparison table for race variants (transposed: traits as rows, variants as columns)
const VariantComparisonTable: React.FC<{ variants: NonNullable<RaceDetailData['siblingVariants']>; currentId: string }> = ({ variants, currentId }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (variants.length < 2) return null;

    // Collect all unique key traits across all variants
    const allKeyTraits = Array.from(
        new Set(variants.flatMap(v => v.keyTraits))
    );

    return (
        <div className="bg-gray-900/40 border border-gray-700 rounded-lg overflow-hidden mt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 text-sm font-semibold text-gray-300 hover:bg-gray-800/50 transition-colors"
                aria-expanded={isOpen}
            >
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Compare Variants ({variants.length})
                </span>
                <svg className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-3 pt-0 border-t border-gray-700/50 overflow-x-auto">
                    <table className="w-full text-xs mt-2">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="py-2 px-2 text-left text-gray-500 font-semibold uppercase tracking-wider sticky left-0 bg-gray-900/90">Trait</th>
                                {variants.map((v) => (
                                    <th
                                        key={v.id}
                                        className={`py-2 px-2 text-center text-gray-500 font-semibold uppercase tracking-wider ${v.id === currentId ? 'text-amber-400 bg-amber-900/20' : ''}`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className={v.id === currentId ? 'text-amber-400' : 'text-gray-400'}>{v.name}</span>
                                            {v.id === currentId && <span className="text-[9px] text-amber-500">(viewing)</span>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Speed Row */}
                            <tr className="border-b border-gray-800">
                                <td className="py-2 px-2 font-medium text-gray-300 sticky left-0 bg-gray-900/90">Speed</td>
                                {variants.map((v) => (
                                    <td
                                        key={v.id}
                                        className={`py-2 px-2 text-center text-gray-400 ${v.id === currentId ? 'bg-amber-900/10' : ''}`}
                                    >
                                        {v.speed ?? 30} ft.
                                    </td>
                                ))}
                            </tr>
                            {/* Darkvision Row */}
                            <tr className="border-b border-gray-800">
                                <td className="py-2 px-2 font-medium text-gray-300 sticky left-0 bg-gray-900/90">Darkvision</td>
                                {variants.map((v) => (
                                    <td
                                        key={v.id}
                                        className={`py-2 px-2 text-center text-gray-400 ${v.id === currentId ? 'bg-amber-900/10' : ''}`}
                                    >
                                        {v.darkvision ?? 0} ft.
                                    </td>
                                ))}
                            </tr>
                            {/* Key Traits Rows */}
                            {allKeyTraits.map((trait, idx) => (
                                <tr key={trait} className={`border-b border-gray-800 ${idx === allKeyTraits.length - 1 ? 'last:border-0' : ''}`}>
                                    <td className="py-2 px-2 font-medium text-gray-300 sticky left-0 bg-gray-900/90">{trait}</td>
                                    {variants.map((v) => (
                                        <td
                                            key={v.id}
                                            className={`py-2 px-2 text-center text-gray-400 ${v.id === currentId ? 'bg-amber-900/10' : ''}`}
                                        >
                                            {v.keyTraits.includes(trait) ? (
                                                <span className="text-emerald-400">✓</span>
                                            ) : (
                                                <span className="text-gray-600">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';

export interface RacialChoiceData {
    spellAbility?: AbilityScoreName;
}

interface RaceDetailPaneProps {
    race: RaceDetailData;
    onSelect: (raceId: string, choices?: RacialChoiceData) => void;
    selectedSpellAbility?: AbilityScoreName | null;
    onSpellAbilityChange?: (ability: AbilityScoreName) => void;
}


export const RaceDetailPane: React.FC<RaceDetailPaneProps> = ({
    race,
    onSelect,
    selectedSpellAbility = null,
    onSpellAbilityChange
}) => {
    const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
    const [infoSpellId, setInfoSpellId] = useState<string | null>(null);

    // Check if we have male/female images or just a single legacy image
    const hasDualImages = race.maleImage || race.femaleImage;
    const hasLegacyImage = race.image && !hasDualImages;

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                    {/* Images Section */}
                    <div className="flex-shrink-0 mx-auto md:mx-0">
                        {hasDualImages ? (
                            /* Male/Female dual image layout */
                            <div className="flex gap-3">
                                {/* Male Image */}
                                <div className="w-36 md:w-32 lg:w-36">
                                    {race.maleImage ? (
                                        <button
                                            type="button"
                                            className="relative group cursor-zoom-in w-full"
                                            onClick={() => setExpandedImage({ src: resolveImageUrl(race.maleImage)!, alt: `${race.name} male` })}
                                            aria-label={`Expand ${race.name} male image`}
                                        >
                                            <img
                                                src={resolveImageUrl(race.maleImage)}
                                                alt={`${race.name} male`}
                                                className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                                            />
                                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/70 px-2 py-0.5 rounded text-gray-300">Male</span>
                                        </button>
                                    ) : (
                                        <div className="w-full aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600 text-sm">
                                            Male
                                        </div>
                                    )}
                                </div>
                                {/* Female Image */}
                                <div className="w-36 md:w-32 lg:w-36">
                                    {race.femaleImage ? (
                                        <button
                                            type="button"
                                            className="relative group cursor-zoom-in w-full"
                                            onClick={() => setExpandedImage({ src: resolveImageUrl(race.femaleImage)!, alt: `${race.name} female` })}
                                            aria-label={`Expand ${race.name} female image`}
                                        >
                                            <img
                                                src={resolveImageUrl(race.femaleImage)}
                                                alt={`${race.name} female`}
                                                className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                                            />
                                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/70 px-2 py-0.5 rounded text-gray-300">Female</span>
                                        </button>
                                    ) : (
                                        <div className="w-full aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600 text-sm">
                                            Female
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : hasLegacyImage ? (
                            /* Legacy single image layout */
                            <div className="w-48 md:w-40 lg:w-48">
                                <button
                                    type="button"
                                    className="relative group cursor-zoom-in w-full"
                                    onClick={() => setExpandedImage({ src: resolveImageUrl(race.image)!, alt: `${race.name} illustration` })}
                                    aria-label={`Expand ${race.name} image`}
                                >
                                    <img
                                        src={resolveImageUrl(race.image)}
                                        alt={`${race.name} illustration`}
                                        className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                                    />
                                </button>
                            </div>
                        ) : (
                            /* No images placeholder */
                            <div className="w-48 md:w-40 lg:w-48 aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600">
                                No Image
                            </div>
                        )}
                    </div>

                    {/* Title & Description */}
                    <div className="flex-grow">
                        <h2 className="text-3xl font-bold text-amber-400 font-cinzel mb-3 border-b border-gray-700 pb-2">
                            {race.name}
                        </h2>
                        <div className="mt-4">
                            <p className="text-gray-300 text-sm leading-relaxed">{race.description}</p>
                        </div>
                    </div>
                </div>

                {/* Traits List */}
                <div className="space-y-3 flex-grow">
                    <h3 className="text-lg font-cinzel text-sky-400 border-b border-gray-700 pb-1 mb-2">Racial Traits</h3>
                    <TraitsTable
                        traits={[
                            // Add base traits first
                            ...(race.baseTraits.type ? [{ name: 'Creature Type', description: race.baseTraits.type }] : []),
                            ...(race.baseTraits.size ? [{ name: 'Size', description: race.baseTraits.size }] : []),
                            ...(race.baseTraits.speed !== undefined ? [{ name: 'Speed', description: `${race.baseTraits.speed} feet` }] : []),
                            ...(race.baseTraits.darkvision !== undefined && race.baseTraits.darkvision > 0 ? [{ name: 'Darkvision', description: `You can see in dim light within ${race.baseTraits.darkvision} feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.` }] : []),
                            // Then add all other traits
                            ...race.feats
                        ]}
                        onSpellClick={setInfoSpellId}
                    />

                    {race.furtherChoicesNote && (
                        <div className="mt-4 p-3 bg-sky-900/20 border border-sky-700/50 rounded-lg flex gap-3 items-start">
                            <span className="text-sky-400 text-xl">ℹ️</span>
                            <p className="text-sm text-sky-200/80">{race.furtherChoicesNote}</p>
                        </div>
                    )}

                    {/* Racial Spell Ability Choice */}
                    {race.racialSpellChoice && (
                        <div className="mt-4 bg-purple-900/20 border border-purple-700/50 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-purple-700/50">
                                <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    {race.racialSpellChoice.traitName} - Choose Spellcasting Ability
                                </h4>
                            </div>
                            <div className="p-3">
                                <p className="text-xs text-gray-400 mb-3">{race.racialSpellChoice.traitDescription}</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['Intelligence', 'Wisdom', 'Charisma'] as AbilityScoreName[]).map((ability) => (
                                        <button
                                            key={ability}
                                            onClick={() => onSpellAbilityChange?.(ability)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                                selectedSpellAbility === ability
                                                    ? 'bg-purple-600 text-white border-2 border-purple-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-purple-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {ability}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Variant Comparison Table */}
                    {race.siblingVariants && race.siblingVariants.length > 1 && (
                        <VariantComparisonTable variants={race.siblingVariants} currentId={race.id} />
                    )}
                </div>


            </div>

            {/* Modals */}
            {expandedImage && (
                <ImageModal src={expandedImage.src} alt={expandedImage.alt} onClose={() => setExpandedImage(null)} />
            )}
            <SingleGlossaryEntryModal
                isOpen={!!infoSpellId}
                initialTermId={infoSpellId}
                onClose={() => setInfoSpellId(null)}
            />
        </>
    );
};
