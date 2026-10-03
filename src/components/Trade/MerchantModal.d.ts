/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:22:06
 * Dependents: components/Trade/index.ts, components/layout/GameModals.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file MerchantModal.tsx
 * A modal interface for trading items with a merchant.
 * Supports buying items with gold and selling items for half value (or dynamic value).
 * Now includes Tavern Gossip support!
 */
import React from 'react';
import { Item, Action, EconomyState } from '../../types';
interface MerchantModalProps {
    isOpen: boolean;
    merchantName: string;
    merchantInventory: Item[];
    playerInventory: Item[];
    playerGold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
    economy?: EconomyState;
    regionId?: string;
}
declare const MerchantModal: React.FC<MerchantModalProps>;
export default MerchantModal;
