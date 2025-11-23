/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React from 'react';
import { Ability } from '../../types/combat';
import Tooltip from '../Tooltip';

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

    let tooltipContent = `${ability.name}`;
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

    return (
        <Tooltip content={<pre className="text-xs whitespace-pre-wrap">{tooltipContent.trim()}</pre>}>
            <button
                onClick={onSelect}
                disabled={isDisabled}
                className={`relative w-16 h-16 rounded-lg flex flex-col items-center justify-center p-1 text-white border-2 transition-all
                    ${isDisabled ? 'bg-gray-600/50 border-gray-500 cursor-not-allowed opacity-60' : 'bg-sky-700 hover:bg-sky-600 border-sky-500 cursor-pointer'}
                `}
            >
                <span className="text-2xl flex-grow flex items-center">{ability.icon || '✨'}</span>
                
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
