
import React, { useState } from 'react';
import { useGameState } from '../../../state/GameContext';
import { GuildService } from '../../../types/crime';
import { Item, ItemRarity, ItemRarityDefinitions } from '../../../types/items';
import { Z_INDEX } from '../../../styles/zIndex';

interface FenceInterfaceProps {
    service: GuildService;
    onClose: () => void;
}

const FenceInterface: React.FC<FenceInterfaceProps> = ({ service, onClose }) => {
    const { state, dispatch } = useGameState();
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [filter, setFilter] = useState<'all' | 'treasures' | 'weapons'>('all');

    // Calculate markdown based on service tier
    // Basic Fence (rank 1) = 30% cut (pays 70%)
    // Master Fence (rank 4) = 15% cut (pays 85%)
    // Default fallback 50%
    const payoutRatio = service.id === 'service_fence_master' ? 0.85 :
                       service.id === 'service_fence_basic' ? 0.70 : 0.5;

    const getFencePrice = (item: Item): number => {
        let baseValue = item.costInGp || 0;

        // If costInGp is missing, try to infer from rarity
        if (!baseValue && item.rarity) {
            baseValue = ItemRarityDefinitions[item.rarity].minPrice;
        }

        // Round down to avoid decimals
        return Math.floor(baseValue * payoutRatio);
    };

    const handleSell = () => {
        if (!selectedItem) return;

        const price = getFencePrice(selectedItem);

        dispatch({
            type: 'SELL_ITEM',
            payload: {
                itemId: selectedItem.id,
                value: price
            }
        });

        // Add a notification for flavor
        dispatch({
            type: 'ADD_MESSAGE',
            payload: {
                id: Date.now(),
                text: `Sold ${selectedItem.name} to the fence for ${price} gp.`,
                sender: 'system',
                timestamp: new Date()
            }
        });

        setSelectedItem(null);
    };

    // Filter items
    const inventory = state.inventory.filter(item => {
        const isEquippable = (item as { isEquippable?: boolean }).isEquippable;
        if (isEquippable && filter === 'treasures') return false;
        if (item.type !== 'weapon' && filter === 'weapons') return false;
        // Don't show currently equipped items?
        // Checking against party equipment would be complex here, assuming unequipped inventory list
        return true;
    });

    return (
        <div className={`fixed inset-0 bg-black/90 flex items-center justify-center z-[${Z_INDEX.MODAL_BACKGROUND}] p-4`}>
            <div className="bg-gray-900 border border-amber-900/50 rounded-lg max-w-2xl w-full h-[70vh] flex flex-col shadow-2xl overflow-hidden relative">

                {/* Header */}
                <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                            <span>🕵️</span> {service.name}
                        </h2>
                        
                        
                        {/*
                          TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
                          TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
                          TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
                        */}
                        <p className="text-xs text-gray-400">
                            &quot;I buy anything. No questions asked.&quot; (Cut: {Math.round((1 - payoutRatio) * 100)}%)
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Inventory List */}
                    <div className="w-1/2 border-r border-gray-700 flex flex-col bg-gray-900/50">
                        <div className="p-2 border-b border-gray-800 flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2 py-1 text-xs rounded ${filter === 'all' ? 'bg-amber-900 text-amber-100' : 'bg-gray-800 text-gray-400'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('treasures')}
                                className={`px-2 py-1 text-xs rounded ${filter === 'treasures' ? 'bg-amber-900 text-amber-100' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Treasures
                            </button>
                            <button
                                onClick={() => setFilter('weapons')}
                                className={`px-2 py-1 text-xs rounded ${filter === 'weapons' ? 'bg-amber-900 text-amber-100' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Weapons
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {inventory.length === 0 ? (
                                <p className="text-gray-600 text-center text-sm mt-4">Inventory is empty.</p>
                            ) : (
                                inventory.map(item => (
                                    
                                    
                                    /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
                                    TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
                                    TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
                                    */
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                setSelectedItem(item);
                                            }
                                        }}
                                        className={`p-2 rounded cursor-pointer flex justify-between items-center text-sm border ${selectedItem?.id === item.id ? 'bg-amber-900/20 border-amber-600' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}
                                    >
                                        <span className={item.rarity === ItemRarity.Legendary ? 'text-orange-400' : item.rarity === ItemRarity.Rare ? 'text-blue-400' : 'text-gray-300'}>
                                            {item.name}
                                        </span>
                                        <span className="text-gray-500 text-xs">
                                            {item.costInGp ? `${item.costInGp}gp` : '-'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Deal Area */}
                    <div className="w-1/2 p-6 flex flex-col justify-center items-center bg-gray-800/30">
                        {selectedItem ? (
                            <div className="text-center w-full animate-in fade-in duration-300">
                                <div className="text-4xl mb-4">💰</div>
                                <h3 className="text-lg font-bold text-white mb-1">{selectedItem.name}</h3>
                                <p className="text-sm text-gray-400 mb-6 italic">{selectedItem.description}</p>

                                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 w-full mb-6">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-500">Market Value:</span>
                                        <span className="text-gray-300 decoration-line-through">{selectedItem.costInGp || '?'} gp</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2 mt-2">
                                        <span className="text-amber-500">Fence Offer:</span>
                                        <span className="text-amber-400">{getFencePrice(selectedItem)} gp</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSell}
                                    className="w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded shadow-lg transition-transform active:scale-95"
                                >
                                    Sell Item
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <div className="text-6xl mb-4 opacity-20">⚖️</div>
                                <p>Select an item to appraise.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-800 p-2 border-t border-gray-700 text-xs text-center text-gray-500">
                    Your Gold: <span className="text-yellow-500">{state.gold} gp</span>
                </div>
            </div>
        </div>
    );
};

export default FenceInterface;
