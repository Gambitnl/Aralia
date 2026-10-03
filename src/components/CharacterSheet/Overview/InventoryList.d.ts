/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 00:45:56
 * Dependents: components/CharacterSheet/Overview/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file InventoryList.tsx
 * This component displays a list of inventory items with their details and actions.
 * It's used within the CharacterSheetModal.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Removed redundant 'as any' casts
 * when accessing 'rarity' and simplified the 'isContainerItem' type
 * guard by removing unnecessary type assertions, improving type safety
 * and code readability.
 */
import React from 'react';
import { PlayerCharacter, Item, Action, EquipmentSlotType } from '../../../types';
/**
 * This file displays a list of the items carried by a character, including bags and currency.
 *
 * It renders the inventory column on the right side of the character sheet overview.
 * It supports:
 * - Currency breakdown (Coin Pouch) showing physical coin items and liquid gold.
 * - Filtering items by type and equipment slot compatibility.
 * - Storing items inside nested containers (e.g. bags within bags) and calculating weight recursively.
 * - Quick action triggers for equipping, using, or dropping items.
 *
 * Called by: CharacterSheetModal.tsx (Overview tab, column 3)
 * Depends on: utility functions for item equipping and visuals, and the CoinBadge display component.
 */
interface InventoryListProps {
    inventory: Item[];
    gold: number;
    character: PlayerCharacter;
    onAction: (action: Action) => void;
    filterBySlot?: EquipmentSlotType | null;
    onClearFilter?: () => void;
}
declare const InventoryList: React.FC<InventoryListProps>;
export default InventoryList;
