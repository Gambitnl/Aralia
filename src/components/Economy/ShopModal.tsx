// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:29
 * Dependents: components/Economy/index.ts, components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { parseCost } from '../../utils/economy/economyUtils';
/**
 * This file renders the Merchant Shop and Trading interface (ShopModal).
 *
 * Players use this modal when interacting with local vendors, traveling peddlers,
 * or general stores across settlements in Aralia.
 *
 * It features:
 * - Browsing merchant stock categorized by weapons, armor, and gear.
 * - Inspecting item details, prices, and stats before buying.
 * - Selling unneeded equipment and junk from the player party's inventory.
 * - Full focus trapping and keyboard shortcuts for accessibility.
 *
 * Called by: GameModals.tsx, PlayingScreen.tsx, or CommerceDesk.tsx
 * Depends on: WindowFrame, MerchantModal, GameContext, formatGpAsCoins
 */

// ============================================================================
// Imports
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
    ArrowDownUp,
    BadgePercent,
    CircleDollarSign,
    Coins,
    Package,
    Shield,
    ShoppingBag,
    ShoppingCart,
    Store,
    Sword,
    Trash2,
    Wallet,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { Item } from '../../types';
import { formatGpAsCoins } from '../../utils/character';

// ============================================================================
// Props & Types
// ============================================================================
export interface ShopModalProps {
    // Controls modal visibility
    isOpen?: boolean;
    // Name of the merchant or store
    shopName?: string;
    // Items available in the merchant's inventory
    inventory?: Item[];
    // Callback when the player closes the shop
    onClose?: () => void;
    // Callback when purchasing an item
    onBuyItem?: (item: Item, cost: number) => void;
    // Callback when selling an item
    onSellItem?: (itemId: string, value: number) => void;
}

type ShopTab = 'buy' | 'sell';

// ============================================================================
// Main Component
// ============================================================================
export const ShopModal: React.FC<ShopModalProps> = ({
    isOpen = true,
    shopName,
    inventory,
    onClose,
    onBuyItem,
    onSellItem,
}) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<ShopTab>('buy');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Resolve effective shop title and stock from props or active merchantModal state
    const resolvedShopName =
        shopName || state.merchantModal?.merchantName || 'General Store & Market';
    const merchantStock = useMemo(() => {
        if (inventory && inventory.length > 0) return inventory;
        return state.merchantModal?.merchantInventory || [];
    }, [inventory, state.merchantModal?.merchantInventory]);

    // Player inventory items that can be sold to the merchant
    const playerSellableItems = useMemo(() => {
        return (state.inventory || []).filter(item => {
            if (!item || !item.id) return false;
            return !item.questHooks;
        });
    }, [state.inventory]);

    if (!isOpen) return null;

    // Helper to calculate numeric gold cost from an item's value or cost string
    const getItemGoldCost = (item: Item): number => {
        if (item.value) return typeof item.value === 'number' ? item.value : parseCost(item.value);
        if (typeof item.cost === 'string') {
            const num = parseFloat(item.cost.split(' ')[0] || '1');
            return Math.max(1, Math.round(num));
        }
        return 1;
    };

    // Helper to calculate sell return value (typically 50% of base item value)
    const getItemSellValue = (item: Item): number => {
        const baseCost = getItemGoldCost(item);
        return Math.max(1, Math.floor(baseCost * 0.5));
    };

    // Handle purchasing an item from the merchant
    const handlePurchase = (item: Item) => {
        const cost = getItemGoldCost(item);
        if ((state.gold || 0) < cost) return;

        if (onBuyItem) {
            onBuyItem(item, cost);
        } else {
            dispatch({
                type: 'BUY_ITEM',
                payload: { item, cost },
            });
        }
    };

    // Handle selling an item to the merchant
    const handleSale = (item: Item) => {
        const value = getItemSellValue(item);

        if (onSellItem) {
            onSellItem(item.id, value);
        } else {
            dispatch({
                type: 'SELL_ITEM',
                payload: { itemId: item.id, value },
            });
        }
    };

    return (
        <WindowFrame
            title={resolvedShopName}
            storageKey={WINDOW_KEYS.SHOP}
            onClose={onClose}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
                {/* Header Banner with Player Gold Balance */}
                <div className="shrink-0 px-6 py-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-amber-400" />
                        <div>
                            <div className="text-sm font-bold text-amber-200">{resolvedShopName}</div>
                            <div className="text-xs text-slate-400">Buy equipment, supplies, and sell unneeded inventory</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 font-bold text-sm">
                        <Wallet className="w-4 h-4 text-amber-400" />
                        <span>Purse: {formatGpAsCoins(state.gold || 0)}</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="shrink-0 px-6 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('buy')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'buy'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Merchant Stock ({merchantStock.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('sell')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'sell'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Sell Items ({playerSellableItems.length})</span>
                    </button>
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 scrollable-content">
                    {/* Buy Tab: Merchant Wares */}
                    {activeTab === 'buy' && (
                        <div className="space-y-3">
                            {merchantStock.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <Store className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">The merchant is currently out of stock.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {merchantStock.map(item => {
                                        const cost = getItemGoldCost(item);
                                        const canAfford = (state.gold || 0) >= cost;

                                        return (
                                            <div
                                                key={item.id}
                                                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between space-x-3"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-2xl shrink-0">{item.icon || '📦'}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-100 truncate">{item.name}</div>
                                                        <div className="text-xs text-slate-400 truncate">
                                                            {item.description || item.type || 'Equipment'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handlePurchase(item)}
                                                    disabled={!canAfford}
                                                    className="shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                                >
                                                    Buy ({cost} GP)
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sell Tab: Player Inventory */}
                    {activeTab === 'sell' && (
                        <div className="space-y-3">
                            {playerSellableItems.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">You have no items to sell.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {playerSellableItems.map(item => {
                                        const value = getItemSellValue(item);
                                        const qty = item.quantity || 1;

                                        return (
                                            <div
                                                key={item.id}
                                                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between space-x-3"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-2xl shrink-0">{item.icon || '📦'}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-100 truncate">
                                                            {item.name} {qty > 1 && <span className="text-amber-300 font-normal">x{qty}</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-400 truncate">
                                                            {item.description || item.type || 'Equipment'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSale(item)}
                                                    className="shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                                                >
                                                    Sell (+{value} GP)
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default ShopModal;
