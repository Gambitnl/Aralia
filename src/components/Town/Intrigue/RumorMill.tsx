/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/Town/Intrigue/RumorMill.tsx
 * UI component for the "Rumor Mill" - the intrigue interface within Taverns.
 * Allows players to buy gossip, secrets, and leads.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:09:15
 * Dependents: components/Trade/MerchantModal.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo } from 'react';
import { rumorsForBurg } from '../../../systems/worldforge/dungeon/world/rumors';
import { burgIdForLocation } from '../../../systems/worldforge/townsim/chronicleForLocation';
import { dungeonRumorsToWorldRumors } from '../../../utils/world/dungeonRumorsToWorldRumors';
import { motion, AnimatePresence } from 'framer-motion';
import { Action, Item, ItemType } from '../../../types';
import { TavernGossipSystem, PurchaseableRumor, chronicleRumorContext } from '../../../systems/intrigue/TavernGossipSystem';
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
  // A legacy paid receipt already owns this information. Recover its named
  // source from the same frozen site/event id without selling it a second time.
  // A legend names a site; it does not establish a safe route or move a marker.
  const sourceNames = useMemo(() => {
    if (state.worldSeed == null || state.playerCell?.cellId == null) return new Map<string, string>();
    const burgId = burgIdForLocation({ground: state, worldSeed: state.worldSeed, cellId: state.playerCell.cellId});
    if (burgId === undefined) return new Map<string, string>();
    const sources = rumorsForBurg(state.worldSeed, burgId, state.clearedDungeons ?? undefined);
    const projected = dungeonRumorsToWorldRumors(sources, 0, state.currentLocationId);
    return new Map(projected.map((rumor, index) => [`gossip_${rumor.id}`, sources[index].dungeonName]));
  }, [state.worldSeed, state.playerCell?.cellId, state.currentLocationId, state.clearedDungeons, state.playerGroundPos, state.atlasGroundAddress, state.entry3DAnchor]);

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

    // World gossip leaves the offer pool as soon as it is bought. Read the
    // durable receipt here too, so paying reveals information immediately
    // instead of replacing it with another unexplained price button.
    const retiredNotes = playerInventory.filter(item =>
        item.type === ItemType.Service && item.id.startsWith('rumor_')
        && item.sourceId && !availableRumors.some(rumor => rumor.id === item.sourceId));

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
            description: `Purchased from ${merchantName}: "${sourceNames.has(rumor.id) && !rumor.content?.startsWith(sourceNames.get(rumor.id)!) ? `${sourceNames.get(rumor.id)}: ` : ''}${rumor.content}"`, // Store content here!
            weight: 0,
            icon: '📜'
        };

        // Keep this context as a purchase-time snapshot. Older earned notes are
        // never rewritten when the town advances or its current offers change.
        if (rumor.context) serviceItem.description += ' Account age when purchased: '+rumor.context.ageLabel+'.';

        // Use the same validated transaction seam as shop purchases. A flat
        // reducer payload is ignored by the action handler. Gossip has a posted
        // price, so equipment haggling must not change the displayed charge.
        onAction({
            type: 'BUY_ITEM',
            label: `Buy ${serviceItem.name}`,
            payload: {
                merchantId: state.merchantModal?.merchantId,
                priceMultiplier: 1,
                transaction: { buy: { item: serviceItem, cost: rumor.cost } },
            }
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
                                                {sourceNames.has(rumor.id) && <span className="mt-2 block text-sky-200">Source site: {sourceNames.get(rumor.id)}. This account gives no confirmed travel route.</span>}
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

                {retiredNotes.length > 0 && (
                    <section aria-label="Purchased information" className="space-y-2 border-t border-slate-600 pt-3">
                        <h4 className="font-bold text-amber-200">Your notes</h4>
                        {retiredNotes.map(item => {
                            const source = state.activeRumors?.find(rumor => item.sourceId === 'gossip_'+rumor.id
                                && item.description?.includes('"'+rumor.text+'"'));
                            const context = source ? chronicleRumorContext(state,source) : undefined;
                            return (
                            <article key={item.id} className="rounded border border-slate-600 bg-slate-800 p-3">
                                <p className="text-xs text-green-400">Acquired · {item.name}</p>
                                <p className="mt-2 text-sm text-white font-serif">{item.description}</p>
                                {context && <p className="mt-2 text-sm text-sky-200">Town chronicle · {context.subject} · {context.ageLabel}</p>}
                                {item.sourceId && sourceNames.has(item.sourceId) && <p className="mt-2 text-sm text-sky-200">Source site: {sourceNames.get(item.sourceId)}. This account gives no confirmed travel route.</p>}
                            </article>
                        );})}
                    </section>
                )}

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
