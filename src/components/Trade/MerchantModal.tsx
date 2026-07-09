// @dependencies-start
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
// @dependencies-end

/**
 * @file MerchantModal.tsx
 * A modal interface for trading items with a merchant.
 * Supports buying items with gold and selling items for half value (or dynamic value).
 * Now includes Tavern Gossip support!
 */
import React, { useMemo, useState } from 'react';
import { Item, Action, EconomyState, MarketEvent } from '../../types';
import Tooltip from '../Tooltip';
import { useGameState } from '../../state/GameContext';
import { calculatePrice } from '../../utils/economy/economyUtils';
import { formatGpAsCoins } from '../../utils/coinPurseUtils';
import CoinPurseDisplay from '../ui/CoinPurseDisplay';
import { WindowFrame } from '../ui/WindowFrame';
import { RumorMill } from '../Town/Intrigue/RumorMill';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { resolveItemVisual } from '../../utils/visuals/visualUtils';
import { assetUrl } from '../../config/env';

/**
 * Renders an item's glyph: an <img> when the item has a real icon asset
 * (persisted business stock stores paths like "/assets/icons/items/dagger.svg"),
 * otherwise the emoji/text glyph older items used. Never renders a raw path string.
 */
const ItemGlyph: React.FC<{ item: Item }> = ({ item }) => {
    const visual = resolveItemVisual(item);
    const [broken, setBroken] = React.useState(false);
    if (visual.src && !broken) {
        return (
            <img
                src={assetUrl(visual.src)}
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
                loading="lazy"
                aria-hidden="true"
                onError={() => setBroken(true)}
            />
        );
    }
    // Emoji/text fallback — guard against a path string leaking into fallbackContent
    const glyph = visual.fallbackContent && !visual.fallbackContent.startsWith('/')
        ? visual.fallbackContent
        : '📦';
    return <span className="text-2xl" aria-hidden="true">{glyph}</span>;
};

/** Human-readable list: ['food','ingredients'] → "food and ingredients". */
const listTags = (tags: string[]): string => {
    const pretty = tags.map(t => (t === 'all' ? 'goods of all kinds' : t.replace(/_/g, ' ')));
    if (pretty.length <= 1) return pretty[0] ?? '';
    return `${pretty.slice(0, -1).join(', ')} and ${pretty[pretty.length - 1]}`;
};

/** One short flavor line for market conditions, or null when the market is calm. */
const marketFlavorLine = (surplus: string[], scarcity: string[]): string | null => {
    const parts: string[] = [];
    if (surplus.length > 0) parts.push(`Plenty of ${listTags(surplus)} this season — prices are down.`);
    if (scarcity.length > 0) parts.push(`${listTags(scarcity).replace(/^./, c => c.toUpperCase())} ${scarcity.length > 1 ? 'are' : 'is'} scarce — prices are up.`);
    return parts.length > 0 ? parts.join(' ') : null;
};

/** Social approaches the HAGGLE_ITEM handler understands (see handleMerchantAction). */
type HaggleStrategy = 'persuade' | 'intimidate' | 'insight';

/**
 * Haggle approaches surfaced as controls. Each maps to a `strategy` the
 * HAGGLE_ITEM handler already resolves: it rolls the matching social skill
 * against a merchant DC and, on success, discounts purchases. `intimidate`
 * carries a real downside (it raises local heat and counts as a crime), which
 * the hint calls out so the choice is informed.
 */
const HAGGLE_STRATEGIES: { strategy: HaggleStrategy; label: string; hint: string }[] = [
    { strategy: 'persuade', label: 'Persuade', hint: 'Talk the merchant down with Charisma (Persuasion). Success earns a 10% discount.' },
    { strategy: 'insight', label: 'Insight', hint: 'Read the merchant with Wisdom (Insight) to spot a weak pitch. Success earns a 10% discount.' },
    { strategy: 'intimidate', label: 'Intimidate', hint: 'Threaten the merchant with Charisma (Intimidation) for a 20% discount — but it draws heat and counts as a crime.' },
];

interface MerchantModalProps {
    isOpen: boolean;
    merchantName: string;
    merchantInventory: Item[];
    playerInventory: Item[];
    playerGold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
    economy?: EconomyState; // Keep prop for backward compatibility or testing overrides
    regionId?: string; // Optional region to apply import/export modifiers
}

type Tab = 'trade' | 'gossip';

const MerchantModal: React.FC<MerchantModalProps> = ({
    isOpen,
    merchantName,
    merchantInventory,
    playerInventory,
    playerGold,
    onClose,
    onAction,
    economy: propEconomy,
    regionId,
}) => {
    const { state } = useGameState();
    // Use prop economy if provided (for tests), otherwise fall back to global state economy
    const economy = propEconomy || state.economy;

    // Faction context for trade bonuses — player standing affects prices
    const priceContext = useMemo(() => ({
        factions: state.factions,
        standings: state.playerFactionStandings
    }), [state.factions, state.playerFactionStandings]);

    // Determine if this is a tavern-like establishment
    const isTavern = merchantName.toLowerCase().includes('tavern') || merchantName.toLowerCase().includes('inn');
    const [activeTab, setActiveTab] = useState<Tab>('trade');

    const sellableItems = useMemo(() => {
        // Allow selling anything that can be priced.
        // We prefer `costInGp` because it is already normalized (and avoids parsing),
        // but we also accept `cost` strings for legacy items and AI-generated loot.
        return playerInventory.filter(i => (typeof i.costInGp === 'number' && i.costInGp > 0) || Boolean(i.cost));
    }, [playerInventory]);

    const junkItems = useMemo(() => {
        return sellableItems.filter(item => item.isJunk === true);
    }, [sellableItems]);

    const junkValue = useMemo(() => {
        return junkItems.reduce((total, item) => {
            const { finalPrice } = calculatePrice(item, economy, 'sell', regionId, priceContext);
            return total + finalPrice;
        }, 0);
    }, [junkItems, economy, regionId, priceContext]);

    const handleBuy = (item: Item) => {
        const { finalPrice } = calculatePrice(item, economy, 'buy', regionId, priceContext);
        if (finalPrice > 0 && playerGold >= finalPrice) {
            // handleMerchantAction expects the transaction-wrapped shape; a flat
            // { item, cost } was silently ignored (payload.transaction was undefined),
            // which is why every Buy click did nothing.
            onAction({ type: 'BUY_ITEM', label: `Buy ${item.name}`, payload: { transaction: { buy: { item, cost: finalPrice } } } as any });
        }
    };

    const handleSell = (item: Item) => {
        const { finalPrice } = calculatePrice(item, economy, 'sell', regionId, priceContext);
        if (finalPrice > 0) {
            onAction({ type: 'SELL_ITEM', label: `Sell ${item.name}`, payload: { transaction: { sell: { itemId: item.id, value: finalPrice } } } as any });
        }
    };

    // Haggle over the merchant's prices. The chosen approach routes to the
    // existing HAGGLE_ITEM handler, which rolls the appropriate social skill for
    // the party's spokesperson (the leader) against the merchant's DC. We pass
    // the leader as interactorId; the handler falls back to party[0] anyway.
    const handleHaggle = (strategy: HaggleStrategy) => {
        onAction({
            type: 'HAGGLE_ITEM',
            label: `Haggle (${strategy})`,
            payload: { strategy, interactorId: state.party?.[0]?.id } as any,
        });
    };

    if (!isOpen) return null;

    const marketFlavor = economy ? marketFlavorLine(economy.marketFactors.surplus, economy.marketFactors.scarcity) : null;
    const marketEvents: MarketEvent[] = economy?.activeEvents ?? [];

    // Tavern trade/rumors tabs ride in the WindowFrame title bar.
    const headerTabs = isTavern ? (
        <div className="flex bg-gray-900 rounded p-1 gap-1">
            <button
                onClick={() => setActiveTab('trade')}
                className={`px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider transition-colors
                    ${activeTab === 'trade' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
                Trade
            </button>
            <button
                onClick={() => setActiveTab('gossip')}
                className={`px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider transition-colors
                    ${activeTab === 'gossip' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
                Rumors
            </button>
        </div>
    ) : undefined;

    return (
        <WindowFrame
            title={merchantName}
            onClose={onClose}
            storageKey={WINDOW_KEYS.MERCHANT}
            initialMaximized={false}
            headerActions={headerTabs}
        >
            <div className="flex flex-col h-full">
                {/* Market conditions banner (was a header subtitle). */}
                {(marketEvents.length > 0 || marketFlavor) && (
                    <div className="shrink-0 px-4 py-2 border-b border-gray-700 bg-gray-900/40 text-sm text-gray-400 flex flex-col gap-1">
                        {marketEvents.map((marketEvent) => (
                            <div key={marketEvent.id} className="text-amber-200">📢 {marketEvent.name}: {marketEvent.description}</div>
                        ))}
                        {marketFlavor && <span className="italic text-gray-300">{marketFlavor}</span>}
                    </div>
                )}

                {/* Main Content */}
                {/* Narrow WindowFrames do not have enough room for buy and sell
                    panes side by side. The trade body becomes one scrollable
                    stack there, while desktop windows keep the familiar
                    two-column shop counter with independent list scrolling. */}
                <div className="flex-grow min-h-0 overflow-y-auto scrollable-content md:flex md:overflow-hidden">
                    {activeTab === 'gossip' ? (
                        // Gossip View
                        <div className="w-full p-6">
                           <RumorMill
                                merchantName={merchantName}
                                playerGold={playerGold}
                                playerInventory={playerInventory}
                                onAction={onAction}
                           />
                        </div>
                    ) : (
                        // Trade View (Standard)
                        <>
                            {/* Merchant Column */}
                            <div className="w-full p-4 border-b border-gray-700 flex flex-col bg-gray-800/30 md:w-1/2 md:border-b-0 md:border-r">
                                <h3 className="text-lg font-bold text-sky-300 mb-3 sticky top-0">For Sale</h3>
                                {/* Haggle controls — negotiate a better price before buying. Each
                                    button dispatches the already-handled HAGGLE_ITEM action with a
                                    social strategy; a successful roll discounts subsequent purchases. */}
                                <div className="mb-3 flex flex-col gap-1.5 rounded-lg border border-gray-600/50 bg-gray-900/30 p-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Haggle</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {HAGGLE_STRATEGIES.map(({ strategy, label, hint }) => (
                                            <Tooltip key={strategy} content={hint}>
                                                <button
                                                    onClick={() => handleHaggle(strategy)}
                                                    aria-label={`Haggle using ${label}`}
                                                    className="min-h-11 flex-1 justify-center px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                                                >
                                                    {label}
                                                </button>
                                            </Tooltip>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 pr-1 md:flex-grow md:overflow-y-auto md:scrollable-content md:pr-2">
                                    {merchantInventory.map((item, idx) => {
                                        const { finalPrice, isModified, multiplier } = calculatePrice(item, economy, 'buy', regionId, priceContext);
                                        const canAfford = playerGold >= finalPrice;
                                        return (
                                            <div key={`${item.id}-${idx}`} className="bg-gray-700 p-3 rounded-lg flex flex-col items-stretch gap-3 shadow-sm sm:flex-row sm:justify-between sm:items-center">
                                                <div className="flex items-center gap-3">
                                                    <ItemGlyph item={item} />
                                                    <Tooltip content={`${item.description}\nType: ${item.type}`}>
                                                        <div>
                                                            <p className="font-semibold text-gray-200">{item.name}</p>
                                                            <p className="text-xs text-gray-400">{item.type} • {item.weight} lbs</p>
                                                        </div>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                                                    <button
                                                        onClick={() => handleBuy(item)}
                                                        disabled={!canAfford}
                                                        aria-label={`Buy ${item.name} for ${formatGpAsCoins(finalPrice)}`}
                                                        className={`min-h-11 justify-center px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
                                            ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                                        `}
                                                    >
                                                        <span>{formatGpAsCoins(finalPrice)}</span>
                                                    </button>
                                                    {isModified && (
                                                        <span className={`text-[10px] font-bold ${multiplier > 1 ? 'text-red-400' : 'text-green-400'}`}>
                                                            {multiplier > 1 ? '▲ High Demand' : '▼ Low Price'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {merchantInventory.length === 0 && <p className="text-gray-400 italic text-center mt-10">Sold out.</p>}
                                </div>
                            </div>

                            {/* Player Column */}
                            <div className="w-full p-4 flex flex-col bg-gray-900/30 md:w-1/2">
                                <div className="flex flex-col items-stretch gap-2 mb-3 sticky top-0 bg-gray-900/10 py-1 sm:flex-row sm:justify-between sm:items-center">
                                    <h3 className="text-lg font-bold text-amber-300">Your Inventory</h3>
                                    {junkItems.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const itemsPayload = junkItems.map(item => {
                                                    const { finalPrice } = calculatePrice(item, economy, 'sell', regionId, priceContext);
                                                    return { itemId: item.id, value: finalPrice };
                                                });
                                                onAction({
                                                    type: 'SELL_ALL_JUNK',
                                                    label: `Sell All Junk (${junkItems.length} items)`,
                                                    payload: { items: itemsPayload }
                                                });
                                            }}
                                            className="min-h-11 px-2 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                                        >
                                            Sell All Junk ({formatGpAsCoins(junkValue)})
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2 pr-1 md:flex-grow md:overflow-y-auto md:scrollable-content md:pr-2">
                                    {sellableItems.map((item, idx) => {
                                        const { finalPrice, isModified, multiplier } = calculatePrice(item, economy, 'sell', regionId, priceContext);
                                        const canSell = finalPrice > 0;
                                        return (
                                            <div key={`${item.id}-${idx}`} className="bg-gray-700/50 p-3 rounded-lg flex flex-col items-stretch gap-3 border border-gray-600/50 sm:flex-row sm:justify-between sm:items-center">
                                                <div className="flex items-center gap-3">
                                                    <ItemGlyph item={item} />
                                                    <div>
                                                        <p className="font-semibold text-gray-300">{item.name}</p>
                                                        <p className="text-xs text-gray-400">Value: {formatGpAsCoins(finalPrice)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                                                    <button
                                                        onClick={() => handleSell(item)}
                                                        disabled={!canSell}
                                                        aria-label={`Sell ${item.name} for ${formatGpAsCoins(finalPrice)}`}
                                                        className={`min-h-11 justify-center px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
                                            ${canSell ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-gray-600 text-gray-500 cursor-not-allowed'}
                                        `}
                                                    >
                                                        <span>{formatGpAsCoins(finalPrice)}</span>
                                                    </button>
                                                    {isModified && (
                                                        <span className={`text-[10px] font-bold ${multiplier > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {multiplier > 0.5 ? '▲ High Demand' : '▼ Low Demand'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sellableItems.length === 0 && <p className="text-gray-400 italic text-center mt-10">Nothing to sell.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-4 border-t border-gray-700 bg-gray-900 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 mr-1">Your Coin Purse:</span>
                        <CoinPurseDisplay goldValue={playerGold} />
                    </div>
                    <button
                        onClick={onClose}
                        className="min-h-11 w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg shadow-md transition-colors sm:w-auto"
                    >
                        Leave {activeTab === 'gossip' ? 'Tavern' : 'Shop'}
                    </button>
                </div>
            </div>
        </WindowFrame>
    );
};

export default MerchantModal;
