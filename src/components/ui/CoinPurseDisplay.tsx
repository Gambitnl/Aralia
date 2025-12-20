import React from 'react';
import { gpToCoins, COIN_ICONS, COIN_COLORS, CoinBreakdown } from '../../utils/coinPurseUtils';
import Tooltip from './Tooltip';

interface CoinPurseDisplayProps {
    /** Total value in gold pieces (stored as decimal) */
    goldValue: number;
    /** Compact mode for inline price displays */
    compact?: boolean;
    /** Show all denominations even if zero */
    showZeros?: boolean;
}

interface CoinBadgeProps {
    type: keyof CoinBreakdown;
    amount: number;
    compact?: boolean;
}

const COIN_NAMES: Record<keyof CoinBreakdown, string> = {
    pp: 'Platinum',
    gp: 'Gold',
    sp: 'Silver',
    cp: 'Copper',
};

export const CoinBadge: React.FC<CoinBadgeProps> = ({ type, amount, compact = false }) => {
    if (amount === 0) return null;

    return (
        <Tooltip content={`${amount} ${COIN_NAMES[type]} Piece${amount !== 1 ? 's' : ''}`}>
            <div
                className={`flex items-center gap-1 ${compact ? 'px-1' : 'px-2 py-1'} rounded bg-gray-800/80 border border-gray-600/50`}
                tabIndex={0}
                aria-label={`${amount} ${COIN_NAMES[type]} pieces`}
            >
                <span className={compact ? 'text-sm' : 'text-lg'} aria-hidden="true">
                    {COIN_ICONS[type]}
                </span>
                <span className={`font-bold ${COIN_COLORS[type]} ${compact ? 'text-xs' : 'text-sm'}`}>
                    {amount}
                </span>
                <span className={`uppercase tracking-wider text-gray-400 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {type}
                </span>
            </div>
        </Tooltip>
    );
};

/**
 * Displays a gold value as a D&D-style coin purse with discrete denominations.
 * Shows platinum, gold, silver, and copper pieces with icons.
 */
const CoinPurseDisplay: React.FC<CoinPurseDisplayProps> = ({
    goldValue,
    compact = false,
    showZeros = false,
}) => {
    const coins = gpToCoins(goldValue);
    const coinTypes: (keyof CoinBreakdown)[] = ['pp', 'gp', 'sp', 'cp'];

    // Filter to only show non-zero denominations (unless showZeros)
    const visibleCoins = showZeros
        ? coinTypes
        : coinTypes.filter(type => coins[type] > 0);

    // If no coins (value is 0), show just 0 GP
    if (visibleCoins.length === 0) {
        return (
            <div className="flex items-center gap-1">
                <CoinBadge type="gp" amount={0} compact={compact} />
            </div>
        );
    }

    return (
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
            {visibleCoins.map(type => (
                <CoinBadge key={type} type={type} amount={coins[type]} compact={compact} />
            ))}
        </div>
    );
};

export default CoinPurseDisplay;
