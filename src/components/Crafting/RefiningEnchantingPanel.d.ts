/**
 * @file src/components/Crafting/RefiningEnchantingPanel.tsx
 * Dedicated crafting panel for Refining and Enchanting (crafting G5).
 *
 * Refining: batch-process raw materials into refined components via
 * processRefiningBatch (skill roll drives success, quality, and bonus yield).
 * Enchanting: bind magic into a base item via attemptEnchant (essences always
 * burn; critical failure destroys the base item).
 *
 * The panel reads the live party inventory, rolls with a real party member
 * (crafterAdapter), and applies results through the normal reducer actions
 * (REMOVE_ITEM / ADD_ITEM / ADVANCE_TIME) — no shadow inventory.
 */
import React from 'react';
interface RefiningEnchantingPanelProps {
    onClose?: () => void;
}
export declare const RefiningEnchantingPanel: React.FC<RefiningEnchantingPanelProps>;
export default RefiningEnchantingPanel;
