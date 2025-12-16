/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React from 'react';
import { motion } from 'framer-motion';
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

    // ARIA Label Construction
    let ariaLabel = `${ability.name}, ${costText} cost`;
    if (isOnCooldown) {
        ariaLabel += `, on cooldown (${ability.currentCooldown} turns remaining)`;
    }
    if (isDisabled) {
        ariaLabel += ', disabled';
    }

    const handleClick = (e: React.MouseEvent) => {
        if (isDisabled) {
             e.preventDefault();
             return;
        }
        onSelect();
    };

    return (
        <Tooltip content={<pre className="text-xs whitespace-pre-wrap">{tooltipContent.trim()}</pre>}>
            <motion.button
                onClick={handleClick}
                aria-label={ariaLabel}
                aria-disabled={isDisabled}
                // We don't use the native disabled attribute so that the tooltip events can still fire.
                // Screen readers will respect aria-disabled.
                whileTap={!isDisabled ? { scale: 0.95 } : undefined}
                whileHover={!isDisabled ? { scale: 1.05 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={`relative w-16 h-16 rounded-lg flex flex-col items-center justify-center p-1 text-white border-2
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500
                    ${isDisabled ? 'bg-gray-600/50 border-gray-500 cursor-not-allowed opacity-60' : 'bg-sky-700 hover:bg-sky-600 border-sky-500 cursor-pointer'}
                `}
            >
                <span className="text-2xl flex-grow flex items-center" aria-hidden="true">{ability.icon || '✨'}</span>
                
                {/* Cost Badge - hidden from screen readers as it's in the label */}
                <div aria-hidden="true" className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-md ${costBadgeColor}`}>
                    {costText}
                </div>

                {isOnCooldown && (
                    <div aria-hidden="true" className="absolute inset-0 bg-black/70 flex items-center justify-center text-amber-400 font-bold text-lg rounded-md">
                        {ability.currentCooldown}
                    </div>
                )}
            </motion.button>
        </Tooltip>
    );
};

export default AbilityButton;
