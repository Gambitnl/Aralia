/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/Town/Intrigue/RumorMill.tsx
 * UI component for the "Rumor Mill" - the intrigue interface within Taverns.
 * Allows players to buy gossip, secrets, and leads.
 */
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Action, Item, ItemType } from '../../../types';
import { TavernGossipSystem, PurchaseableRumor } from '../../../systems/intrigue/TavernGossipSystem';
import { useGameState } from '../../../state/GameContext';
import { formatGpAsCoins } from '../../../utils/character';
import { INITIAL_QUESTS } from '../../../data/quests';

interface RumorMillProps {
    merchantName: string;
    playerGold: number;
    playerInventory: Item[];
    onAction: (action: Action) => void;
}

export const RumorMill: React.FC<RumorMillProps> = ({ merchantName, playerGold, playerInventory, onAction }) => {
    const { state } = useGameState();

  const availableRumors = TavernGossipSystem.getAvailableRumors(state, merchantName);

    // Track purchased rumors by checking inventory for the Service receipts we create.
    // Each receipt records the rumor it came from in sourceId, so the lookup needs no
    // id-naming convention and survives modal closes.
    const purchasedMap = useMemo(() => {
        const map = new Set<string>();
        playerInventory.forEach(item => {
            if (item.type === ItemType.Service && item.sourceId) {
                map.add(item.sourceId);
            }
        });
        return map;
    }, [playerInventory]);

    const handlePurchase = (rumor: PurchaseableRumor) => {
        if (playerGold < rumor.cost) return;

        // Construct a service item that acts as the "Receipt" and the Log Entry.
        // Important: Description MUST contain the content so it can be read later.
        const serviceItem: Item = {
            id: `rumor_${rumor.id}`, // Unique ID so repeat purchases stay distinguishable
            sourceId: rumor.id, // Records which rumor this receipt was bought from
            name: rumor.type === 'secret' ? 'Secret Info' : rumor.type === 'lead' ? 'Lead' : 'Rumor',
            type: ItemType.Service,
            cost: '0', // Resell value is 0 (info degrades)
            description: `Purchased from ${merchantName}: "${rumor.content}"`, // Store content here!
            weight: 0,
            icon: '📜'
        };

        // Dispatch BUY_ITEM to deduct gold and add the item to inventory
        onAction({
            type: 'BUY_ITEM',
            label: `Buy ${serviceItem.name}`,
            payload: { item: serviceItem, cost: rumor.cost } as any
        });

        // Log specific event for intrigue system hook (optional, handled by BUY_ITEM logs generally)
        // [Sentinel] Removed console.log that exposed secret payload

        // A lead is a quest hook: buying it accepts the quest it points at. ACCEPT_QUEST is
        // the only quest-start seam in the app, and the quest reducer drops a quest already
        // in the log, so a repeat purchase is harmless.
        // The lead's map marker is deliberately not placed: MapMarker (src/types/world.ts)
        // has no reducer and no renderer, so there is nothing to dispatch a marker to.
        if (rumor.type === 'lead' && rumor.questId) {
            const quest = INITIAL_QUESTS[rumor.questId];
            if (quest) {
                onAction({
                    type: 'ACCEPT_QUEST',
                    label: `Follow up: ${quest.title}`,
                    payload: quest
                });
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50 p-4 rounded-lg">
            <div className="mb-4 text-center">
                <h3 className="text-xl font-cinzel text-amber-500">The Rumor Mill</h3>
                
                
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
