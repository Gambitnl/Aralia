
/**
 * @file MerchantModal.tsx
 * A modal interface for trading items with a merchant.
 * Supports buying items with gold and selling items for half value (or dynamic value).
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Item, Action, EconomyState } from '../types';
import Tooltip from './Tooltip';

interface MerchantModalProps {
  isOpen: boolean;
  merchantName: string;
  merchantInventory: Item[];
  playerInventory: Item[];
  playerGold: number;
  onClose: () => void;
  onAction: (action: Action) => void;
  economy?: EconomyState;
}

const parseCost = (costStr: string | undefined): number => {
    if (!costStr) return 0;
    
    // Remove commas
    const cleanCost = costStr.replace(/,/g, '');

    const pp = cleanCost.match(/(\d+(?:\.\d+)?)\s*PP/i);
    if (pp) return parseFloat(pp[1]) * 10;

    const gp = cleanCost.match(/(\d+(?:\.\d+)?)\s*GP/i);
    if (gp) return parseFloat(gp[1]);

    const ep = cleanCost.match(/(\d+(?:\.\d+)?)\s*EP/i);
    if (ep) return parseFloat(ep[1]) * 0.5;

    const sp = cleanCost.match(/(\d+(?:\.\d+)?)\s*SP/i);
    if (sp) return parseFloat(sp[1]) * 0.1;

    const cp = cleanCost.match(/(\d+(?:\.\d+)?)\s*CP/i);
    if (cp) return parseFloat(cp[1]) * 0.01;

    return 0;
};

const MerchantModal: React.FC<MerchantModalProps> = ({
  isOpen,
  merchantName,
  merchantInventory,
  playerInventory,
  playerGold,
  onClose,
  onAction,
  economy,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) {
        window.addEventListener('keydown', handleEsc);
        closeButtonRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const sellableItems = useMemo(() => {
      return playerInventory.filter(i => i.cost);
  }, [playerInventory]);

  // Helper to calculate price with multipliers
  const calculatePrice = (item: Item, type: 'buy' | 'sell'): { finalPrice: number, isModified: boolean } => {
      const baseCost = parseCost(item.cost);
      if (baseCost === 0) return { finalPrice: 0, isModified: false };
      
      if (!economy) {
           // Default behavior: Buy at full, sell at half
           if (type === 'buy') return { finalPrice: Math.ceil(baseCost), isModified: false };
           return { finalPrice: Math.floor(baseCost / 2), isModified: false };
      }

      // Apply multipliers based on economy tags
      let multiplier = type === 'buy' ? economy.buyMultiplier : economy.sellMultiplier;
      
      // Check scarcity/surplus logic if item has tags/type matching
      const itemTags = [item.type, ...(item.name.toLowerCase().split(' '))];
      const isScarce = economy.marketFactors.scarcity.some(tag => itemTags.some(it => it.includes(tag.toLowerCase())));
      const isSurplus = economy.marketFactors.surplus.some(tag => itemTags.some(it => it.includes(tag.toLowerCase())));

      if (type === 'buy') {
          if (isScarce) multiplier += 0.5; // Expensive
          if (isSurplus) multiplier -= 0.3; // Cheap
      } else {
          if (isScarce) multiplier += 0.3; // They pay more
          if (isSurplus) multiplier -= 0.2; // They pay less
      }

      // Clamp logic
      if (type === 'buy') multiplier = Math.max(0.1, multiplier);
      else multiplier = Math.max(0.1, multiplier);

      const finalPrice = Math.floor(baseCost * multiplier);
      return { finalPrice: Math.max(0, finalPrice), isModified: multiplier !== (type === 'buy' ? 1 : 0.5) };
  };

  const handleBuy = (item: Item) => {
      const { finalPrice } = calculatePrice(item, 'buy');
      if (finalPrice > 0 && playerGold >= finalPrice) {
          onAction({ type: 'BUY_ITEM', label: `Buy ${item.name}`, payload: { item, cost: finalPrice } });
      }
  };

  const handleSell = (item: Item) => {
      const { finalPrice } = calculatePrice(item, 'sell');
      if (finalPrice > 0) { 
           onAction({ type: 'SELL_ITEM', label: `Sell ${item.name}`, payload: { itemId: item.id, value: finalPrice } });
      }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      } as any}
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        {...{
          initial: { y: -20, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 20, opacity: 0 },
        } as any}
        className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50 rounded-t-xl">
            <div>
                <h2 className="text-2xl font-cinzel text-amber-400">{merchantName}</h2>
                <div className="flex flex-col gap-1 text-sm text-gray-400 mt-1">
                   {economy ? (
                       <>
                        {economy.activeEvents && economy.activeEvents.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {economy.activeEvents.map(event => (
                                    <div key={event.id} className="text-amber-200 flex items-center gap-2">
                                        <span>📢 {event.name}: {event.description}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                         <div className="flex gap-3 mt-1">
                            <span className="text-green-400">Surplus: {economy.marketFactors.surplus.join(', ') || 'None'}</span>
                            <span className="text-red-400">Scarcity: {economy.marketFactors.scarcity.join(', ') || 'None'}</span>
                         </div>
                       </>
                   ) : <span>Standard Prices</span>}
                </div>
            </div>
            <button 
                ref={closeButtonRef}
                onClick={onClose}
                className="text-gray-400 hover:text-white text-3xl"
            >&times;</button>
        </div>

        {/* Main Content */}
        <div className="flex-grow flex overflow-hidden">
            {/* Merchant Column */}
            <div className="w-1/2 p-4 border-r border-gray-700 flex flex-col bg-gray-800/30">
                <h3 className="text-lg font-bold text-sky-300 mb-3 sticky top-0">For Sale</h3>
                <div className="flex-grow overflow-y-auto scrollable-content space-y-2 pr-2">
                    {merchantInventory.map((item, idx) => {
                        const { finalPrice, isModified } = calculatePrice(item, 'buy');
                        const canAfford = playerGold >= finalPrice;
                        return (
                            <div key={`${item.id}-${idx}`} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{item.icon || '📦'}</span>
                                    <Tooltip content={`${item.description}\nType: ${item.type}`}>
                                        <div>
                                            <p className="font-semibold text-gray-200">{item.name}</p>
                                            <p className="text-xs text-gray-400">{item.type} • {item.weight} lbs</p>
                                        </div>
                                    </Tooltip>
                                </div>
                                <button 
                                    onClick={() => handleBuy(item)}
                                    disabled={!canAfford}
                                    className={`px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
                                        ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                                    `}
                                >
                                    <span>{finalPrice} GP</span>
                                    {isModified && <span className="text-[10px] ml-1">⚠️</span>}
                                </button>
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
                     {sellableItems.map((item) => {
                        const { finalPrice, isModified } = calculatePrice(item, 'sell');
                        const canSell = finalPrice > 0;
                        return (
                            <div key={item.id} className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center border border-gray-600/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{item.icon || '📦'}</span>
                                    <div>
                                        <p className="font-semibold text-gray-300">{item.name}</p>
                                        <p className="text-xs text-gray-500">Value: {finalPrice} GP</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleSell(item)}
                                    disabled={!canSell}
                                    className={`px-3 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1
                                        ${canSell ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-gray-600 text-gray-500 cursor-not-allowed'}
                                    `}
                                >
                                    <span>{finalPrice} GP</span>
                                    {isModified && <span className="text-[10px] ml-1">⚠️</span>}
                                </button>
                            </div>
                        );
                    })}
                    {sellableItems.length === 0 && <p className="text-gray-500 italic text-center mt-10">Nothing to sell.</p>}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-xl flex justify-between items-center">
            <div className="flex items-center gap-2 text-xl font-bold text-amber-300">
                <span>🪙</span>
                <span>{playerGold} GP</span>
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
