import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Action, Item } from '../types';
import { Temple, TempleService } from '../types/deity';
import { useGameState } from '../state/GameContext';
import { formatGpAsCoins } from '../utils/coinPurseUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Tooltip from './Tooltip';
import { DEITIES } from '../data/deities';
import { getDivineStanding } from '../utils/religionUtils';

interface TempleModalProps {
    isOpen: boolean;
    temple: Temple;
    playerGold: number;
    onClose: () => void;
    onAction: (action: Action) => void;
}

const TempleModal: React.FC<TempleModalProps> = ({
    isOpen,
    temple,
    playerGold,
    onClose,
    onAction
}) => {
    const { state } = useGameState();
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
    const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

    const deity = useMemo(() => DEITIES.find(d => d.id === temple.deityId), [temple.deityId]);
    const divineFavor = state.divineFavor[temple.deityId] || { favor: 0, blessings: [], transgressions: [], history: [], deityId: temple.deityId };
    const standing = getDivineStanding(divineFavor.favor);

    const handleService = (service: TempleService) => {
        if (playerGold >= service.costGp) {
            onAction({
                type: 'USE_TEMPLE_SERVICE',
                label: `Purchase ${service.name}`,
                payload: {
                    templeId: temple.id,
                    deityId: temple.deityId, // Explicitly pass deityId to reducer
                    serviceId: service.id,
                    cost: service.costGp,
                    effect: service.mechanicalEffect
                }
            });
            setLastActionMessage(`Purchased ${service.name}`);
            setTimeout(() => setLastActionMessage(null), 3000);
        }
    };

    if (!isOpen || !deity) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={temple.name}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-gray-900 border border-amber-700/50 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col focus:outline-none overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="relative p-6 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-amber-800">
                    <div className="absolute top-0 right-0 p-4">
                         <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-3xl transition-colors"
                            aria-label="Close temple"
                        >&times;</button>
                    </div>

                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 bg-amber-900/30 rounded-full flex items-center justify-center border-2 border-amber-600/50 text-3xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            {/* Placeholder for deity symbol */}
                            <span>☀️</span>
                        </div>
                        <div>
                            <h2 className="text-3xl font-cinzel text-amber-100">{temple.name}</h2>
                            <p className="text-amber-400/80 italic font-serif">{deity.titles[0]}</p>
                            <div className="mt-2 flex items-center gap-3 text-sm">
                                <span className="bg-amber-900/40 px-2 py-0.5 rounded text-amber-200 border border-amber-800/50">
                                    {deity.alignment}
                                </span>
                                <span className="text-gray-400">Domains: {deity.domains.join(', ')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-grow flex overflow-hidden">
                    {/* Left Column: Services */}
                    <div className="w-2/3 p-6 overflow-y-auto border-r border-gray-800 scrollable-content">
                        <h3 className="text-xl font-cinzel text-amber-200 mb-4 flex items-center gap-2">
                            <span>Temple Services</span>
                            <div className="h-px bg-amber-800/50 flex-grow"></div>
                        </h3>

                        {lastActionMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded text-green-200 text-center text-sm"
                            >
                                {lastActionMessage}
                            </motion.div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            {temple.services.map((service) => {
                                const canAfford = playerGold >= service.costGp;
                                const favorReqMet = (service.minFavor || -100) <= divineFavor.favor;
                                const isLocked = !favorReqMet;

                                return (
                                    <div
                                        key={service.id}
                                        className={`
                                            relative p-4 rounded-lg border transition-all duration-200
                                            ${isLocked
                                                ? 'bg-gray-950 border-gray-800 opacity-60'
                                                : 'bg-gray-800/40 border-gray-700 hover:border-amber-600/50 hover:bg-gray-800/60'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className={`font-cinzel text-lg ${isLocked ? 'text-gray-500' : 'text-amber-100'}`}>
                                                    {service.name}
                                                </h4>
                                                <p className="text-sm text-gray-400 mt-1 max-w-md">{service.description}</p>
                                                {isLocked && (
                                                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                        <span>🔒 Requires higher standing ({getDivineStanding(service.minFavor || 0)})</span>
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`font-cinzel font-bold ${canAfford ? 'text-amber-400' : 'text-red-400'}`}>
                                                    {formatGpAsCoins(service.costGp)}
                                                </span>
                                                <button
                                                    onClick={() => handleService(service)}
                                                    disabled={isLocked || !canAfford}
                                                    className={`
                                                        px-4 py-1.5 rounded text-sm font-bold uppercase tracking-wider transition-colors
                                                        ${isLocked || !canAfford
                                                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                                            : 'bg-amber-700 hover:bg-amber-600 text-white shadow-lg shadow-amber-900/20'
                                                        }
                                                    `}
                                                >
                                                    {isLocked ? 'Locked' : 'Partake'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Information & Favor */}
                    <div className="w-1/3 bg-gray-950/50 p-6 overflow-y-auto">
                         <div className="mb-8">
                            <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-3">Your Standing</h3>
                            <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 text-center">
                                <div className="text-4xl font-cinzel text-amber-100 mb-1">{divineFavor.favor}</div>
                                <div className="text-amber-500 font-serif italic">{standing}</div>
                                <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div
                                        className="bg-amber-600 h-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, Math.max(0, (divineFavor.favor + 100) / 2))}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-3">Tenets</h3>
                            <ul className="space-y-3">
                                {deity.commandments.map((c, i) => (
                                    <li key={i} className="text-gray-300 text-sm italic border-l-2 border-amber-800/30 pl-3">
                                        "{c}"
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-3">Divine Will</h3>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <span className="text-green-400 font-bold block mb-1">Approves</span>
                                    <ul className="space-y-1 text-gray-400">
                                        {deity.approves.map((a, i) => (
                                            <li key={i}>• {a.description}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <span className="text-red-400 font-bold block mb-1">Forbids</span>
                                    <ul className="space-y-1 text-gray-400">
                                        {deity.forbids.map((f, i) => (
                                            <li key={i}>• {f.description}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
                     <div className="flex items-center gap-2">
                        <span>Your Coin Purse:</span>
                        <span className="text-amber-200 font-bold text-base">{formatGpAsCoins(playerGold)}</span>
                    </div>
                    <div>
                        The gods are watching.
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default TempleModal;
