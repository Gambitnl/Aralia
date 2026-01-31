/**
 * @file CraftingTab.tsx
 * Entry point tab for crafting systems within the character sheet.
 * Provides buttons to open Gathering and Alchemy Bench panels.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GatheringPanel, AlchemyBenchPanel } from '../../Crafting';

interface CraftingTabProps {
    disabled?: boolean;
}

export const CraftingTab: React.FC<CraftingTabProps> = ({ disabled = false }) => {
    const [isGatheringPanelOpen, setIsGatheringPanelOpen] = useState(false);
    const [isAlchemyBenchOpen, setIsAlchemyBenchOpen] = useState(false);

    return (
        <>
            {/* Gathering Panel Modal Overlay */}
            {isGatheringPanelOpen && (
                <div className="fixed inset-0 z-[var(--z-index-modal-background)] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <GatheringPanel onClose={() => setIsGatheringPanelOpen(false)} />
                </div>
            )}

            {/* Alchemy Bench Modal Overlay */}
            {isAlchemyBenchOpen && (
                <div className="fixed inset-0 z-[var(--z-index-modal-background)] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <AlchemyBenchPanel onClose={() => setIsAlchemyBenchOpen(false)} />
                </div>
            )}

            <div className="h-full flex flex-col gap-6 p-4">
                <h2 className="text-xl font-semibold text-amber-300">Crafting & Gathering</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Gathering Button */}
                    <motion.button
                        onClick={() => setIsGatheringPanelOpen(true)}
                        disabled={disabled}
                        whileTap={!disabled ? { scale: 0.98 } : undefined}
                        whileHover={!disabled ? { scale: 1.02 } : undefined}
                        className={`
              flex flex-col items-center gap-3 p-6 rounded-xl
              border-2 transition-all duration-200
              ${!disabled
                                ? 'bg-gradient-to-br from-green-900/60 to-green-800/40 border-green-600/50 hover:border-green-400 hover:shadow-lg hover:shadow-green-900/30 text-white cursor-pointer'
                                : 'bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed'
                            }
            `}
                    >
                        <span className="text-4xl">🌿</span>
                        <span className="text-lg font-medium">Gather Resources</span>
                        <span className="text-sm text-gray-300/80">Harvest herbs, minerals, and materials from the world</span>
                    </motion.button>

                    {/* Alchemy Bench Button */}
                    <motion.button
                        onClick={() => setIsAlchemyBenchOpen(true)}
                        disabled={disabled}
                        whileTap={!disabled ? { scale: 0.98 } : undefined}
                        whileHover={!disabled ? { scale: 1.02 } : undefined}
                        className={`
              flex flex-col items-center gap-3 p-6 rounded-xl
              border-2 transition-all duration-200
              ${!disabled
                                ? 'bg-gradient-to-br from-purple-900/60 to-purple-800/40 border-purple-600/50 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-900/30 text-white cursor-pointer'
                                : 'bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed'
                            }
            `}
                    >
                        <span className="text-4xl">⚗️</span>
                        <span className="text-lg font-medium">Alchemy Bench</span>
                        <span className="text-sm text-gray-300/80">Brew potions, craft poisons, and create magical items</span>
                    </motion.button>
                </div>
            </div>
        </>
    );
};

export default CraftingTab;
