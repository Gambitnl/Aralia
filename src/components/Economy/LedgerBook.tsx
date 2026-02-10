/**
 * @file LedgerBook.tsx
 * Main economy UI styled as an enchanted ledger book.
 * Parchment texture, bookmark tabs for Treasury, Investments, Businesses, Debts.
 * The primary in-world interface for the player's financial life.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { useGameState } from '../../state/GameContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatGpAsCoins } from '../../utils/coinPurseUtils';
import CoinPurseDisplay from '../ui/CoinPurseDisplay';

type LedgerTab = 'treasury' | 'investments' | 'businesses' | 'debts';

const overlayMotion: MotionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const bookMotion: MotionProps = {
    initial: { scale: 0.9, opacity: 0, rotateY: -10 },
    animate: { scale: 1, opacity: 1, rotateY: 0 },
    exit: { scale: 0.9, opacity: 0, rotateY: 10 },
    transition: { type: 'spring', damping: 20 }
};

interface LedgerBookProps {
    isOpen: boolean;
    onClose: () => void;
}

const LedgerBook: React.FC<LedgerBookProps> = ({ isOpen, onClose }) => {
    const { state } = useGameState();
    const [activeTab, setActiveTab] = useState<LedgerTab>('treasury');
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

    const investments = useMemo(() => state.playerInvestments || [], [state.playerInvestments]);
    const businesses = useMemo(() => state.businesses || {}, [state.businesses]);
    const loans = useMemo(() => investments.filter(i => i.type === 'loan_taken' && i.status === 'active'), [investments]);
    const activeInvestments = useMemo(() => investments.filter(i => i.type !== 'loan_taken' && i.status === 'active'), [investments]);

    if (!isOpen) return null;

    const tabs: { id: LedgerTab; label: string; icon: string }[] = [
        { id: 'treasury', label: 'Treasury', icon: '💰' },
        { id: 'investments', label: 'Ventures', icon: '📜' },
        { id: 'businesses', label: 'Establishments', icon: '🏪' },
        { id: 'debts', label: 'Debts', icon: '⚖️' },
    ];

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
                    aria-label="Economy Ledger"
                    {...bookMotion}
                    className="bg-amber-950/95 border-2 border-amber-800/60 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col focus:outline-none"
                    style={{
                        backgroundImage: 'linear-gradient(135deg, rgba(120,53,15,0.3) 0%, rgba(60,20,5,0.5) 100%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={-1}
                >
                    {/* Book Cover Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b-2 border-amber-700/50">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📖</span>
                            <div>
                                <h2 className="text-2xl font-cinzel text-amber-300 tracking-wide">Enchanted Ledger</h2>
                                <p className="text-xs text-amber-600/80 italic">Magically updated. Mostly accurate.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <CoinPurseDisplay goldValue={state.gold} />
                            <button
                                onClick={onClose}
                                className="text-amber-600 hover:text-amber-300 text-2xl transition-colors"
                                aria-label="Close ledger"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Bookmark Tabs */}
                    <div className="flex border-b border-amber-800/40 bg-amber-900/30">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3 px-4 text-sm font-cinzel transition-colors flex items-center justify-center gap-2
                                    ${activeTab === tab.id
                                        ? 'text-amber-200 bg-amber-800/40 border-b-2 border-amber-400'
                                        : 'text-amber-600 hover:text-amber-400 hover:bg-amber-800/20'
                                    }`}
                                aria-selected={activeTab === tab.id}
                                role="tab"
                            >
                                <span aria-hidden="true">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Page Content */}
                    <div className="flex-grow overflow-y-auto p-6 scrollable-content">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'treasury' && (
                                    <TreasuryPage gold={state.gold} investments={investments} businesses={businesses} />
                                )}
                                {activeTab === 'investments' && (
                                    <InvestmentsPage investments={activeInvestments} />
                                )}
                                {activeTab === 'businesses' && (
                                    <BusinessesPage businesses={businesses} />
                                )}
                                {activeTab === 'debts' && (
                                    <DebtsPage loans={loans} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// --- Sub-pages ---

import { PlayerInvestment } from '../../types/economy';
import { BusinessState } from '../../types/business';

const TreasuryPage: React.FC<{
    gold: number;
    investments: PlayerInvestment[];
    businesses: Record<string, BusinessState>;
}> = ({ gold, investments, businesses }) => {
    const totalInvested = investments
        .filter(i => i.status === 'active' && i.type !== 'loan_taken')
        .reduce((sum, i) => sum + i.currentValue, 0);
    const totalDebt = investments
        .filter(i => i.status === 'active' && i.type === 'loan_taken')
        .reduce((sum, i) => sum + i.currentValue, 0);
    const businessCount = Object.keys(businesses).length;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-cinzel text-amber-300 border-b border-amber-700/30 pb-2">
                Treasury Overview
            </h3>

            <div className="grid grid-cols-2 gap-4">
                <LedgerEntry label="Gold on Hand" value={formatGpAsCoins(gold)} highlight />
                <LedgerEntry label="Invested Capital" value={formatGpAsCoins(totalInvested)} />
                <LedgerEntry label="Outstanding Debts" value={formatGpAsCoins(totalDebt)} negative={totalDebt > 0} />
                <LedgerEntry label="Net Worth" value={formatGpAsCoins(gold + totalInvested - totalDebt)} highlight />
            </div>

            <div className="mt-6 pt-4 border-t border-amber-700/30">
                <p className="text-amber-500/60 text-sm italic">
                    {businessCount > 0
                        ? `You own ${businessCount} establishment${businessCount > 1 ? 's' : ''}. Check the Establishments tab for daily reports.`
                        : 'You have no business establishments yet. Found one through a stronghold to begin generating income.'
                    }
                </p>
            </div>
        </div>
    );
};

const InvestmentsPage: React.FC<{ investments: PlayerInvestment[] }> = ({ investments }) => {
    if (investments.length === 0) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl block mb-4">📜</span>
                <p className="text-amber-500/60 italic">No active ventures. Visit a trading post or tavern to find opportunities.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-cinzel text-amber-300 border-b border-amber-700/30 pb-2">
                Active Ventures
            </h3>
            {investments.map(inv => (
                <div key={inv.id} className="bg-amber-900/30 border border-amber-800/40 rounded p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-cinzel text-amber-200 capitalize">{inv.type.replace('_', ' ')}</p>
                            <p className="text-xs text-amber-500/60 mt-1">
                                Invested: {formatGpAsCoins(inv.principalGold)} | Current: {formatGpAsCoins(inv.currentValue)}
                            </p>
                        </div>
                        <span className={`text-sm font-bold ${inv.currentValue >= inv.principalGold ? 'text-green-400' : 'text-red-400'}`}>
                            {inv.currentValue >= inv.principalGold ? '▲' : '▼'}
                            {' '}{Math.round(((inv.currentValue - inv.principalGold) / inv.principalGold) * 100)}%
                        </span>
                    </div>
                    {inv.type === 'caravan' && (
                        <p className="text-xs text-amber-500/40 mt-2">En route — estimated {inv.durationDays} day journey</p>
                    )}
                </div>
            ))}
        </div>
    );
};

const BusinessesPage: React.FC<{ businesses: Record<string, BusinessState> }> = ({ businesses }) => {
    const entries = Object.entries(businesses);

    if (entries.length === 0) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl block mb-4">🏪</span>
                <p className="text-amber-500/60 italic">No establishments owned. Found a business through a stronghold.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-cinzel text-amber-300 border-b border-amber-700/30 pb-2">
                Establishments
            </h3>
            {entries.map(([id, biz]) => (
                <div key={id} className="bg-amber-900/30 border border-amber-800/40 rounded p-4">
                    <div className="flex justify-between items-start mb-3">
                        <p className="font-cinzel text-amber-200 capitalize">{biz.businessType.replace('_', ' ')}</p>
                        <span className={`text-sm font-bold ${biz.lastDailyReport.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {biz.lastDailyReport.profit >= 0 ? '+' : ''}{formatGpAsCoins(biz.lastDailyReport.profit)}/day
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <MetricBar label="Customers" value={biz.metrics.customerSatisfaction} />
                        <MetricBar label="Reputation" value={biz.metrics.reputation} />
                        <MetricBar label="Supply" value={biz.metrics.supplyChainHealth} />
                    </div>
                    {biz.lastDailyReport.supplyIssues.length > 0 && (
                        <p className="text-xs text-red-400/70 mt-2 italic">
                            ⚠ {biz.lastDailyReport.supplyIssues[0]}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

const DebtsPage: React.FC<{ loans: PlayerInvestment[] }> = ({ loans }) => {
    if (loans.length === 0) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl block mb-4">⚖️</span>
                <p className="text-amber-500/60 italic">No outstanding debts. Your credit is clean.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-cinzel text-amber-300 border-b border-amber-700/30 pb-2">
                Outstanding Debts
            </h3>
            {loans.map(loan => (
                <div key={loan.id} className="bg-red-900/20 border border-red-800/40 rounded p-4">
                    <div className="flex justify-between">
                        <div>
                            <p className="font-cinzel text-red-300">Loan</p>
                            <p className="text-xs text-red-400/60 mt-1">
                                Borrowed: {formatGpAsCoins(loan.principalGold)} |
                                Owed: {formatGpAsCoins(loan.currentValue)}
                            </p>
                        </div>
                        <span className="text-sm text-red-400 font-bold">
                            {loan.interestRate ? `${(loan.interestRate * 100).toFixed(1)}% interest` : ''}
                        </span>
                    </div>
                    <p className="text-xs text-red-500/40 mt-2">
                        Due in {Math.max(0, loan.durationDays - (loan.lastUpdateDay - loan.startDay))} days
                    </p>
                </div>
            ))}
        </div>
    );
};

// --- Shared Components ---

const LedgerEntry: React.FC<{
    label: string;
    value: string;
    highlight?: boolean;
    negative?: boolean;
}> = ({ label, value, highlight, negative }) => (
    <div className={`p-3 rounded border ${highlight ? 'bg-amber-800/30 border-amber-600/40' : 'bg-amber-900/20 border-amber-800/30'}`}>
        <p className="text-xs text-amber-500/60 uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-cinzel mt-1 ${negative ? 'text-red-400' : highlight ? 'text-amber-200' : 'text-amber-400'}`}>
            {value}
        </p>
    </div>
);

const MetricBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div>
        <div className="flex justify-between text-amber-500/60 mb-1">
            <span>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${
                    value > 60 ? 'bg-green-500' : value > 30 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${value}%` }}
            />
        </div>
    </div>
);

export default LedgerBook;
