
/**
 * @file MerchantModal.tsx
 * A modal interface for trading items with a merchant.
 * Supports buying items with gold and selling items for half value (or dynamic value).
 */
import React, { useMemo } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { Item, Action, EconomyState } from '../types';
import Tooltip from './Tooltip';
import { useGameState } from '../state/GameContext';
import { calculatePrice } from '../utils/economyUtils';
import { formatGpAsCoins } from '../utils/coinPurseUtils';
import CoinPurseDisplay from './ui/CoinPurseDisplay';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface MerchantModalProps {
    isOpen: boolean;
    merchantName: string;
    merchantInventory: Item[];
    playerInventory: Item[];
    playerGold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
    economy?: EconomyState; // Keep prop for backward compatibility or testing overrides
}

const overlayMotion: MotionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
};

const MerchantModal: React.FC<MerchantModalProps> = ({
    isOpen,
    merchantName,
    merchantInventory,
    playerInventory,
    playerGold,
    onClose,
    onAction,
    economy: propEconomy,
}) => {
    const { state } = useGameState();
    // Use prop economy if provided (for tests), otherwise fall back to global state economy
    const economy = propEconomy || state.economy;

    // UX: Use focus trap for accessible modal behavior (traps tab, handles escape, restores focus)
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

    const sellableItems = useMemo(() => {
        // Allow selling anything that can be priced.
        // We prefer `costInGp` because it is already normalized (and avoids parsing),
        // but we also accept `cost` strings for legacy items and AI-generated loot.
        return playerInventory.filter(i => (typeof i.costInGp === 'number' && i.costInGp > 0) || Boolean(i.cost));
    }, [playerInventory]);

    const handleBuy = (item: Item) => {
        const { finalPrice } = calculatePrice(item, economy, 'buy');
        if (finalPrice > 0 && playerGold >= finalPrice) {
            onAction({ type: 'BUY_ITEM', label: `Buy ${item.name}`, payload: { item, cost: finalPrice } });
        }
    };

    const handleSell = (item: Item) => {
        const { finalPrice } = calculatePrice(item, economy, 'sell');
        if (finalPrice > 0) {
            onAction({ type: 'SELL_ITEM', label: `Sell ${item.name}`, payload: { itemId: item.id, value: finalPrice } });
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Trading with ${merchantName}`}
                {...modalMotion}
                className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col focus:outline-none"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-cinzel text-amber-400">{merchantName}</h2>
                        <div className="flex flex-col gap-1 text-sm text-gray-400 mt-1">
                            {economy ? (
                                <>
                                    {economy.activeEvents && economy.activeEvents.length > 0 ? (
                                        <div className="flex flex-col gap-1 mb-1">
                                            {economy.activeEvents.map(event => (
                                                <div key={event.id} className="text-amber-200 flex items-center gap-2">
                                                    <span>📢 {event.name}: {event.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="flex gap-4 mt-1 text-xs uppercase tracking-wider font-bold">
                                        <span className={economy.marketFactors.surplus.length > 0 ? "text-green-400" : "text-gray-600"}>
                                            Surplus: {economy.marketFactors.surplus.join(', ') || 'None'}
                                        </span>
                                        <span className={economy.marketFactors.scarcity.length > 0 ? "text-red-400" : "text-gray-600"}>
                                            Scarcity: {economy.marketFactors.scarcity.join(', ') || 'None'}
                                        </span>
                                    </div>
                                </>
                            ) : <span>Standard Prices</span>}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-3xl"
                        aria-label="Close shop"
                    >&times;</button>
                </div>

                {/* Main Content */}
                <div className="flex-grow flex overflow-hidden">
                    {/* Merchant Column */}
                    <div className="w-1/2 p-4 border-r border-gray-700 flex flex-col bg-gray-800/30">
                        <h3 className="text-lg font-bold text-sky-300 mb-3 sticky top-0">For Sale</h3>
                        <div className="flex-grow overflow-y-auto scrollable-content space-y-2 pr-2">
                            {merchantInventory.map((item, idx) => {
                                const { finalPrice, isModified, multiplier } = calculatePrice(item, economy, 'buy');
                                const canAfford = playerGold >= finalPrice;
                                return (
                                    <div key={`${item.id}-${idx}`} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl" aria-hidden="true">{item.icon || '📦'}</span>
                                            <Tooltip content={`${item.description}\nType: ${item.type}`}>
                                                <div>
                                                    <p className="font-semibold text-gray-200">{item.name}</p>
                                                    <p className="text-xs text-gray-400">{item.type} • {item.weight} lbs</p>
                                                </div>
                                            </Tooltip>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <button
                                                onClick={() => handleBuy(item)}
                                                disabled={!canAfford}
                                                aria-label={`Buy ${item.name} for ${formatGpAsCoins(finalPrice)}`}
                                                className={`px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
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
                            {merchantInventory.length === 0 && <p className="text-gray-500 italic text-center mt-10">Sold out.</p>}
                        </div>
                    </div>

                    {/* Player Column */}
                    <div className="w-1/2 p-4 flex flex-col bg-gray-900/30">
                        <h3 className="text-lg font-bold text-amber-300 mb-3 sticky top-0">Your Inventory</h3>
                        <div className="flex-grow overflow-y-auto scrollable-content space-y-2 pr-2">
                            {sellableItems.map((item, idx) => {
                                const { finalPrice, isModified, multiplier } = calculatePrice(item, economy, 'sell');
                                const canSell = finalPrice > 0;
                                return (
                                    <div key={`${item.id}-${idx}`} className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center border border-gray-600/50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl" aria-hidden="true">{item.icon || '📦'}</span>
                                            <div>
                                                <p className="font-semibold text-gray-300">{item.name}</p>
                                                <p className="text-xs text-gray-500">Value: {formatGpAsCoins(finalPrice)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <button
                                                onClick={() => handleSell(item)}
                                                disabled={!canSell}
                                                aria-label={`Sell ${item.name} for ${formatGpAsCoins(finalPrice)}`}
                                                className={`px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
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
                            {sellableItems.length === 0 && <p className="text-gray-500 italic text-center mt-10">Nothing to sell.</p>}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 mr-1">Your Coin Purse:</span>
                        <CoinPurseDisplay goldValue={playerGold} />
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
                    >
                        Leave Shop
                    </button>
                </div>

            </motion.div>
        </motion.div>
    );
};

export default MerchantModal;
