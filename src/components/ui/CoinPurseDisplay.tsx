// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/06/2026, 16:30:45
 * Dependents: components/CharacterSheet/Overview/InventoryList.tsx, components/DesignPreview/steps/PreviewComponents.tsx, components/Economy/LedgerBook.tsx, components/Trade/MerchantModal.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CoinPurseDisplay.tsx
 *
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
import { gpToCoins, COIN_ICONS, COIN_COLORS, CoinBreakdown } from '../../utils/coinPurseUtils';
import Tooltip from '../Tooltip';

interface CoinPurseDisplayProps {
    /** Total value in gold pieces (stored as decimal) */
    goldValue: number;
    /** Compact mode for inline price displays */
    compact?: boolean;
    /** Show all denominations even if zero */
    showZeros?: boolean;
}

export interface CoinBadgeProps {
    type: keyof CoinBreakdown;
    amount: number;
    compact?: boolean;
    showZero?: boolean;
}

export const COIN_NAMES: Record<keyof CoinBreakdown, string> = {
    pp: 'Platinum',
    gp: 'Gold',
    sp: 'Silver',
    cp: 'Copper',
};

export const CoinBadge: React.FC<CoinBadgeProps> = ({ type, amount, compact = false, showZero = false }) => {
    if (amount === 0 && !showZero) return null;

    return (
        <Tooltip content={`${amount} ${COIN_NAMES[type]} Piece${amount !== 1 ? 's' : ''}`}>
            {/* Coin badges expose a tooltip on focus/hover without pretending to be
                clickable controls. Direct zero-value badges still collapse unless
                the owning purse explicitly asks to display zero denominations. */}
            <span
                role="img"
                tabIndex={0}
                className={`flex items-center gap-1 ${compact ? 'px-1' : 'px-2 py-1'} rounded bg-gray-800/80 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-help`}
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
            </span>
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
                <CoinBadge type="gp" amount={0} compact={compact} showZero />
            </div>
        );
    }

    return (
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
            {visibleCoins.map(type => (
                <CoinBadge key={type} type={type} amount={coins[type]} compact={compact} showZero={showZeros} />
            ))}
        </div>
    );
};

export default CoinPurseDisplay;
