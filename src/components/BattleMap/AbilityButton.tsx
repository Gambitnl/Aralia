/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React, { useMemo } from 'react';
import { Ability } from '../../types/combat';
import Tooltip from '../Tooltip';
import { getSpellVisual } from '../../utils/visuals/spellVisuals';

interface AbilityButtonProps {
    ability: Ability;
    onSelect: () => void;
    isDisabled: boolean;
}

const AbilityButton: React.FC<AbilityButtonProps> = ({ ability, onSelect, isDisabled }) => {
    const isOnCooldown = (ability.currentCooldown || 0) > 0;
    const costText = ability.cost.type.charAt(0).toUpperCase() + ability.cost.type.slice(1);

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

    let tooltipContent = `${ability.name}`;
    if (ability.spell) {
        tooltipContent += `\n${ability.spell.school} Cantrip/Spell`;
    }
    tooltipContent += `\n${ability.description}`;
    if (ability.cost.movementCost) {
        tooltipContent += `\nMovement Cost: ${ability.cost.movementCost}`;
    }
    if (ability.cost.spellSlotLevel) {
        tooltipContent += `\nCost: Level ${ability.cost.spellSlotLevel} Spell Slot`;
    }
    if (isOnCooldown) {
        tooltipContent += `\nCooldown: ${ability.currentCooldown} turns`;
    }

    const accessibleLabel = `${visual.label}, ${costText} cost${isOnCooldown ? `, ${ability.currentCooldown} turn cooldown` : ''}`;

    return (
        <Tooltip content={<pre className="text-xs whitespace-pre-wrap">{tooltipContent.trim()}</pre>}>
            <button
                onClick={onSelect}
                disabled={isDisabled}
                aria-label={accessibleLabel}
                aria-disabled={isDisabled}
                style={customStyle}
                className={`relative w-16 h-16 rounded-lg flex flex-col items-center justify-center p-1 text-white border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800
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
            </button>
        </Tooltip>
    );
};

export default AbilityButton;
