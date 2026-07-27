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
/**
 * @file CoinPurseDisplay.tsx
 *
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
import { CoinBreakdown } from '../../utils/coinPurseUtils';
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
export declare const COIN_NAMES: Record<keyof CoinBreakdown, string>;
export declare const CoinBadge: React.FC<CoinBadgeProps>;
/**
 * Displays a gold value as a D&D-style coin purse with discrete denominations.
 * Shows platinum, gold, silver, and copper pieces with icons.
 */
declare const CoinPurseDisplay: React.FC<CoinPurseDisplayProps>;
export default CoinPurseDisplay;
