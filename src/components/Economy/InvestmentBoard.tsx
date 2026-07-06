/**
 * @file InvestmentBoard.tsx
 * Tavern notice board UI with pinned parchments for investment opportunities.
 * Shows available caravan investments, loan offers, and speculation opportunities.
 * Styled as a wooden notice board with pinned notices.
 */
import React, { useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { getAvailableLenders } from '../../systems/economy/LoanSystem';
import { TradeRoute, LoanOffer } from '../../types/economy';
import { formatGpAsCoins } from '../../utils/coinPurseUtils';

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
        <WindowFrame
            // This title deliberately includes "Investment" so players and
            // assistive tech can distinguish the economy board from the town
            // notice board that uses the same in-world prop.
            title="Investment Notice Board"
            onClose={onClose}
            storageKey={WINDOW_KEYS.INVESTMENT_BOARD}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-amber-900/20">
                {/* Flavor line (was a header subtitle). */}
                <div className="shrink-0 px-6 py-1 text-xs text-amber-600/60 italic border-b border-amber-700/30">
                    Investment opportunities &amp; loan offers
                </div>

                {/* Content */}
                <div className="flex-grow min-h-0 overflow-y-auto p-6 space-y-6 scrollable-content">
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
            </div>
        </WindowFrame>
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
