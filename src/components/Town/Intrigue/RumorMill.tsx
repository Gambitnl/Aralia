/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/Town/Intrigue/RumorMill.tsx
 * UI component for the "Rumor Mill" - the intrigue interface within Taverns.
 * Allows players to buy gossip, secrets, and leads.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, Action, Item } from '../../../types';
import { TavernGossipSystem, PurchaseableRumor } from '../../../systems/intrigue/TavernGossipSystem';
import { useGameState } from '../../../state/GameContext';
import { formatGpAsCoins } from '../../../utils/coinPurseUtils';
import { Secret } from '../../../types/identity';

interface RumorMillProps {
    merchantName: string;
    playerGold: number;
    playerInventory: Item[];
    onAction: (action: Action) => void;
}

export const RumorMill: React.FC<RumorMillProps> = ({ merchantName, playerGold, playerInventory, onAction }) => {
    const { state } = useGameState();

    // Generate rumors once on mount (or when day changes, theoretically)
    const availableRumors = useMemo(() => {
        return TavernGossipSystem.getAvailableRumors(state, merchantName);
    }, [state.gameTime, merchantName, state.worldSeed]);

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
        if (rumor.type === 'secret' && rumor.payload) {
             console.log("Learned secret:", rumor.payload);
        }

        // TODO(Intriguer): If type is 'lead', trigger a QUEST_START or add a map marker here via custom action.
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50 p-4 rounded-lg">
            <div className="mb-4 text-center">
                <h3 className="text-xl font-cinzel text-amber-500">The Rumor Mill</h3>
                <p className="text-sm text-gray-400 italic">"Information is the only currency that matters..."</p>
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
                                            <motion.p
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="mt-2 text-sm text-white italic font-serif"
                                            >
                                                "{rumor.content}"
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
                    <p className="text-center text-gray-500 mt-10">
                        "Quiet night. Nobody's talking."
                    </p>
                )}
            </div>

            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-xs text-blue-200">
                <p><strong>Tip:</strong> Purchased rumors are recorded in your inventory as notes.</p>
            </div>
        </div>
    );
};
