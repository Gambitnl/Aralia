/**
 * @file PartyMemberCard.tsx
 * A modern, information-dense card component for displaying party member stats.
 * Shows key combat stats (AC, Save DC, Movement, Initiative, Attack Bonuses),
 * HP bar, spell slots for casters, hit dice, and expendable abilities.
 *
 * Design based on concept mockup with charcoal gradient backgrounds and
 * gold/amber accent colors for the D&D fantasy theme.
 */

import React, { useMemo } from 'react';
import { PlayerCharacter, MissingChoice, HitDieSize, Companion, RelationshipLevel } from '../../../types';
import Tooltip from '../../ui/Tooltip';
import { ConditionChips } from '../../ui/PartyConditionChips';
import { GlossaryIcon } from '../../Glossary/IconRegistry';
import { validateCharacterChoices } from '@/utils/character';
import { getAbilityModifierValue, getAbilityModifierString } from '../../../utils/character/statUtils';
import { buildHitPointDicePools } from '../../../utils/character/characterUtils';
import {
    calculateSpellSaveDC,
    calculateAttackBonuses,
    calculateInitiativeModifier,
    formatInitiativeModifier,
    getTotalHitDice,
    getPrimaryHitDieSize
} from '../../../utils/character/partyStatUtils';

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------

interface PartyMemberCardProps {
    /** The character data to display */
    character: PlayerCharacter;
    /** Optional companion data to show relationship/approval status */
    companion?: Companion;
    /** Callback when the "more" button is clicked (opens character sheet) */
    onMoreClick: () => void;
    /** Callback when missing choice warning is clicked */
    onMissingChoiceClick: (char: PlayerCharacter, missing: MissingChoice) => void;
    /**
     * Optional dismiss handler. When provided, renders a "Dismiss" control that
     * calls back with the member's id. Intentionally NOT rendered for the party
     * leader (`player` id) — see {@link PartyMemberCard} guard below.
     */
    onDismiss?: (id: string) => void;
    /** True for the party leader (roster index 0). The leader can never be dismissed. */
    isLeader?: boolean;
}

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

/**
 * A small stat display box showing a label and value.
 * Used for AC, Save DC, Movement, Initiative stats row.
 */
interface StatBoxProps {
    label: string;
    value: string | number;
    /** Optional color for the value (defaults to white) */
    valueColor?: string;
    /** Optional tooltip content */
    tooltip?: React.ReactNode;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, valueColor = 'text-white', tooltip }) => {
    const content = (
        <div className="flex flex-col items-center">
            {/* Label - small uppercase text */}
            <span className="text-gray-400 text-[10px] uppercase tracking-wide">{label}</span>
            {/* Value - bold number */}
            <span className={`${valueColor} font-bold text-sm`}>{value}</span>
        </div>
    );

    if (tooltip) {
        return (
            <Tooltip content={tooltip}>
                <div className="cursor-help">{content}</div>
            </Tooltip>
        );
    }

    return content;
};

/**
 * Attack bonus display with icon.
 * Shows melee, ranged, or spell attack bonus.
 */
interface AttackBonusDisplayProps {
    iconName: string;
    bonus: string;
    label: string;
    color?: string;
}

const AttackBonusDisplay: React.FC<AttackBonusDisplayProps> = ({
    iconName,
    bonus,
    label,
    color = 'text-white'
}) => (
    <Tooltip content={label}>
        <div className="flex items-center gap-1 cursor-help">
            <GlossaryIcon name={iconName} className="w-3.5 h-3.5 text-gray-400" />
            <span className={`${color} font-bold text-xs`}>{bonus}</span>
        </div>
    </Tooltip>
);

/**
 * Maps hit die size to the appropriate dice icon name.
 */
function getHitDieIconName(dieSize: HitDieSize): string {
    const iconMap: Record<HitDieSize, string> = {
        6: 'dice_d6',
        8: 'dice_d8',
        10: 'dice_d10',
        12: 'dice_d12'
    };
    return iconMap[dieSize] || 'dice_d8';
}

/**
 * Spell slot display component showing pips for each spell level.
 * Only shows levels where the character has at least 1 max slot.
 */
interface SpellSlotsDisplayProps {
    spellSlots: PlayerCharacter['spellSlots'];
}

const SpellSlotsDisplay: React.FC<SpellSlotsDisplayProps> = ({ spellSlots }) => {
    if (!spellSlots) return null;

    // Filter to only show levels with slots
    const activeLevels = (['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8', 'level_9'] as const)
        .filter(level => spellSlots[level]?.max > 0);

    if (activeLevels.length === 0) return null;

    // Roman numerals for spell levels
    const romanNumerals: Record<string, string> = {
        'level_1': 'I', 'level_2': 'II', 'level_3': 'III',
        'level_4': 'IV', 'level_5': 'V', 'level_6': 'VI',
        'level_7': 'VII', 'level_8': 'VIII', 'level_9': 'IX'
    };

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-16 font-bold text-purple-400 shrink-0">Slots</span>
            <div className="flex-1 flex gap-2 flex-wrap">
                {activeLevels.map(level => {
                    const slot = spellSlots[level];
                    return (
                        <Tooltip key={level} content={`Level ${level.split('_')[1]}: ${slot.current}/${slot.max}`}>
                            <div className="flex gap-0.5 items-center cursor-help">
                                {/* Level indicator */}
                                <span className="text-[9px] text-purple-500/50 mr-0.5">{romanNumerals[level]}</span>
                                {/* Slot pips */}
                                {Array.from({ length: slot.max }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 w-2 rounded-sm ${i < slot.current
                                            ? 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.4)]'
                                            : 'bg-gray-700'
                                            }`}
                                    />
                                ))}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Expendable abilities display (Ki, Channel Divinity, Wild Shape, etc.)
 * Positioned to the right side of the card.
 */
interface ExpendableAbilitiesProps {
    limitedUses: PlayerCharacter['limitedUses'];
    proficiencyBonus: number;
    finalAbilityScores: PlayerCharacter['finalAbilityScores'];
}

const ExpendableAbilities: React.FC<ExpendableAbilitiesProps> = ({
    limitedUses,
    proficiencyBonus,
    finalAbilityScores
}) => {
    if (!limitedUses || Object.keys(limitedUses).length === 0) return null;

    // Helper to resolve dynamic max values
    const resolveMax = (max: number | string): number => {
        if (typeof max === 'number') return max;

        switch (max) {
            case 'proficiency_bonus':
                return proficiencyBonus;
            case 'charisma_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Charisma ?? 10));
            case 'wisdom_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Wisdom ?? 10));
            case 'intelligence_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Intelligence ?? 10));
            case 'constitution_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Constitution ?? 10));
            case 'strength_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Strength ?? 10));
            case 'dexterity_mod':
                return Math.max(1, getAbilityModifierValue(finalAbilityScores.Dexterity ?? 10));
            default:
                return 1;
        }
    };

    // Get color for different ability types
    const getAbilityColor = (name: string): string => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('ki')) return 'text-cyan-400';
        if (lowerName.includes('channel')) return 'text-amber-400';
        if (lowerName.includes('wild shape')) return 'text-green-400';
        if (lowerName.includes('lay on hands')) return 'text-blue-400';
        if (lowerName.includes('rage')) return 'text-red-400';
        if (lowerName.includes('bardic')) return 'text-pink-400';
        if (lowerName.includes('sorcery') || lowerName.includes('sorcerer')) return 'text-orange-400';
        return 'text-gray-300';
    };

    return (
        <div className="space-y-1">
            {Object.entries(limitedUses).slice(0, 2).map(([key, ability]) => {
                const maxValue = resolveMax(ability.max);
                const color = getAbilityColor(ability.name);

                return (
                    <Tooltip key={key} content={`${ability.name}: ${ability.current}/${maxValue} (resets on ${ability.resetOn.replace('_', ' ')})`}>
                        <div className="flex items-center gap-1 text-[10px] cursor-help">
                            <span className={`${color} font-medium truncate max-w-[60px]`}>
                                {ability.name.split(' ')[0]}
                            </span>
                            <span className="text-gray-400">
                                {ability.current}/{maxValue}
                            </span>
                        </div>
                    </Tooltip>
                );
            })}
        </div>
    );
};

const LEVEL_COLORS: Record<RelationshipLevel, string> = {
    hated: 'text-red-700',
    enemy: 'text-red-500',
    rival: 'text-orange-500',
    distrusted: 'text-orange-300',
    wary: 'text-yellow-300',
    stranger: 'text-gray-400',
    acquaintance: 'text-blue-300',
    friend: 'text-green-400',
    close: 'text-green-300',
    devoted: 'text-yellow-300',
    romance: 'text-pink-400'
};

const getMissingChoiceLabel = (missing: MissingChoice): string => missing.label || missing.type || 'Missing choice';

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const PartyMemberCard: React.FC<PartyMemberCardProps> = ({
    character,
    companion,
    onMoreClick,
    onMissingChoiceClick,
    onDismiss,
    isLeader
}) => {
    // Calculate HP percentage for the health bar
    const healthPercentage = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));

    // Determine HP bar color based on health percentage
    const getHpBarColor = (): string => {
        if (healthPercentage <= 25) return 'bg-red-700';
        if (healthPercentage <= 50) return 'bg-red-600';
        return 'bg-red-500';
    };

    // Check for missing character choices (warnings)
    const missingChoices = useMemo(() => validateCharacterChoices(character), [character]);
    const hasMissingChoices = missingChoices.length > 0;
    const missingChoiceSummary = missingChoices.map(getMissingChoiceLabel).join(', ');

    // Calculate derived stats
    const profBonus = character.proficiencyBonus ?? 2;
    const spellSaveDC = calculateSpellSaveDC(character);
    const attackBonuses = calculateAttackBonuses(character);
    const initiativeMod = calculateInitiativeModifier(character);
    const hitDice = getTotalHitDice(character);
    const primaryHitDie = getPrimaryHitDieSize(character);

    // Get race/class display string
    const raceClassName = `${character.race.name} ${character.class.name}`;

    // Check if character is a caster (has spell slots)
    const hasSpellSlots = character.spellSlots &&
        Object.values(character.spellSlots).some(slot => slot.max > 0);

    // The party leader (the `player` id) cannot be dismissed by the player.
    // Only render a Dismiss control for non-leader members when a handler is wired.
    // The leader can never be dismissed — keyed on roster position (index 0), matching
    // the reducer's party[0] guard, since a save's leader id isn't always the literal 'player'.
    const canDismiss = Boolean(onDismiss) && !isLeader && character.id !== 'player';

    return (
        <div className="group relative flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-gray-800 to-gray-700/50 border border-amber-500/10 hover:border-amber-500/40 transition-all shadow-lg hover:shadow-amber-500/5">
            {/* ============================================================
                LEFT: Portrait and Level Badge
                ============================================================ */}
            <div className="relative shrink-0">
                {/* Portrait placeholder - circular with gradient border */}
                <div
                    className="w-16 h-16 rounded-full bg-gray-700 border-2 border-amber-500/30 shadow-inner flex items-center justify-center"
                    title={`Portrait of ${character.name}`}
                >
                    {/* Placeholder icon - first letter of name */}
                    <span className="text-2xl font-bold text-gray-400">
                        {character.name.charAt(0).toUpperCase()}
                    </span>
                </div>

                {/* Level badge - bottom right of portrait */}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center border-2 border-gray-800 text-gray-900 font-bold text-xs shadow-md">
                    {character.level ?? 1}
                </div>

                {/* Missing choice warning - top right of portrait */}
                {hasMissingChoices && (
                    <Tooltip content={`Missing Selection${missingChoices.length > 1 ? 's' : ''}: ${missingChoiceSummary}. Click to fix the first one.`}>
                        <button
                             onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 onMissingChoiceClick(character, missingChoices[0]);
                             }}
                             className="absolute -right-3 -top-3 flex h-11 w-11 items-start justify-end rounded-full text-red-200 transition-transform hover:scale-105"
                             aria-label="Fix missing character selection"
                        >
                            {/* The button target is finger-sized, but the red badge stays visually compact on the portrait. */}
                            <span className="mr-2 mt-2 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/50 bg-red-900/90 text-[10px] shadow-md animate-pulse">
                                {missingChoices.length > 1 ? missingChoices.length : '!'}
                            </span>
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* ============================================================
                CENTER: Main Content Area
                ============================================================ */}
            <div className="flex-1 w-full flex flex-col gap-2">
                {/* Row 1: Name, Race/Class, and Stats */}
                <div className="flex justify-between items-start gap-2">
                    {/* Name and Race/Class */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white leading-none truncate">
                                {character.name}
                            </h3>
                            {character.heroicInspiration && (
                                <Tooltip content="Heroic Inspiration (Advantage on a d20 Test)">
                                    <div className="flex items-center justify-center text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" title="Heroic Inspiration">
                                        <span className="text-sm">✦</span>
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                        <span className="text-xs font-medium text-amber-500/80 uppercase tracking-wider block">
                            {raceClassName}
                        </span>
                        {/* PRV6: active status conditions (starving / fatigued / poisoned
                            from travel) — invisible in state before this surface. */}
                        {(character.conditions?.length ?? 0) > 0 && (
                            <div className="mt-1">
                                <ConditionChips conditions={character.conditions ?? []} size="sm" />
                            </div>
                        )}
                        {companion && (
                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                <span className="text-gray-400">Relationship:</span>
                                <span className={`${LEVEL_COLORS[companion.relationships['player']?.level || 'stranger'] || 'text-gray-400'} font-bold uppercase tracking-wider`}>
                                    {companion.relationships['player']?.level || 'stranger'}
                                </span>
                                <span className="text-gray-400 font-mono">
                                    ({(companion.relationships['player']?.approval ?? 0) >= 0 ? `+${companion.relationships['player']?.approval ?? 0}` : companion.relationships['player']?.approval})
                                </span>
                            </div>
                        )}
                        {hasMissingChoices && (
                            <div
                                className="mt-2 flex flex-wrap gap-1.5"
                                aria-label="Missing character choices"
                            >
                                {missingChoices.map((missing) => {
                                    const label = getMissingChoiceLabel(missing);

                                    return (
                                        <Tooltip
                                            key={`${missing.type}-${label}`}
                                            content={`Missing Selection: ${label}. Click to fix.`}
                                        >
                                            {/* Each warning chip is a direct repair action, so keep the target touch-sized even when the chip text stays compact. */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onMissingChoiceClick(character, missing);
                                                }}
                                                className="inline-flex min-h-11 max-w-full items-center gap-1 rounded border border-red-500/40 bg-red-950/70 px-3 py-2 text-[11px] font-semibold text-red-100 hover:border-red-300 hover:bg-red-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                                                aria-label={`Fix ${label}`}
                                            >
                                                <span aria-hidden="true">!</span>
                                                <span className="truncate">{label}</span>
                                            </button>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Stats Row: AC, Save DC, Movement, Initiative */}
                    <div className="flex gap-3 text-xs text-gray-400 font-mono shrink-0">
                        <StatBox
                            label="AC"
                            value={character.armorClass}
                            tooltip={`Armor Class: ${character.armorClass}`}
                        />
                        {spellSaveDC !== null && character.spellcastingAbility && (
                            <StatBox
                                label="DC"
                                value={spellSaveDC}
                                tooltip={`Spell Save DC: 8 + ${profBonus} (prof) + ${getAbilityModifierString(
                                    (character.finalAbilityScores[
                                        (character.spellcastingAbility.charAt(0).toUpperCase() + character.spellcastingAbility.slice(1)) as keyof typeof character.finalAbilityScores
                                    ] as number) ?? 10
                                )} (${character.spellcastingAbility.substring(0, 3)})`}
                            />
                        )}
                        <StatBox
                            label="Move"
                            value={`${character.speed}ft`}
                            tooltip={`Movement Speed: ${character.speed} feet per round`}
                        />
                        <StatBox
                            label="Init"
                            value={formatInitiativeModifier(initiativeMod)}
                            valueColor={initiativeMod >= 3 ? 'text-amber-400' : 'text-white'}
                            tooltip={`Initiative Modifier: ${formatInitiativeModifier(initiativeMod)}`}
                        />
                    </div>
                </div>

                {/* Row 2: Attack Bonuses */}
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400 uppercase">Attack</span>
                    {attackBonuses.melee && (
                        <AttackBonusDisplay
                            iconName={attackBonuses.melee.iconName}
                            bonus={attackBonuses.melee.bonusString}
                            label={`Melee: ${attackBonuses.melee.bonusString} (${attackBonuses.melee.source})`}
                        />
                    )}
                    {attackBonuses.ranged && (
                        <AttackBonusDisplay
                            iconName={attackBonuses.ranged.iconName}
                            bonus={attackBonuses.ranged.bonusString}
                            label={`Ranged: ${attackBonuses.ranged.bonusString} (${attackBonuses.ranged.source})`}
                        />
                    )}
                    {attackBonuses.spell && (
                        <AttackBonusDisplay
                            iconName={attackBonuses.spell.iconName}
                            bonus={attackBonuses.spell.bonusString}
                            label={`Spell Attack: ${attackBonuses.spell.bonusString}`}
                            color="text-purple-300"
                        />
                    )}
                </div>

                {/* Row 3: HP Bar with Hit Dice */}
                <div className="flex items-center gap-3">
                    {/* HP Label */}
                    <span className={`w-16 font-bold text-xs shrink-0 ${healthPercentage <= 50 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                        HP
                    </span>

                    {/* HP Bar */}
                    <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${getHpBarColor()} transition-all duration-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]`}
                            style={{ width: `${healthPercentage}%` }}
                        />
                    </div>

                    {/* HP Numbers */}
                    <span className={`w-16 text-right font-mono text-xs ${healthPercentage <= 50 ? 'text-red-400' : 'text-white'
                        }`}>
                        {character.hp}/{character.maxHp}
                    </span>

                    {/* Hit Dice indicator */}
                    <Tooltip content={`Hit Dice: ${hitDice.current}/${hitDice.max} available for short rest healing`}>
                        <div className="flex items-center gap-1 cursor-help">
                            <GlossaryIcon
                                name={getHitDieIconName(primaryHitDie)}
                                className="w-4 h-4 text-amber-400/70"
                            />
                            <span className="text-[10px] text-gray-400 font-mono">
                                {hitDice.current}
                            </span>
                        </div>
                    </Tooltip>
                </div>

                {/* Row 4: Spell Slots (for casters) */}
                {hasSpellSlots && (
                    <SpellSlotsDisplay spellSlots={character.spellSlots} />
                )}
            </div>

            {/* ============================================================
                RIGHT: Expendable Abilities and More Button
                ============================================================ */}
            <div className="flex flex-col items-end gap-2 shrink-0 md:border-l md:border-white/5 md:pl-3">
                {/* Expendable abilities */}
                <ExpendableAbilities
                    limitedUses={character.limitedUses}
                    proficiencyBonus={profBonus}
                    finalAbilityScores={character.finalAbilityScores}
                />

                {/* More button - opens character sheet */}
                <Tooltip content="View Character Sheet">
                    <button
                        onClick={onMoreClick}
                        className="flex h-11 w-11 items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-amber-400 transition-colors"
                        aria-label={`More options for ${character.name}`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-5 h-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                </Tooltip>

                {/* Dismiss control - never shown for the party leader (`player`) */}
                {canDismiss && (
                    <Tooltip content={`Dismiss ${character.name} from the party`}>
                        {/* Dismiss is rare but destructive; keep the control deliberate and easy to hit. */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDismiss?.(character.id);
                            }}
                            className="inline-flex min-h-11 items-center gap-1 rounded border border-red-500/40 bg-red-950/70 px-3 py-2 text-[11px] font-semibold text-red-100 hover:border-red-300 hover:bg-red-900/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                            aria-label={`Dismiss ${character.name} from the party`}
                        >
                            Dismiss
                        </button>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default PartyMemberCard;
