// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:04
 * Dependents: CharacterCreator.tsx, RaceSelection.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file RaceDetailPane.tsx
 * Detailed view of a selected race, designed for the right pane of the Split Config layout.
 */
import React, { useState } from 'react';
import ImageModal from '../../ImageModal';
import SingleGlossaryEntryModal from '../../Glossary/SingleGlossaryEntryModal';
import { GlossarySpellsOfTheMarkTable } from '../../Glossary/GlossarySpellsOfTheMarkTable';
import { GlossaryIcon } from '../../Glossary/IconRegistry';
import { CharacterCreatorTraitsTable } from '../shared/CharacterCreatorTraitsTable';
import { BTN_PRIMARY } from '../../../styles/buttonStyles';
import { SKILLS_DATA } from '../../../data/skills';
import { getTraitIcon } from '../../../utils/traits/traitIcons';

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
        traitDescriptions: Record<string, string>;
    }>;
    /** Racial spell choice configuration (if race requires spellcasting ability selection) */
    racialSpellChoice?: {
        traitName: string;
        traitDescription: string;
        source?: 'parser' | 'legacy';
    };
    spellsOfTheMark?: { minLevel: number; spells: string[] }[];
    modernizationStatus?: 'official_2024' | 'modified_legacy';
}



// Collapsible comparison table for race variants (transposed: traits as rows, variants as columns)
const VariantComparisonTable: React.FC<{ variants: NonNullable<RaceDetailData['siblingVariants']>; currentId: string }> = ({ variants, currentId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredTrait, setHoveredTrait] = useState<string | null>(null);
    const [pinnedTrait, setPinnedTrait] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

    if (variants.length < 2) return null;

    // Collect all unique key traits across all variants
    const allKeyTraits = Array.from(
        new Set(variants.flatMap(v => v.keyTraits))
    );

    const viewingVariant = variants.find((v) => v.id === currentId) ?? variants[0];
    const activeTrait = pinnedTrait ?? hoveredTrait;
    const activeTraitDescription = activeTrait ? (viewingVariant.traitDescriptions[activeTrait] ?? '') : '';

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
                                    <td className="py-2 px-2 font-medium text-gray-300 sticky left-0 bg-gray-900/90">
                                        <button
                                            type="button"
                                            className="flex items-center gap-2 text-left hover:text-sky-200"
                                            onMouseEnter={(e) => {
                                                setHoveredTrait(trait);
                                                setTooltipPos({ x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseMove={(e) => {
                                                if (!pinnedTrait) setTooltipPos({ x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseLeave={() => {
                                                if (!pinnedTrait) setHoveredTrait(null);
                                            }}
                                            onClick={(e) => {
                                                setTooltipPos({ x: e.clientX, y: e.clientY });
                                                setPinnedTrait((prev) => (prev === trait ? null : trait));
                                                setHoveredTrait(null);
                                            }}
                                            aria-label={`Show details for ${trait}`}
                                        >
                                            <span className="flex-shrink-0 p-0.5 rounded bg-sky-900/30 text-sky-400">
                                                <GlossaryIcon name={getTraitIcon(trait)} className="w-3.5 h-3.5" />
                                            </span>
                                            <span>{trait}</span>
                                        </button>
                                    </td>
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

                    {activeTrait && tooltipPos && activeTraitDescription && (
                        <div
                            className="fixed z-[9999] max-w-sm bg-gray-950 border border-gray-700 rounded-lg shadow-xl p-3 text-xs text-gray-200"
                            style={{
                                left: Math.min(tooltipPos.x + 12, window.innerWidth - 360),
                                top: Math.min(tooltipPos.y + 12, window.innerHeight - 160),
                            }}
                            role="dialog"
                            aria-label={`${activeTrait} details`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-sky-200">{activeTrait}</div>
                                {pinnedTrait === activeTrait && (
                                    <button
                                        type="button"
                                        className="text-gray-400 hover:text-gray-200 px-1"
                                        onClick={() => setPinnedTrait(null)}
                                        aria-label="Close"
                                    >
                                        x
                                    </button>
                                )}
                            </div>
                            <div className="mt-1 text-gray-300 leading-snug">{activeTraitDescription}</div>
                            <div className="mt-2 text-[10px] text-gray-500">Source: {viewingVariant.name}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';

export interface RacialChoiceData {
    spellAbility?: AbilityScoreName;
    /** Elf - Keen Senses (pick 1 of 3) */
    keenSensesSkillId?: string;
    /** Centaur - Natural Affinity (pick 1 of 4) */
    centaurNaturalAffinitySkillId?: string;
    /** Changeling - Instincts (pick 2 of 5) */
    changelingInstinctSkillIds?: string[];
    /** Changeling - Size (Small or Medium) */
    changelingSize?: 'Small' | 'Medium';
    /** Generic skill choices (e.g. Kender, Kenku, Warforged, Half-Elf) */
    genericSkillChoices?: string[];
    /** Generic tool choices (e.g. Autognome, Dwarves, Warforged) */
    genericToolChoices?: string[];
    /** Generic cantrip choices (e.g. Astral Elf, High Elf) */
    genericCantripChoices?: string[];
}

interface RaceDetailPaneProps {
    race: RaceDetailData;
    onSelect: (raceId: string, choices?: RacialChoiceData) => void;
    selectedSpellAbility?: AbilityScoreName | null;
    onSpellAbilityChange?: (ability: AbilityScoreName) => void;
    selectedKeenSensesSkillId?: string | null;
    onKeenSensesSkillChange?: (skillId: string) => void;
    selectedCentaurNaturalAffinitySkillId?: string | null;
    onCentaurNaturalAffinitySkillChange?: (skillId: string) => void;
    selectedChangelingInstinctSkillIds?: Set<string>;
    onChangelingInstinctSkillToggle?: (skillId: string) => void;
    selectedChangelingSize?: 'Small' | 'Medium' | null;
    onChangelingSizeChange?: (size: 'Small' | 'Medium') => void;
    
    // Generic choices
    racialSkillChoices?: string[];
    onRacialSkillChoiceToggle?: (skillId: string, maxChoices: number) => void;
    racialToolChoices?: string[];
    onRacialToolChoiceToggle?: (toolId: string, maxChoices: number) => void;
    racialCantripChoices?: string[];
    onRacialCantripChoiceToggle?: (cantripId: string, maxChoices: number) => void;
}

export const RaceDetailPane: React.FC<RaceDetailPaneProps & { children?: React.ReactNode }> = ({
    race,
    onSelect,
    selectedSpellAbility = null,
    onSpellAbilityChange,
    selectedKeenSensesSkillId = null,
    onKeenSensesSkillChange,
    selectedCentaurNaturalAffinitySkillId = null,
    onCentaurNaturalAffinitySkillChange,
    selectedChangelingInstinctSkillIds = new Set<string>(),
    onChangelingInstinctSkillToggle,
    selectedChangelingSize = null,
    onChangelingSizeChange,
    racialSkillChoices = [],
    onRacialSkillChoiceToggle,
    racialToolChoices = [],
    onRacialToolChoiceToggle,
    racialCantripChoices = [],
    onRacialCantripChoiceToggle,
    children
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
                        <div className="flex items-center gap-3 mb-3 border-b border-gray-700 pb-2">
                            <h2 className="text-3xl font-bold text-amber-400 font-cinzel">
                                {race.name}
                            </h2>
                            {race.modernizationStatus && (
                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${
                                    race.modernizationStatus === 'official_2024'
                                        ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400'
                                        : 'bg-sky-900/40 border-sky-500/50 text-sky-400'
                                }`}>
                                    {race.modernizationStatus === 'official_2024' ? 'Official 2024' : '2024 Modernized'}
                                </span>
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-gray-300 text-sm leading-relaxed">{race.description}</p>
                        </div>
                    </div>
                </div>

                {/* Traits List */}
                <div className="space-y-3 flex-grow">
                    <h3 className="text-lg font-cinzel text-sky-400 border-b border-gray-700 pb-1 mb-2">Racial Traits</h3>
                    <CharacterCreatorTraitsTable
                        baseTraits={race.baseTraits}
                        traits={race.feats}
                        onSpellClick={setInfoSpellId}
                        spellsOfTheMark={race.spellsOfTheMark}
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

                    {/* Elf Keen Senses (required choice) */}
                    {race.id === 'elf' && (
                        <div className="mt-4 bg-amber-900/10 border border-amber-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-amber-700/40">
                                <h4 className="text-sm font-semibold text-amber-300">Keen Senses - Choose a Skill</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick one: Insight, Perception, or Survival.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(['insight', 'perception', 'survival'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = selectedKeenSensesSkillId === skillId;
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onKeenSensesSkillChange?.(skillId)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-amber-600/80 text-white border-amber-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-amber-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Centaur Natural Affinity (required choice) */}
                    {race.id === 'centaur' && (
                        <div className="mt-4 bg-sky-900/10 border border-sky-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-sky-700/40">
                                <h4 className="text-sm font-semibold text-sky-300">Natural Affinity - Choose a Skill</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick one: Animal Handling, Medicine, Nature, or Survival.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(['animal_handling', 'medicine', 'nature', 'survival'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = selectedCentaurNaturalAffinitySkillId === skillId;
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onCentaurNaturalAffinitySkillChange?.(skillId)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-sky-600/80 text-white border-sky-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-sky-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Changeling Instincts (required choice) */}
                    {race.id === 'changeling' && (
                        <div className="mt-4 bg-sky-900/10 border border-sky-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-sky-700/40">
                                <h4 className="text-sm font-semibold text-sky-300">Changeling Instincts - Choose Two Skills</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick two: Deception, Insight, Intimidation, Performance, or Persuasion.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(['deception', 'insight', 'intimidation', 'performance', 'persuasion'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = selectedChangelingInstinctSkillIds.has(skillId);
                                    const isMaxed = selectedChangelingInstinctSkillIds.size >= 2;
                                    const isDisabled = !isSelected && isMaxed;
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onChangelingInstinctSkillToggle?.(skillId)}
                                            disabled={isDisabled}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-sky-600/80 text-white border-sky-400 shadow-lg'
                                                    : isDisabled
                                                        ? 'bg-gray-900/40 text-gray-600 border-gray-900 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-sky-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-400">
                                Selected: {selectedChangelingInstinctSkillIds.size} / 2
                            </div>
                        </div>
                    )}

                    {/* Changeling Size (required choice) */}
                    {race.id === 'changeling' && (
                        <div className="mt-4 bg-emerald-900/10 border border-emerald-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-emerald-700/40">
                                <h4 className="text-sm font-semibold text-emerald-300">Size - Choose Your Size</h4>
                                <p className="text-xs text-gray-400 mt-1">You are Medium or Small. You choose the size when you select this race.</p>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {(['Small', 'Medium'] as const).map((size) => {
                                    const isSelected = selectedChangelingSize === size;
                                    return (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => onChangelingSizeChange?.(size)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-emerald-600/80 text-white border-emerald-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-emerald-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Kender Curiosity (required choice) */}
                    {race.id === 'kender' && (
                        <div className="mt-4 bg-orange-900/10 border border-orange-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-orange-700/40">
                                <h4 className="text-sm font-semibold text-orange-300">Kender Curiosity - Choose a Skill</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick one: Insight, Investigation, or Sleight of Hand.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(['insight', 'investigation', 'sleight_of_hand'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = racialSkillChoices.includes(skillId);
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onRacialSkillChoiceToggle?.(skillId, 1)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-orange-600/80 text-white border-orange-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-orange-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Kenku Recall (required choice) */}
                    {race.id === 'kenku' && (
                        <div className="mt-4 bg-indigo-900/10 border border-indigo-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-indigo-700/40">
                                <h4 className="text-sm font-semibold text-indigo-300">Kenku Recall - Choose Two Skills</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick two: Acrobatics, Deception, History, Investigation, Nature, Perception, Sleight of Hand, Stealth, or Survival.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(['acrobatics', 'deception', 'history', 'investigation', 'nature', 'perception', 'sleight_of_hand', 'stealth', 'survival'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = racialSkillChoices.includes(skillId);
                                    const isMaxed = racialSkillChoices.length >= 2;
                                    const isDisabled = !isSelected && isMaxed;
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onRacialSkillChoiceToggle?.(skillId, 2)}
                                            disabled={isDisabled}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-indigo-600/80 text-white border-indigo-400 shadow-lg'
                                                    : isDisabled
                                                        ? 'bg-gray-900/40 text-gray-600 border-gray-900 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-400">
                                Selected: {racialSkillChoices.length} / 2
                            </div>
                        </div>
                    )}

                    {/* Warforged Specialized Design (required choice) */}
                    {race.id === 'warforged' && (
                        <div className="mt-4 bg-slate-800 border border-slate-600/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-slate-600/40">
                                <h4 className="text-sm font-semibold text-slate-300">Specialized Design - Choose a Skill</h4>
                                <p className="text-xs text-gray-400 mt-1">You gain one skill proficiency of your choice.</p>
                            </div>
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.values(SKILLS_DATA).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => {
                                    const isSelected = racialSkillChoices.includes(skill.id);
                                    return (
                                        <button
                                            key={skill.id}
                                            type="button"
                                            onClick={() => onRacialSkillChoiceToggle?.(skill.id, 1)}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-slate-600/80 text-white border-slate-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-slate-500 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Half-Elf Skill Versatility (required choice) */}
                    {race.id.startsWith('half_elf') && (
                        <div className="mt-4 bg-rose-900/10 border border-rose-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-rose-700/40">
                                <h4 className="text-sm font-semibold text-rose-300">Skill Versatility - Choose Two Skills</h4>
                                <p className="text-xs text-gray-400 mt-1">You gain proficiency in two skills of your choice.</p>
                            </div>
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.values(SKILLS_DATA).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => {
                                    const isSelected = racialSkillChoices.includes(skill.id);
                                    const isMaxed = racialSkillChoices.length >= 2;
                                    const isDisabled = !isSelected && isMaxed;
                                    return (
                                        <button
                                            key={skill.id}
                                            type="button"
                                            onClick={() => onRacialSkillChoiceToggle?.(skill.id, 2)}
                                            disabled={isDisabled}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-rose-600/80 text-white border-rose-400 shadow-lg'
                                                    : isDisabled
                                                        ? 'bg-gray-900/40 text-gray-600 border-gray-900 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-rose-500 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-400">
                                Selected: {racialSkillChoices.length} / 2
                            </div>
                        </div>
                    )}

                    {/* Autognome Specialized Design (required choice) */}
                    {(race.id === 'autognome' || race.id === 'forgeborn_human') && (
                        <div className="mt-4 bg-zinc-900/10 border border-zinc-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-zinc-700/40">
                                <h4 className="text-sm font-semibold text-zinc-300">
                                    {race.id === 'autognome' ? 'Specialized Design' : "Maker's Gift"} - Choose {race.id === 'autognome' ? 'Two Tools' : 'a Tool'}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">
                                    {race.id === 'autognome' 
                                        ? 'You gain proficiency with two tools of your choice.' 
                                        : 'You gain proficiency with one type of artisan\'s tools of your choice.'}
                                </p>
                            </div>
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {([
                                    { id: 'alchemists_supplies', name: 'Alchemist\'s Supplies' },
                                    { id: 'brewers_supplies', name: 'Brewer\'s Supplies' },
                                    { id: 'calligraphers_supplies', name: 'Calligrapher\'s Supplies' },
                                    { id: 'carpenters_tools', name: 'Carpenter\'s Tools' },
                                    { id: 'cartographers_tools', name: 'Cartographer\'s Tools' },
                                    { id: 'cobblers_tools', name: 'Cobbler\'s Tools' },
                                    { id: 'cooks_utensils', name: 'Cook\'s Utensils' },
                                    { id: 'glassblowers_tools', name: 'Glassblower\'s Tools' },
                                    { id: 'jewelers_tools', name: 'Jeweler\'s Tools' },
                                    { id: 'leatherworkers_tools', name: 'Leatherworker\'s Tools' },
                                    { id: 'masons_tools', name: 'Mason\'s Tools' },
                                    { id: 'painters_supplies', name: 'Painter\'s Supplies' },
                                    { id: 'potters_tools', name: 'Potter\'s Tools' },
                                    { id: 'smiths_tools', name: 'Smith\'s Tools' },
                                    { id: 'tinkers_tools', name: 'Tinker\'s Tools' },
                                    { id: 'weavers_tools', name: 'Weaver\'s Tools' },
                                    { id: 'woodcarvers_tools', name: 'Woodcarver\'s Tools' },
                                    { id: 'disguise_kit', name: 'Disguise Kit' },
                                    { id: 'forgery_kit', name: 'Forgery Kit' },
                                    { id: 'herbalism_kit', name: 'Herbalism Kit' },
                                    { id: 'navigators_tools', name: 'Navigator\'s Tools' },
                                    { id: 'poisoners_kit', name: 'Poisoner\'s Kit' },
                                    { id: 'thieves_tools', name: 'Thieves\' Tools' },
                                ]).map((tool) => {
                                    const max = race.id === 'autognome' ? 2 : 1;
                                    const isSelected = racialToolChoices.includes(tool.id);
                                    const isMaxed = racialToolChoices.length >= max;
                                    const isDisabled = !isSelected && isMaxed;
                                    return (
                                        <button
                                            key={tool.id}
                                            type="button"
                                            onClick={() => onRacialToolChoiceToggle?.(tool.id, max)}
                                            disabled={isDisabled}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-zinc-600/80 text-white border-zinc-400 shadow-lg'
                                                    : isDisabled
                                                        ? 'bg-gray-900/40 text-gray-600 border-gray-900 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-zinc-500 hover:bg-gray-700'
                                            }`}
                                        >
                                            {tool.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-400">
                                Selected: {racialToolChoices.length} / {race.id === 'autognome' ? 2 : 1}
                            </div>
                        </div>
                    )}

                    {/* Dwarf Tool Proficiency (required choice) */}
                    {race.id.includes('dwarf') && race.id !== 'dwarf' && (
                        <div className="mt-4 bg-yellow-900/10 border border-yellow-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-yellow-700/40">
                                <h4 className="text-sm font-semibold text-yellow-300">Tool Proficiency - Choose One</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick one: Smith's Tools, Brewer's Supplies, or Mason's Tools.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {([
                                    { id: 'smiths_tools', name: 'Smith\'s Tools' },
                                    { id: 'brewers_supplies', name: 'Brewer\'s Supplies' },
                                    { id: 'masons_tools', name: 'Mason\'s Tools' },
                                ]).map((tool) => {
                                    const isSelected = racialToolChoices.includes(tool.id);
                                    return (
                                        <button
                                            key={tool.id}
                                            type="button"
                                            onClick={() => onRacialToolChoiceToggle?.(tool.id, 1)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-yellow-600/80 text-white border-yellow-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-yellow-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {tool.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Warforged Tool Proficiency (required choice) */}
                    {race.id === 'warforged' && (
                        <div className="mt-4 bg-slate-800 border border-slate-600/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-slate-600/40">
                                <h4 className="text-sm font-semibold text-slate-300">Specialized Design - Choose a Tool</h4>
                                <p className="text-xs text-gray-400 mt-1">You gain one tool proficiency of your choice.</p>
                            </div>
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {([
                                    { id: 'alchemists_supplies', name: 'Alchemist\'s Supplies' },
                                    { id: 'brewers_supplies', name: 'Brewer\'s Supplies' },
                                    { id: 'calligraphers_supplies', name: 'Calligrapher\'s Supplies' },
                                    { id: 'carpenters_tools', name: 'Carpenter\'s Tools' },
                                    { id: 'cartographers_tools', name: 'Cartographer\'s Tools' },
                                    { id: 'cobblers_tools', name: 'Cobbler\'s Tools' },
                                    { id: 'cooks_utensils', name: 'Cook\'s Utensils' },
                                    { id: 'glassblowers_tools', name: 'Glassblower\'s Tools' },
                                    { id: 'jewelers_tools', name: 'Jeweler\'s Tools' },
                                    { id: 'leatherworkers_tools', name: 'Leatherworker\'s Tools' },
                                    { id: 'masons_tools', name: 'Mason\'s Tools' },
                                    { id: 'painters_supplies', name: 'Painter\'s Supplies' },
                                    { id: 'potters_tools', name: 'Potter\'s Tools' },
                                    { id: 'smiths_tools', name: 'Smith\'s Tools' },
                                    { id: 'tinkers_tools', name: 'Tinker\'s Tools' },
                                    { id: 'weavers_tools', name: 'Weaver\'s Tools' },
                                    { id: 'woodcarvers_tools', name: 'Woodcarver\'s Tools' },
                                    { id: 'disguise_kit', name: 'Disguise Kit' },
                                    { id: 'forgery_kit', name: 'Forgery Kit' },
                                    { id: 'herbalism_kit', name: 'Herbalism Kit' },
                                    { id: 'navigators_tools', name: 'Navigator\'s Tools' },
                                    { id: 'poisoners_kit', name: 'Poisoner\'s Kit' },
                                    { id: 'thieves_tools', name: 'Thieves\' Tools' },
                                ]).map((tool) => {
                                    const isSelected = racialToolChoices.includes(tool.id);
                                    return (
                                        <button
                                            key={tool.id}
                                            type="button"
                                            onClick={() => onRacialToolChoiceToggle?.(tool.id, 1)}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-slate-600/80 text-white border-slate-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-slate-500 hover:bg-gray-700'
                                            }`}
                                        >
                                            {tool.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Astral Elf / High Elf / High Half-Elf Cantrip (required choice) */}
                    {(race.id === 'astral_elf' || race.id === 'high_elf' || race.id === 'half_elf_high') && (
                        <div className="mt-4 bg-sky-900/10 border border-sky-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-sky-700/40">
                                <h4 className="text-sm font-semibold text-sky-300">Racial Cantrip - Choose One</h4>
                                <p className="text-xs text-gray-400 mt-1">
                                    {race.id === 'astral_elf' 
                                        ? 'Pick one: Dancing Lights, Light, or Sacred Flame.' 
                                        : 'Pick one cantrip from the Wizard spell list.'}
                                </p>
                            </div>
                            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {(race.id === 'astral_elf' 
                                    ? [
                                        { id: 'dancing-lights', name: 'Dancing Lights' },
                                        { id: 'light', name: 'Light' },
                                        { id: 'sacred-flame', name: 'Sacred Flame' },
                                      ]
                                    : [
                                        { id: 'acid-splash', name: 'Acid Splash' },
                                        { id: 'blade-ward', name: 'Blade Ward' },
                                        { id: 'chill-touch', name: 'Chill Touch' },
                                        { id: 'dancing-lights', name: 'Dancing Lights' },
                                        { id: 'fire-bolt', name: 'Fire Bolt' },
                                        { id: 'friends', name: 'Friends' },
                                        { id: 'light', name: 'Light' },
                                        { id: 'mage-hand', name: 'Mage Hand' },
                                        { id: 'mending', name: 'Mending' },
                                        { id: 'message', name: 'Message' },
                                        { id: 'minor-illusion', name: 'Minor Illusion' },
                                        { id: 'poison-spray', name: 'Poison Spray' },
                                        { id: 'prestidigitation', name: 'Prestidigitation' },
                                        { id: 'ray-of-frost', name: 'Ray of Frost' },
                                        { id: 'shocking-grasp', name: 'Shocking Grasp' },
                                        { id: 'true-strike', name: 'True Strike' },
                                      ]
                                ).map((spell) => {
                                    const isSelected = racialCantripChoices.includes(spell.id);
                                    return (
                                        <button
                                            key={spell.id}
                                            type="button"
                                            onClick={() => onRacialCantripChoiceToggle?.(spell.id, 1)}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-sky-600/80 text-white border-sky-400 shadow-lg'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-sky-500 hover:bg-gray-700'
                                            }`}
                                        >
                                            {spell.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lizardfolk Nature's Intuition (required choice) */}
                    {race.id === 'lizardfolk' && (
                        <div className="mt-4 bg-emerald-900/10 border border-emerald-700/40 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-emerald-700/40">
                                <h4 className="text-sm font-semibold text-emerald-300">Nature's Intuition - Choose Two Skills</h4>
                                <p className="text-xs text-gray-400 mt-1">Pick two: Animal Handling, Medicine, Nature, Perception, Stealth, or Survival.</p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(['animal_handling', 'medicine', 'nature', 'perception', 'stealth', 'survival'] as const).map((skillId) => {
                                    const skill = SKILLS_DATA[skillId];
                                    const isSelected = racialSkillChoices.includes(skillId);
                                    const isMaxed = racialSkillChoices.length >= 2;
                                    const isDisabled = !isSelected && isMaxed;
                                    return (
                                        <button
                                            key={skillId}
                                            type="button"
                                            onClick={() => onRacialSkillChoiceToggle?.(skillId, 2)}
                                            disabled={isDisabled}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                                                isSelected
                                                    ? 'bg-emerald-600/80 text-white border-emerald-400 shadow-lg'
                                                    : isDisabled
                                                        ? 'bg-gray-900/40 text-gray-600 border-gray-900 cursor-not-allowed'
                                                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-emerald-600 hover:bg-gray-700'
                                            }`}
                                        >
                                            {skill?.name ?? skillId}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-400">
                                Selected: {racialSkillChoices.length} / 2
                            </div>
                        </div>
                    )}

                    {/* Variant Comparison Table */}
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
