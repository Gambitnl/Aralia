/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/Town/Intrigue/RumorMill.tsx
 * UI component for the "Rumor Mill" - the intrigue interface within Taverns.
 * Allows players to buy gossip, secrets, and leads.
 */
// TODO(lint-intent): 'useState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import React, { useState as _useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState, Action, Item } from '../../../types';
import { TavernGossipSystem, PurchaseableRumor } from '../../../systems/intrigue/TavernGossipSystem';
import { useGameState } from '../../../state/GameContext';
import { formatGpAsCoins } from '../../../utils/coinPurseUtils';
// TODO(lint-intent): 'Secret' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Secret as _Secret } from '../../../types/identity';

interface RumorMillProps {
    merchantName: string;
    playerGold: number;
    playerInventory: Item[];
    onAction: (action: Action) => void;
}

export const RumorMill: React.FC<RumorMillProps> = ({ merchantName, playerGold, playerInventory, onAction }) => {
    const { state } = useGameState();

  // TODO(lint-intent): If rumor availability becomes expensive, move this lookup into a memoized selector.
  const availableRumors = TavernGossipSystem.getAvailableRumors(state, merchantName);

    // Track purchased rumors by checking inventory for the unique items we create
    // This ensures persistence across modal closes.
    const purchasedMap = useMemo(() => {
        const map = new Set<string>();
        playerInventory.forEach(item => {
            if (item.id.startsWith('rumor_')) {
                 // The item ID is constructed as rumor_{originalId} to be unique and identifiable
                 const originalId = item.id.replace('rumor_', '');
                 map.add(originalId);
            }
        });
        return map;
    }, [playerInventory]);

    const handlePurchase = (rumor: PurchaseableRumor) => {
        if (playerGold < rumor.cost) return;

        // Construct a service item that acts as the "Receipt" and the Log Entry.
        // Important: Description MUST contain the content so it can be read later.
        const serviceItem: Item = {
            id: `rumor_${rumor.id}`, // Unique ID linking back to the rumor
            name: rumor.type === 'secret' ? 'Secret Info' : rumor.type === 'lead' ? 'Lead' : 'Rumor',
            type: 'service', // or 'document' / 'note' if we want it to be more physical
            cost: 0, // Resell value is 0 (info degrades)
            costInGp: 0,
            description: `Purchased from ${merchantName}: "${rumor.content}"`, // Store content here!
            weight: 0,
            icon: '📜'
        };

        // Dispatch BUY_ITEM to deduct gold and add the item to inventory
        onAction({
            type: 'BUY_ITEM',
            payload: { item: serviceItem, cost: rumor.cost }
        });

        // Log specific event for intrigue system hook (optional, handled by BUY_ITEM logs generally)
        // [Sentinel] Removed console.log that exposed secret payload

        // TODO(Intriguer): If type is 'lead', trigger a QUEST_START or add a map marker here via custom action.
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50 p-4 rounded-lg">
            <div className="mb-4 text-center">
                <h3 className="text-xl font-cinzel text-amber-500">The Rumor Mill</h3>
                
                
                {/*
                  TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
                  TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
                  TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
                */}
                <p className="text-sm text-gray-400 italic">&quot;Information is the only currency that matters...&quot;</p>
            </div>

            <div className="flex-grow overflow-y-auto space-y-3">
                {availableRumors.map((rumor) => {
                    const isPurchased = purchasedMap.has(rumor.id);
                    const canAfford = playerGold >= rumor.cost;

                    return (
                        <motion.div
                            key={rumor.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3 rounded border ${isPurchased ? 'bg-slate-800 border-slate-600' : 'bg-slate-700/50 border-slate-700'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <h4 className={`font-bold ${isPurchased ? 'text-amber-200' : 'text-gray-300'}`}>
                                        {rumor.type === 'secret' ? '🔒 Secret' : rumor.type === 'lead' ? '🗺️ Lead' : '🗣️ Rumor'}
                                    </h4>

                                    <AnimatePresence mode="wait">
                                        {isPurchased ? (
                                            
                                            
                                            /* TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
                                            TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
                                            TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
                                            */
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="mt-2 text-sm text-white italic font-serif"
                                            >
                                                &quot;{rumor.content}&quot;
                                            </motion.p>
                                        ) : (
                                            <p className="text-sm text-gray-400">{rumor.title}</p>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {!isPurchased && (
                                    <button
                                        onClick={() => handlePurchase(rumor)}
                                        disabled={!canAfford}
                                        className={`ml-3 px-3 py-1 text-sm font-bold rounded min-w-[80px]
                                            ${canAfford
                                                ? 'bg-amber-700 hover:bg-amber-600 text-amber-100 shadow-sm'
                                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                                        `}
                                    >
                                        {formatGpAsCoins(rumor.cost)}
                                    </button>
                                )}
                                {isPurchased && (
                                     <span className="ml-3 text-xs text-green-400 font-bold uppercase border border-green-900 bg-green-900/30 px-2 py-1 rounded">
                                        Acquired
                                     </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}

                {availableRumors.length === 0 && (
                    
                    
                    /* TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
                    TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
                    TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
                    */
                    <p className="text-center text-gray-500 mt-10">
                        &quot;Quiet night. Nobody&apos;s talking.&quot;
                    </p>
                )}
            </div>

            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-xs text-blue-200">
                <p><strong>Tip:</strong> Purchased rumors are recorded in your inventory as notes.</p>
            </div>
        </div>
    );
};
