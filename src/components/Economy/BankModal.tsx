/**
 * This file renders the Bank and Financial Vault interface (BankModal).
 *
 * The Bank allows the player party to take out loans with local faction lenders,
 * repay outstanding debts to avoid collection enforcers, and invest capital
 * into lucrative merchant trade routes.
 *
 * It manages keyboard focus trapping for accessibility, calculates interest
 * rates based on faction standings, and syncs directly with the game's economy reducer.
 *
 * Called by: GameModals.tsx, PlayingScreen.tsx, or CommerceDesk.tsx
 * Depends on: WindowFrame, LoanSystem, GameContext, formatGpAsCoins
 */

// ============================================================================
// Imports
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
    AlertCircle,
    BadgeDollarSign,
    Building2,
    CheckCircle2,
    Coins,
    CreditCard,
    HandCoins,
    HelpCircle,
    Landmark,
    Percent,
    PiggyBank,
    Scale,
    ShieldAlert,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { getAvailableLenders } from '../../systems/economy/LoanSystem';
import { LoanOffer, PlayerInvestment, TradeRoute } from '../../types/economy';
import { formatGpAsCoins } from '../../utils/character';

// ============================================================================
// Props & Types
// ============================================================================
export interface BankModalProps {
    // Controls modal visibility
    isOpen?: boolean;
    // Callback when the player closes the bank modal
    onClose?: () => void;
    // Optional callback when taking a new loan
    onTakeLoan?: (offer: LoanOffer, amount: number, duration: number) => void;
    // Optional callback when repaying an existing debt
    onRepayLoan?: (investmentId: string, amount: number) => void;
    // Optional callback when investing capital in a caravan route
    onInvestInCaravan?: (routeId: string, amount: number) => void;
}

type BankTab = 'loans' | 'debts' | 'investments';

// ============================================================================
// Main Component
// ============================================================================
export const BankModal: React.FC<BankModalProps> = ({
    isOpen = true,
    onClose,
    onTakeLoan,
    onRepayLoan,
    onInvestInCaravan,
}) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<BankTab>('loans');
    const [selectedLoanOffer, setSelectedLoanOffer] = useState<LoanOffer | null>(null);
    const [loanAmount, setLoanAmount] = useState<number>(100);
    const [loanDuration, setLoanDuration] = useState<number>(30);

    // Active trade routes available for capital backing
    const activeRoutes = useMemo(
        () => (state.economy?.tradeRoutes || []).filter(r => r.status === 'active'),
        [state.economy?.tradeRoutes],
    );

    // Dynamic loan offers calculated from player faction standing and current wealth
    const loanOffers = useMemo(
        () => getAvailableLenders(state.factions, state.playerFactionStandings, state.gold),
        [state.factions, state.playerFactionStandings, state.gold],
    );

    // Existing outstanding loans owed by the player
    const existingLoans = useMemo(
        () => (state.playerInvestments || []).filter(inv => inv.type === 'loan'),
        [state.playerInvestments],
    );

    // Active caravan investments generating returns
    const activeInvestments = useMemo(
        () => (state.playerInvestments || []).filter(inv => inv.type === 'caravan'),
        [state.playerInvestments],
    );

    if (!isOpen) return null;

    // Handle taking out a new loan agreement
    const handleConfirmLoan = () => {
        if (!selectedLoanOffer || loanAmount <= 0) return;

        if (onTakeLoan) {
            onTakeLoan(selectedLoanOffer, loanAmount, loanDuration);
        } else {
            dispatch({
                type: 'TAKE_LOAN',
                payload: {
                    lenderId: selectedLoanOffer.lenderId,
                    factionId: selectedLoanOffer.factionId,
                    amount: loanAmount,
                    interestRate: selectedLoanOffer.interestRate,
                    durationDays: loanDuration,
                },
            });
        }
        setSelectedLoanOffer(null);
    };

    // Handle paying off an existing debt
    const handleRepayDebt = (investment: PlayerInvestment) => {
        const principal = investment.amount;
        const interest = Math.round(principal * (investment.interestRate || 0.1));
        const totalDue = principal + interest;

        if (state.gold < totalDue) return;

        if (onRepayLoan) {
            onRepayLoan(investment.id, totalDue);
        } else {
            dispatch({
                type: 'REPAY_LOAN',
                payload: { investmentId: investment.id, amount: totalDue },
            });
        }
    };

    return (
        <WindowFrame
            title="Merchant Bank & Vault"
            storageKey={WINDOW_KEYS.BANK}
            onClose={onClose}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
                {/* Header Banner with Player Gold Balance */}
                <div className="shrink-0 px-6 py-3 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Landmark className="w-5 h-5 text-amber-400" />
                        <div>
                            <div className="text-sm font-bold text-amber-200">Merchant Banking Guild</div>
                            <div className="text-xs text-slate-400">Lines of credit, secure deposits, and venture financing</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 font-bold text-sm">
                        <Wallet className="w-4 h-4 text-amber-400" />
                        <span>Purse: {formatGpAsCoins(state.gold || 0)}</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="shrink-0 px-6 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('loans')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'loans'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <HandCoins className="w-3.5 h-3.5" />
                        <span>Credit &amp; Loans ({loanOffers.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('debts')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'debts'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Active Debts ({existingLoans.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('investments')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'investments'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Caravan Backing ({activeInvestments.length})</span>
                    </button>
                </div>

                {/* Main Tab Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 scrollable-content">
                    {/* Tab 1: Available Loans */}
                    {activeTab === 'loans' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {loanOffers.length === 0 ? (
                                    <div className="col-span-2 p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800">
                                        <AlertCircle className="w-8 h-8 mx-auto text-amber-500/60 mb-2" />
                                        <p className="text-sm font-medium">No lenders are extending credit at this time.</p>
                                        <p className="text-xs text-slate-400 mt-1">Improve your faction reputation to qualify for financing.</p>
                                    </div>
                                ) : (
                                    loanOffers.map(offer => {
                                        const isSelected = selectedLoanOffer?.lenderId === offer.lenderId;

                                        return (
                                            <div
                                                key={offer.lenderId}
                                                className={`p-4 rounded-xl border transition-all ${
                                                    isSelected
                                                        ? 'bg-amber-950/30 border-amber-500/80 shadow-lg ring-1 ring-amber-500/30'
                                                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-100">{offer.lenderName}</h4>
                                                        <div className="text-xs text-slate-400 mt-0.5">{offer.factionName}</div>
                                                    </div>
                                                    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-950/60 text-amber-300 rounded border border-amber-800/40">
                                                        {Math.round(offer.interestRate * 100)}% Interest
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-slate-950/60 text-xs">
                                                    <div>
                                                        <span className="text-slate-400">Max Principal:</span>
                                                        <div className="font-bold text-amber-300">{offer.maxAmount} GP</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Terms:</span>
                                                        <div className="font-bold text-slate-200">{offer.minDurationDays}–{offer.maxDurationDays} Days</div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedLoanOffer(offer);
                                                        setLoanAmount(Math.min(offer.maxAmount, 100));
                                                        setLoanDuration(offer.minDurationDays || 30);
                                                    }}
                                                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 transition-colors cursor-pointer"
                                                >
                                                    {isSelected ? 'Configuring Agreement...' : 'Request Loan'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Loan Terms Configuration Modal/Card */}
                            {selectedLoanOffer && (
                                <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 shadow-xl space-y-4">
                                    <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                                        <Percent className="w-4 h-4" />
                                        <span>Draft Loan Contract: {selectedLoanOffer.lenderName}</span>
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div className="space-y-1">
                                            <label className="text-slate-300 font-medium">Borrow Amount (GP):</label>
                                            <input
                                                type="number"
                                                min={10}
                                                max={selectedLoanOffer.maxAmount}
                                                step={10}
                                                value={loanAmount}
                                                onChange={e => setLoanAmount(Math.max(10, Math.min(selectedLoanOffer.maxAmount, parseInt(e.target.value) || 10)))}
                                                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-slate-300 font-medium">Repayment Duration (Days):</label>
                                            <input
                                                type="number"
                                                min={selectedLoanOffer.minDurationDays}
                                                max={selectedLoanOffer.maxDurationDays}
                                                step={5}
                                                value={loanDuration}
                                                onChange={e => setLoanDuration(Math.max(selectedLoanOffer.minDurationDays, Math.min(selectedLoanOffer.maxDurationDays, parseInt(e.target.value) || 30)))}
                                                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                                        <span className="text-slate-400">Total Repayment Due (Principal + {Math.round(selectedLoanOffer.interestRate * 100)}% Interest):</span>
                                        <span className="text-sm font-bold text-amber-300">
                                            {Math.round(loanAmount * (1 + selectedLoanOffer.interestRate))} GP
                                        </span>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLoanOffer(null)}
                                            className="py-2 px-4 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmLoan}
                                            className="py-2 px-5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                                        >
                                            Sign Agreement (+{loanAmount} GP)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Active Debts */}
                    {activeTab === 'debts' && (
                        <div className="space-y-3">
                            {existingLoans.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800">
                                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60 mb-2" />
                                    <p className="text-sm font-medium">You have no outstanding debts.</p>
                                    <p className="text-xs text-slate-400 mt-1">Your ledger with all regional merchant factions is clear.</p>
                                </div>
                            ) : (
                                existingLoans.map(loan => {
                                    const interestRate = loan.interestRate || 0.1;
                                    const totalDue = Math.round(loan.amount * (1 + interestRate));
                                    const canAfford = (state.gold || 0) >= totalDue;

                                    return (
                                        <div
                                            key={loan.id}
                                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                                        >
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-100">{loan.lenderName || 'Merchant Line of Credit'}</h4>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    Borrowed: {loan.amount} GP • Due: {totalDue} GP ({Math.round(interestRate * 100)}% interest)
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRepayDebt(loan)}
                                                disabled={!canAfford}
                                                className="py-2 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                Repay {totalDue} GP
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Tab 3: Caravan Backing */}
                    {activeTab === 'investments' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeRoutes.length === 0 ? (
                                    <div className="col-span-2 p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800">
                                        <AlertCircle className="w-8 h-8 mx-auto text-amber-500/60 mb-2" />
                                        <p className="text-sm font-medium">No merchant routes are open for caravan backing.</p>
                                    </div>
                                ) : (
                                    activeRoutes.map(route => (
                                        <div
                                            key={route.id}
                                            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-amber-300">{route.name}</h4>
                                                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                    {route.originId} → {route.destinationId}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                Profitability: <span className="font-semibold text-emerald-400">+{route.profitability}%</span> • Risk:{' '}
                                                <span className="font-semibold text-amber-400">{Math.round(route.riskLevel * 100)}%</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onInvestInCaravan) {
                                                        onInvestInCaravan(route.id, 50);
                                                    } else {
                                                        dispatch({
                                                            type: 'INVEST_IN_CARAVAN',
                                                            payload: { tradeRouteId: route.id, goldAmount: 50 },
                                                        });
                                                    }
                                                }}
                                                disabled={(state.gold || 0) < 50}
                                                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                Back Caravan (50 GP)
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default BankModal;
