/**
 * @file InvestmentBoard.tsx
 * Tavern notice board UI with pinned parchments for investment opportunities.
 * Shows available caravan investments, loan offers, and speculation opportunities.
 * Styled as a wooden notice board with pinned notices.
 */
import React, { useMemo } from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { useGameState } from '../../state/GameContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getAvailableLenders } from '../../systems/economy/LoanSystem';
import { TradeRoute, LoanOffer } from '../../types/economy';
import { formatGpAsCoins } from '../../utils/coinPurseUtils';

const overlayMotion: MotionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const boardMotion: MotionProps = {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
};

interface InvestmentBoardProps {
    isOpen: boolean;
    onClose: () => void;
    onInvestInCaravan?: (routeId: string, amount: number) => void;
    onTakeLoan?: (offer: LoanOffer, amount: number, duration: number) => void;
}

const InvestmentBoard: React.FC<InvestmentBoardProps> = ({
    isOpen,
    onClose,
    onInvestInCaravan,
    onTakeLoan
}) => {
    const { state } = useGameState();
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

    const activeRoutes = useMemo(
        () => (state.economy?.tradeRoutes || []).filter(r => r.status === 'active'),
        [state.economy?.tradeRoutes]
    );

    const loanOffers = useMemo(
        () => getAvailableLenders(state.factions, state.playerFactionStandings, state.gold),
        [state.factions, state.playerFactionStandings, state.gold]
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                {...overlayMotion}
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-[var(--z-index-modal-background)] p-4"
                onClick={onClose}
            >
                <motion.div
                    ref={modalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Investment Notice Board"
                    {...boardMotion}
                    className="bg-amber-900/95 border-4 border-amber-800 rounded shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col focus:outline-none"
                    style={{
                        backgroundImage: 'linear-gradient(180deg, rgba(101,67,33,0.9) 0%, rgba(62,39,16,0.95) 100%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={-1}
                >
                    {/* Board Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b-2 border-amber-700/40">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📋</span>
                            <div>
                                <h2 className="text-xl font-cinzel text-amber-200">Notice Board</h2>
                                <p className="text-xs text-amber-600/60 italic">Investment opportunities & loan offers</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-amber-600 hover:text-amber-300 text-2xl transition-colors"
                            aria-label="Close notice board"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollable-content">
                        {/* Caravan Investments */}
                        <section>
                            <h3 className="text-lg font-cinzel text-amber-300 mb-3 flex items-center gap-2">
                                <span>🐪</span> Caravan Ventures
                            </h3>
                            {activeRoutes.length === 0 ? (
                                <p className="text-amber-500/50 italic text-sm">No active trade routes available for investment.</p>
                            ) : (
                                <div className="space-y-2">
                                    {activeRoutes.map(route => (
                                        <CaravanNotice
                                            key={route.id}
                                            route={route}
                                            playerGold={state.gold}
                                            onInvest={onInvestInCaravan}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Loan Offers */}
                        <section>
                            <h3 className="text-lg font-cinzel text-amber-300 mb-3 flex items-center gap-2">
                                <span>⚖️</span> Loan Offers
                            </h3>
                            {loanOffers.length === 0 ? (
                                <p className="text-amber-500/50 italic text-sm">No factions are willing to lend to you at this time.</p>
                            ) : (
                                <div className="space-y-2">
                                    {loanOffers.map(offer => (
                                        <LoanNotice
                                            key={offer.lenderId}
                                            offer={offer}
                                            onTakeLoan={onTakeLoan}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const CaravanNotice: React.FC<{
    route: TradeRoute;
    playerGold: number;
    onInvest?: (routeId: string, amount: number) => void;
}> = ({ route, playerGold, onInvest }) => {
    const riskLabel = route.riskLevel < 0.3 ? 'Low' : route.riskLevel < 0.6 ? 'Medium' : 'High';
    const riskColor = route.riskLevel < 0.3 ? 'text-green-400' : route.riskLevel < 0.6 ? 'text-amber-400' : 'text-red-400';
    const minInvestment = 100;
    const canInvest = playerGold >= minInvestment;

    return (
        <div className="bg-amber-800/20 border border-amber-700/30 rounded p-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-cinzel text-amber-200">{route.name}</p>
                    <p className="text-xs text-amber-500/60 mt-1">
                        {route.goods.join(', ')} | Profit potential: {route.profitability}%
                    </p>
                    <p className={`text-xs mt-1 ${riskColor}`}>
                        Risk: {riskLabel} ({(route.riskLevel * 100).toFixed(0)}%)
                    </p>
                </div>
                {onInvest && (
                    <button
                        onClick={() => onInvest(route.id, minInvestment)}
                        disabled={!canInvest}
                        className={`px-3 py-1.5 rounded text-xs font-cinzel transition-colors
                            ${canInvest
                                ? 'bg-green-800 hover:bg-green-700 text-green-200 border border-green-600'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                            }`}
                    >
                        Invest {formatGpAsCoins(minInvestment)}
                    </button>
                )}
            </div>
        </div>
    );
};

const LoanNotice: React.FC<{
    offer: LoanOffer;
    onTakeLoan?: (offer: LoanOffer, amount: number, duration: number) => void;
}> = ({ offer, onTakeLoan }) => (
    <div className="bg-red-900/10 border border-red-800/30 rounded p-3">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-cinzel text-amber-200">{offer.lenderName}</p>
                <p className="text-xs text-amber-500/60 mt-1">
                    Up to {formatGpAsCoins(offer.maxAmount)} |
                    {' '}{(offer.interestRate * 100).toFixed(1)}% interest |
                    {' '}{offer.minDuration}-{offer.maxDuration} days
                </p>
                {offer.collateralRequired === 'stronghold' && (
                    <p className="text-xs text-red-400/60 mt-1 italic">Requires stronghold as collateral</p>
                )}
            </div>
            {onTakeLoan && (
                <button
                    onClick={() => onTakeLoan(offer, Math.min(1000, offer.maxAmount), offer.minDuration)}
                    className="px-3 py-1.5 rounded text-xs font-cinzel bg-amber-800 hover:bg-amber-700 text-amber-200 border border-amber-600 transition-colors"
                >
                    Negotiate
                </button>
            )}
        </div>
    </div>
);

export default InvestmentBoard;
