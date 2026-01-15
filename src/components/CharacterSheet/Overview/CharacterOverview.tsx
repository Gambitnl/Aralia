import React, { useState } from 'react';
import { PlayerCharacter, AbilityScoreName } from '../../../types';
import Tooltip from '../../ui/Tooltip';
import { getAbilityModifierValue, getAbilityModifierString, getCharacterRaceDisplayString } from '../../../utils/characterUtils';
import { calculatePassiveScore } from '../../../utils/statUtils';
import { FEATS_DATA } from '../../../data/feats/featsData';
import { useCharacterProficiencies } from '../../../hooks/useCharacterProficiencies';

interface CharacterOverviewProps {
    character: PlayerCharacter;
}

/** Collapsible section wrapper */
interface CollapsibleSectionProps {
    title: string;
    icon: string;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
    accentColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon,
    children,
    defaultCollapsed = false,
    accentColor = 'text-sky-300'
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    return (
        <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex items-center justify-between text-left"
            >
                <h4 className={`text-lg font-semibold ${accentColor} flex items-center gap-2`}>
                    <span className="text-sm">{icon}</span> {title}
                </h4>
                <span className="text-gray-400 text-sm transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                    ▼
                </span>
            </button>
            {!isCollapsed && <div className="mt-2">{children}</div>}
        </div>
    );
};

/** Builds a tooltip explaining the AC calculation */
const buildAcTooltip = (character: PlayerCharacter, dexMod: number): React.ReactNode => {
    const armor = character.equippedItems.Torso;
    const shield = character.equippedItems.OffHand;
    const lines: string[] = [];
    const foregone: string[] = [];

    // Base AC
    if (armor && armor.type === 'armor') {
        lines.push(`Base (${armor.name}): ${armor.baseArmorClass || 10}`);

        // Dex modifier with cap
        if (armor.addsDexterityModifier) {
            if (armor.maxDexterityBonus !== undefined && armor.maxDexterityBonus < dexMod) {
                const capped = armor.maxDexterityBonus;
                lines.push(`Dex Mod: +${capped} (capped, full: +${dexMod})`);
            } else {
                lines.push(`Dex Mod: +${dexMod}`);
            }
        } else {
            lines.push(`Dex Mod: +0 (heavy armor)`);
            if (dexMod > 0) {
                foregone.push(`Dex +${dexMod} (not applied to heavy armor)`);
            }
        }

        // Check for foregone unarmored defense
        if (character.class.id === 'barbarian') {
            const conMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);
            foregone.push(`Unarmored Defense: +${conMod} Con (wearing armor)`);
        } else if (character.class.id === 'monk') {
            const wisMod = getAbilityModifierValue(character.finalAbilityScores.Wisdom);
            foregone.push(`Unarmored Defense: +${wisMod} Wis (wearing armor)`);
        }
    } else {
        // Unarmored
        lines.push(`Base: 10`);
        lines.push(`Dex Mod: +${dexMod}`);

        if (character.class.id === 'barbarian') {
            const conMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);
            lines.push(`Unarmored Defense (Con): +${conMod}`);
        } else if (character.class.id === 'monk' && !shield) {
            const wisMod = getAbilityModifierValue(character.finalAbilityScores.Wisdom);
            lines.push(`Unarmored Defense (Wis): +${wisMod}`);
        }
    }

    // Shield
    if (shield && shield.type === 'armor' && shield.armorCategory === 'Shield' && shield.armorClassBonus) {
        lines.push(`Shield: +${shield.armorClassBonus}`);
    }

    return (
        <div className="text-left">
            {lines.map((line, i) => (
                <div key={i}>{line}</div>
            ))}
            <div className="border-t border-gray-500 my-1" />
            <div className="font-bold">Total: {character.armorClass}</div>
            {foregone.length > 0 && (
                <>
                    <div className="mt-2 text-amber-300 text-xs">⚠ Not Applied:</div>
                    {foregone.map((f, i) => (
                        <div key={i} className="text-gray-400 text-xs pl-2">• {f}</div>
                    ))}
                </>
            )}
        </div>
    );
};

const SAVING_THROW_ABILITIES: AbilityScoreName[] = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

const CharacterOverview: React.FC<CharacterOverviewProps> = ({ character }) => {
    const proficiencies = useCharacterProficiencies(character);
    const profBonus = character.proficiencyBonus || 2;

    // Passive scores
    const wisdomMod = getAbilityModifierValue(character.finalAbilityScores.Wisdom);
    const intelligenceMod = getAbilityModifierValue(character.finalAbilityScores.Intelligence);
    const hasPerception = character.skills.some(s => s.id === 'perception');
    const hasInsight = character.skills.some(s => s.id === 'insight');
    const hasInvestigation = character.skills.some(s => s.id === 'investigation');
    const passivePerception = calculatePassiveScore(wisdomMod, hasPerception ? profBonus : 0);
    const passiveInsight = calculatePassiveScore(wisdomMod, hasInsight ? profBonus : 0);
    const passiveInvestigation = calculatePassiveScore(intelligenceMod, hasInvestigation ? profBonus : 0);

    // Dex mod for AC calculation
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity);

    // Spellcasting
    const spellcastingAbilityName = character.spellcastingAbility
        ? (character.spellcastingAbility.charAt(0).toUpperCase() + character.spellcastingAbility.slice(1)) as AbilityScoreName
        : null;
    const spellcastingScore = spellcastingAbilityName ? (character.finalAbilityScores[spellcastingAbilityName] as number) : 0;
    const spellcastingModifier = getAbilityModifierValue(spellcastingScore);
    const spellSaveDc = 8 + profBonus + spellcastingModifier;
    const spellAttackModifier = profBonus + spellcastingModifier;
    const spellAttackModifierString = spellAttackModifier >= 0 ? `+${spellAttackModifier}` : `${spellAttackModifier}`;

    // Saving throw proficiencies (from class)
    const savingThrowProfs = character.class.savingThrowProficiencies || [];

    // Has spell slots?
    const hasSpellSlots = character.spellSlots && Object.values(character.spellSlots).some(vial => vial.max > 0);

    return (
        <div className="grid grid-cols-1 gap-y-4 h-full overflow-hidden">
            <div className="space-y-3 overflow-y-auto scrollable-content p-1 pr-2 h-full">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-lg text-sky-300">{getCharacterRaceDisplayString(character)} {character.class.name}</p>
                        <p className="text-xs text-gray-400">Age: {character.age} | Background: {character.background?.replace(/_/g, ' ') || 'None'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Level {character.level}</p>
                        <p className="text-xs text-amber-200/70">XP: {character.xp || 0}</p>
                    </div>
                </div>

                {/* 1. Vitals (always expanded) */}
                <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                    <h4 className="text-lg font-semibold text-sky-300 mb-1.5 flex items-center gap-2">
                        <span className="text-sm">❤️</span> Vitals
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <p className="text-sm">Hit Points: <span className="font-semibold text-green-400">{character.hp}</span> / {character.maxHp}</p>
                        <Tooltip content={buildAcTooltip(character, dexMod)}>
                            <p className="text-sm cursor-help border-b border-dotted border-blue-400/50">
                                Armor Class: <span className="font-semibold text-blue-400">{character.armorClass}</span>
                            </p>
                        </Tooltip>
                        <p className="text-sm">Speed: <span className="font-semibold">{character.speed}ft</span></p>
                        <p className="text-sm">Prof. Bonus: <span className="font-semibold text-amber-300">+{profBonus}</span></p>
                        {character.darkvisionRange > 0 && <p className="text-sm col-span-2">Darkvision: {character.darkvisionRange}ft</p>}
                    </div>
                </div>

                {/* 2. Ability Scores (always expanded) */}
                <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                    <h4 className="text-lg font-semibold text-sky-300 mb-1.5 flex items-center gap-2">
                        <span className="text-sm">🎲</span> Ability Scores
                    </h4>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
                        {Object.entries(character.finalAbilityScores).map(([key, value]) => (
                            <p key={key}>{key.substring(0, 3)}: <span className="font-semibold text-amber-300">{value as number}</span> ({getAbilityModifierString(value as number)})</p>
                        ))}
                    </div>
                </div>

                {/* 3. Saving Throws (always expanded) */}
                <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                    <h4 className="text-lg font-semibold text-sky-300 mb-1.5 flex items-center gap-2">
                        <span className="text-sm">🛡️</span> Saving Throws
                    </h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        {SAVING_THROW_ABILITIES.map(ability => {
                            const abilityScore = character.finalAbilityScores[ability] as number;
                            const modifier = getAbilityModifierValue(abilityScore);
                            const isProficient = savingThrowProfs.includes(ability);
                            const totalBonus = modifier + (isProficient ? profBonus : 0);
                            const bonusStr = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;

                            return (
                                <p key={ability} className={isProficient ? 'text-amber-200' : 'text-gray-400'}>
                                    {isProficient && <span className="mr-1">●</span>}
                                    {ability.substring(0, 3)}: <span className="font-semibold">{bonusStr}</span>
                                </p>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Spell Slots (only if character has spellcasting) */}
                {hasSpellSlots && (
                    <div className="p-3 bg-gray-700/50 rounded-md border border-purple-500/20">
                        <h4 className="text-lg font-semibold text-purple-300 mb-1.5 flex items-center gap-2">
                            <span className="text-sm">✨</span> Spell Slots
                        </h4>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            {Object.entries(character.spellSlots || {}).map(([level, slots]) => {
                                if (slots.max === 0) return null;
                                return (
                                    <div key={level} className="text-center">
                                        <p className="text-xs text-gray-400">Level {level}</p>
                                        <p className="font-semibold text-purple-300">{slots.current} / {slots.max}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 5. Spellcasting Stats (if has spellcasting ability) */}
                {character.spellcastingAbility && spellcastingAbilityName && (
                    <div className="p-3 bg-gray-700/50 rounded-md border border-purple-500/20">
                        <h4 className="text-lg font-semibold text-purple-300 mb-1.5 flex items-center gap-2">
                            <span className="text-sm">🔮</span> Spellcasting
                        </h4>
                        <div className="grid grid-cols-3 gap-2 text-sm text-center">
                            <Tooltip content={`Your spellcasting ability is ${spellcastingAbilityName}. Modifier: ${spellcastingModifier >= 0 ? '+' : ''}${spellcastingModifier}`}>
                                <div className="cursor-help">
                                    <p className="text-xs text-gray-400">Ability</p>
                                    <p className="font-semibold text-amber-300">{spellcastingAbilityName.substring(0, 3)} ({spellcastingModifier >= 0 ? '+' : ''}{spellcastingModifier})</p>
                                </div>
                            </Tooltip>
                            <Tooltip content={`Save DC = 8 + Proficiency (+${profBonus}) + ${spellcastingAbilityName.substring(0, 3)} Mod (${spellcastingModifier >= 0 ? '+' : ''}${spellcastingModifier}) = ${spellSaveDc}`}>
                                <div className="cursor-help">
                                    <p className="text-xs text-gray-400">Save DC</p>
                                    <p className="font-semibold text-blue-400">{spellSaveDc}</p>
                                </div>
                            </Tooltip>
                            <Tooltip content={`Spell Attack = Proficiency (+${profBonus}) + ${spellcastingAbilityName.substring(0, 3)} Mod (${spellcastingModifier >= 0 ? '+' : ''}${spellcastingModifier}) = ${spellAttackModifierString}`}>
                                <div className="cursor-help">
                                    <p className="text-xs text-gray-400">Attack</p>
                                    <p className="font-semibold text-green-400">{spellAttackModifierString}</p>
                                </div>
                            </Tooltip>
                        </div>
                    </div>
                )}

                {/* 6. Weapon Masteries (if any) */}
                {character.selectedWeaponMasteries && character.selectedWeaponMasteries.length > 0 && (
                    <div className="p-3 bg-gray-700/50 rounded-md border border-amber-500/30">
                        <h4 className="text-lg font-semibold text-amber-300 mb-1.5 flex items-center gap-2">
                            <span className="text-sm">⚔️</span> Weapon Masteries
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {character.selectedWeaponMasteries.map(mastery => (
                                <span key={mastery} className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-200 capitalize">
                                    {mastery.replace(/_/g, ' ')}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 7. Senses (COLLAPSIBLE, collapsed by default) */}
                <CollapsibleSection title="Senses" icon="👁️" defaultCollapsed={true}>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                        <p>Passive Perception: <span className="font-semibold text-white">{passivePerception}</span></p>
                        <p>Passive Insight: <span className="font-semibold text-white">{passiveInsight}</span></p>
                        <p>Passive Investigation: <span className="font-semibold text-white">{passiveInvestigation}</span></p>
                    </div>
                </CollapsibleSection>

                {/* 8. Features & Traits (COLLAPSIBLE, collapsed by default) */}
                <CollapsibleSection title="Features & Traits" icon="📜" defaultCollapsed={true}>
                    <ul className="space-y-2 text-sm text-gray-300">
                        {character.class.features.map(feature => (
                            <li key={feature.id}>
                                <Tooltip content={feature.description}>
                                    <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">{feature.name}</span>
                                </Tooltip>
                            </li>
                        ))}
                        {character.selectedFightingStyle && (
                            <li key={character.selectedFightingStyle.id}>
                                <Tooltip content={character.selectedFightingStyle.description}>
                                    <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">Fighting Style: {character.selectedFightingStyle.name}</span>
                                </Tooltip>
                            </li>
                        )}
                        {character.selectedDivineOrder && <li><span className="font-medium text-amber-200">Divine Order: {character.selectedDivineOrder}</span></li>}
                        {character.selectedDruidOrder && <li><span className="font-medium text-amber-200">Primal Order: {character.selectedDruidOrder}</span></li>}
                        {character.selectedWarlockPatron && <li><span className="font-medium text-amber-200">Patron: {character.selectedWarlockPatron}</span></li>}
                        {character.feats && character.feats.length > 0 && character.feats.map(featId => {
                            const feat = FEATS_DATA.find(f => f.id === featId);
                            if (!feat) return null;
                            const featChoice = character.featChoices?.[featId];
                            const selectedASI = featChoice?.selectedAbilityScore;
                            let displayText = feat.name;
                            if (selectedASI && feat.benefits?.selectableAbilityScores) {
                                displayText += ` (${selectedASI} +1)`;
                            }
                            return (
                                <li key={featId}>
                                    <Tooltip content={feat.description}>
                                        <span className="font-medium text-emerald-200 cursor-help border-b border-dotted border-emerald-200/50">{displayText}</span>
                                    </Tooltip>
                                </li>
                            );
                        })}
                        {character.race.traits.map((trait, index) => {
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
                </CollapsibleSection>

                {/* 9. Proficiencies (COLLAPSIBLE, collapsed by default) */}
                <CollapsibleSection title="Proficiencies" icon="🛡️" defaultCollapsed={true}>
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
                </CollapsibleSection>


            </div>
        </div>
    );
};

export default CharacterOverview;
