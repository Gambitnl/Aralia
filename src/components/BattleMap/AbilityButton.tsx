/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Ability } from '../../types/combat';
import Tooltip from '../Tooltip';
import { getSpellVisual } from '../../utils/visuals/spellVisuals';

interface AbilityButtonProps {
    ability: Ability;
    onSelect: () => void;
    isDisabled: boolean;
}

// Combat ability ranges are stored in grid tiles. The tooltip also shows the
// D&D-style feet equivalent so melee restrictions are visible before targeting.
const formatAbilityRange = (range: number): string => {
    if (range === 0) return 'Self';
    const tileLabel = range === 1 ? 'tile' : 'tiles';
    return `${range} ${tileLabel} (${range * 5} ft)`;
};

const AbilityButton: React.FC<AbilityButtonProps> = ({ ability, onSelect, isDisabled }) => {
    const shouldReduceMotion = useReducedMotion();
    const isOnCooldown = (ability.currentCooldown || 0) > 0;
    const costText = ability.cost.type.charAt(0).toUpperCase() + ability.cost.type.slice(1);
    const rangeText = formatAbilityRange(ability.range);

    const costColors: Record<string, string> = {
        action: 'bg-red-600',
        bonus: 'bg-yellow-600',
        reaction: 'bg-blue-600',
        free: 'bg-green-600',
        'movement-only': 'bg-teal-600',
    };
    
    const costBadgeColor = costColors[ability.cost.type] || 'bg-gray-500';

    // Resolve visuals: Prefer ability.icon, then spell-based visual, then default fallback.
    const visual = useMemo(() => {
        if (ability.icon) {
            return {
                fallbackContent: ability.icon,
                primaryColor: 'transparent', // Let button background handle it
                label: ability.name
            };
        }
        if (ability.spell) {
            return getSpellVisual(ability.spell);
        }
        return {
            fallbackContent: '✨',
            primaryColor: 'transparent',
            label: ability.name
        };
    }, [ability]);

    // Apply primary color from visual spec if it's not transparent/default, to give hint of school.
    // Do not override border color if disabled, to ensure the gray disabled state is visible.
    const customStyle = (!isDisabled && visual.primaryColor !== 'transparent')
        ? { borderColor: visual.primaryColor }
        : {};

    const tooltipContent = (
        <div className="space-y-1">
            <div className="font-bold text-amber-300 border-b border-gray-600 pb-1 mb-1">{ability.name}</div>
            {ability.spell && (
                <div className="text-[10px] text-sky-300 italic mb-1">
                    {ability.spell.school} {ability.spell.level === 0 ? 'Cantrip' : `Level ${ability.spell.level} Spell`}
                </div>
            )}
            <div className="text-gray-200 leading-tight">{ability.description}</div>
            <div className="pt-1 mt-1 border-t border-gray-700/50 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400">Range:</span>
                    <span className="text-amber-200 font-medium">{rangeText}</span>
                </div>
                {ability.cost.movementCost ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Movement:</span>
                        <span className="text-teal-300 font-medium">{ability.cost.movementCost} ft</span>
                    </div>
                ) : null}
                {ability.cost.spellSlotLevel ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Slot:</span>
                        <span className="text-sky-300 font-medium">Level {ability.cost.spellSlotLevel}</span>
                    </div>
                ) : null}
                {isOnCooldown && (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Cooldown:</span>
                        <span className="text-red-400 font-medium">{ability.currentCooldown} turns</span>
                    </div>
                ) : null}
            </div>
        </div>
    );

    const accessibleLabel = `${visual.label}, ${costText} cost, range ${rangeText}${isOnCooldown ? `, ${ability.currentCooldown} turn cooldown` : ''}`;

    return (
        <Tooltip content={tooltipContent}>
            <motion.button
                onClick={onSelect}
                disabled={isDisabled}
                aria-label={accessibleLabel}
                aria-disabled={isDisabled}
                style={customStyle}
                whileHover={isDisabled ? undefined : { scale: shouldReduceMotion ? 1 : 1.05 }}
                whileTap={isDisabled ? undefined : { scale: shouldReduceMotion ? 1 : 0.95 }}
                transition={{ duration: 0.1 }}
                className={`relative w-16 h-16 rounded-lg flex flex-col items-center justify-center p-1 text-white border-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800
                    ${isDisabled ? 'bg-gray-600/50 border-gray-500 cursor-not-allowed opacity-60' : 'bg-sky-700 hover:bg-sky-600 border-sky-500 cursor-pointer'}
                `}
            >
                <span className="text-2xl flex-grow flex items-center drop-shadow-md">
                    {visual.src ? (
                        <img src={visual.src} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                        visual.fallbackContent
                    )}
                </span>
                
                {/* Cost Badge */}
                <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-md ${costBadgeColor}`}>
                    {costText}
                </div>

                {isOnCooldown && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-amber-400 font-bold text-lg rounded-md">
                        {ability.currentCooldown}
                    </div>
                )}
            </motion.button>
        </Tooltip>
    );
};

export default AbilityButton;
