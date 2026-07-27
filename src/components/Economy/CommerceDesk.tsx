/**
 * @file CommerceDesk.tsx
 * The Commerce Desk — the player's dedicated in-world home for commerce
 * (economy E-G1). One non-debug surface to inspect and manage businesses,
 * read the trade map, track ventures/debts, and review courier intel.
 *
 * Deeper single-purpose surfaces (Enchanted Ledger, Investment Notice Board,
 * Trade Route Monitor, Courier Pouch) stay reachable from here, but the desk
 * itself reads live state and carries the management affordances:
 * tend a business, dismiss a manager, set stronghold prices, collect matured
 * ventures, repay loans.
 */
import React, { useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { formatGpAsCoins } from '../../utils/coinPurseUtils';
import CoinPurseDisplay from '../ui/CoinPurseDisplay';
import { getGameDay } from '../../utils/core';
import {
    CommerceHolding,
    selectCourierIntel,
    selectPlayerHoldings,
    selectTradeOutlook,
    selectVenturesSummary,
} from './commerceDeskSelectors';
import { MarketEvent, PlayerInvestment, TradeRoute } from '../../types/economy';

type DeskTab = 'holdings' | 'trade' | 'ventures' | 'couriers';

interface CommerceDeskProps {
    isOpen: boolean;
    onClose: () => void;
}

const TAB_DEFS: { id: DeskTab; label: string; icon: string }[] = [
    { id: 'holdings', label: 'Holdings', icon: '🏪' },
    { id: 'trade', label: 'Trade Map', icon: '🗺️' },
    { id: 'ventures', label: 'Ventures', icon: '📜' },
    { id: 'couriers', label: 'Couriers', icon: '✉️' },
];

const CommerceDesk: React.FC<CommerceDeskProps> = ({ isOpen, onClose }) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<DeskTab>('holdings');

    const currentDay = getGameDay(state.gameTime);
    const holdings = useMemo(
        () => selectPlayerHoldings(state.worldBusinesses, state.businesses),
        [state.worldBusinesses, state.businesses],
    );
    const outlook = useMemo(() => selectTradeOutlook(state.economy), [state.economy]);
    const ventures = useMemo(
        () => selectVenturesSummary(state.playerInvestments),
        [state.playerInvestments],
    );
    const couriers = useMemo(
        () => selectCourierIntel(state.pendingCouriers, currentDay),
        [state.pendingCouriers, currentDay],
    );

    if (!isOpen) return null;

    const attentionCount =
        holdings.filter(h => h.needsAttention).length + ventures.collectible.length;

    return (
        <WindowFrame
            title="Commerce Desk"
            onClose={onClose}
            storageKey={WINDOW_KEYS.COMMERCE_DESK}
            initialMaximized={false}
            headerActions={<CoinPurseDisplay goldValue={state.gold} />}
        >
            <div className="flex flex-col h-full bg-amber-950/20">
                {/* Standing summary strip */}
                <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-amber-800/40 bg-amber-900/20">
                    <DeskStat label="Establishments" value={String(holdings.length)} />
                    <DeskStat label="Routes Flowing" value={`${outlook.activeCount + outlook.boomingCount}/${outlook.routes.length}`} />
                    <DeskStat label="Capital Out" value={formatGpAsCoins(ventures.totalInvested)} />
                    <DeskStat
                        label="Needs Attention"
                        value={String(attentionCount)}
                        alert={attentionCount > 0}
                    />
                </div>

                {/* Tabs */}
                <div className="shrink-0 grid grid-cols-2 border-b border-amber-800/40 bg-amber-900/30 sm:flex" role="tablist">
                    {TAB_DEFS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`min-h-11 py-3 px-3 text-sm font-cinzel transition-colors flex items-center justify-center gap-2 sm:flex-1 sm:px-4
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

                {/* Page content */}
                <div className="flex-grow min-h-0 overflow-y-auto p-4 sm:p-6 scrollable-content">
                    {activeTab === 'holdings' && (
                        <HoldingsPage
                            holdings={holdings}
                            onTend={(id) => dispatch({ type: 'MANAGE_BUSINESS', payload: { businessId: id } })}
                            onDismissManager={(id) => dispatch({ type: 'REMOVE_MANAGER', payload: { businessId: id } })}
                            onSetPrices={(id, priceMultiplier) =>
                                dispatch({ type: 'SET_BUSINESS_PRICES', payload: { businessId: id, priceMultiplier } })
                            }
                            strongholdBusinesses={state.businesses || {}}
                        />
                    )}
                    {activeTab === 'trade' && (
                        <TradePage
                            outlook={outlook}
                            onOpenMonitor={() => dispatch({ type: 'TOGGLE_TRADE_ROUTE_DASHBOARD' })}
                            onOpenBoard={() => dispatch({ type: 'TOGGLE_INVESTMENT_BOARD' })}
                        />
                    )}
                    {activeTab === 'ventures' && (
                        <VenturesPage
                            ventures={ventures}
                            gold={state.gold}
                            onCollect={(id) => dispatch({ type: 'COLLECT_INVESTMENT', payload: { investmentId: id } })}
                            onRepay={(loan, amount) =>
                                dispatch({ type: 'REPAY_LOAN', payload: { investmentId: loan.id, amount } })
                            }
                            onOpenLedger={() => dispatch({ type: 'TOGGLE_ECONOMY_LEDGER' })}
                        />
                    )}
                    {activeTab === 'couriers' && (
                        <CouriersPage
                            delivered={couriers.delivered}
                            enRoute={couriers.enRoute}
                            currentDay={currentDay}
                            onOpenPouch={() => dispatch({ type: 'TOGGLE_COURIER_POUCH' })}
                        />
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

// --- Shared bits ---

const DeskStat: React.FC<{ label: string; value: string; alert?: boolean }> = ({ label, value, alert }) => (
    <div className={`p-2 rounded border ${alert ? 'bg-red-900/30 border-red-700/50' : 'bg-amber-900/20 border-amber-800/30'}`}>
        <p className="text-[10px] text-amber-500/60 uppercase tracking-wider">{label}</p>
        <p className={`text-base font-cinzel ${alert ? 'text-red-300' : 'text-amber-200'}`}>{value}</p>
    </div>
);

const MetricBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div>
        <div className="flex justify-between text-amber-500/60 mb-1 text-xs">
            <span>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${
                    value > 60 ? 'bg-green-500' : value > 30 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
            />
        </div>
    </div>
);

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-lg font-cinzel text-amber-300 border-b border-amber-700/30 pb-2 mb-3">
        {children}
    </h3>
);

const DeskLinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        onClick={onClick}
        className="px-3 py-1.5 rounded text-xs font-cinzel bg-amber-800/60 hover:bg-amber-700 text-amber-200 border border-amber-600/60 transition-colors"
    >
        {children}
    </button>
);

// --- Holdings ---

import { BusinessState } from '../../types/business';

const HoldingsPage: React.FC<{
    holdings: CommerceHolding[];
    strongholdBusinesses: Record<string, BusinessState>;
    onTend: (businessId: string) => void;
    onDismissManager: (businessId: string) => void;
    onSetPrices: (businessId: string, priceMultiplier: number) => void;
}> = ({ holdings, strongholdBusinesses, onTend, onDismissManager, onSetPrices }) => {
    if (holdings.length === 0) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl block mb-4">🏪</span>
                <p className="text-amber-500/60 italic">
                    You own no establishments yet. Buy into a business in town, accept a faction grant, or found one fresh.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionHeading>Your Establishments</SectionHeading>
            {holdings.map(holding => (
                <div
                    key={`${holding.kind}-${holding.id}`}
                    className={`rounded border p-4 ${holding.needsAttention ? 'bg-red-900/15 border-red-800/40' : 'bg-amber-900/30 border-amber-800/40'}`}
                >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div>
                            <p className="font-cinzel text-amber-200">{holding.name}</p>
                            <p className="text-xs text-amber-500/60 capitalize">
                                {holding.businessType.replace(/_/g, ' ')}
                                {holding.kind === 'stronghold' ? ' · stronghold' : ''}
                            </p>
                        </div>
                        {/* gpToCoins clamps negatives to zero, so format the magnitude and sign it ourselves. */}
                        <span className={`text-sm font-bold ${holding.profitPerDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {holding.profitPerDay >= 0 ? '+' : '−'}{formatGpAsCoins(Math.abs(holding.profitPerDay))}/day
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <MetricBar label="Customers" value={holding.metrics.customerSatisfaction} />
                        <MetricBar label="Reputation" value={holding.metrics.reputation} />
                        <MetricBar label="Supply" value={holding.metrics.supplyChainHealth} />
                    </div>

                    {holding.supplyIssues.length > 0 && (
                        <p className="text-xs text-red-400/70 mb-2 italic">⚠ {holding.supplyIssues[0]}</p>
                    )}

                    {holding.kind === 'world' && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-800/30">
                            <span className="text-xs text-amber-500/60">
                                {holding.managerId
                                    ? `Managed (${holding.managerEfficiency ?? 0}% efficiency)`
                                    : holding.needsAttention
                                        ? `Untended for ${holding.daysSinceManaged} days — reputation is slipping`
                                        : `Tended ${holding.daysSinceManaged === 0 ? 'today' : `${holding.daysSinceManaged} day${holding.daysSinceManaged === 1 ? '' : 's'} ago`}`}
                            </span>
                            <div className="ml-auto flex gap-2">
                                <DeskLinkButton onClick={() => onTend(holding.id)}>Tend the Counter</DeskLinkButton>
                                {holding.managerId && (
                                    <DeskLinkButton onClick={() => onDismissManager(holding.id)}>Dismiss Manager</DeskLinkButton>
                                )}
                            </div>
                        </div>
                    )}

                    {holding.kind === 'stronghold' && (
                        <PriceControl
                            multiplier={strongholdBusinesses[holding.id]?.priceMultiplier ?? 1}
                            onChange={(next) => onSetPrices(holding.id, next)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

const PriceControl: React.FC<{ multiplier: number; onChange: (next: number) => void }> = ({ multiplier, onChange }) => (
    <div className="flex items-center gap-2 pt-2 border-t border-amber-800/30">
        <span className="text-xs text-amber-500/60">Prices:</span>
        <button
            onClick={() => onChange(Math.round((multiplier - 0.1) * 10) / 10)}
            disabled={multiplier <= 0.5}
            className="w-7 h-7 rounded bg-amber-800/60 hover:bg-amber-700 disabled:opacity-40 text-amber-200 border border-amber-600/60"
            aria-label="Lower prices"
        >
            −
        </button>
        <span className="text-sm text-amber-200 font-cinzel w-12 text-center">{Math.round(multiplier * 100)}%</span>
        <button
            onClick={() => onChange(Math.round((multiplier + 0.1) * 10) / 10)}
            disabled={multiplier >= 2}
            className="w-7 h-7 rounded bg-amber-800/60 hover:bg-amber-700 disabled:opacity-40 text-amber-200 border border-amber-600/60"
            aria-label="Raise prices"
        >
            +
        </button>
        <span className="ml-2 text-[10px] text-amber-600/60 italic">
            {multiplier > 1.3 ? 'Steep — customers may walk' : multiplier < 0.8 ? 'Cheap — thin margins' : 'Fair dealing'}
        </span>
    </div>
);

// --- Trade map ---

const routeStatusStyle: Record<TradeRoute['status'], string> = {
    active: 'bg-green-900/40 text-green-300 border-green-700/50',
    booming: 'bg-amber-800/40 text-amber-300 border-amber-600/50',
    disrupted: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
    blockaded: 'bg-red-900/40 text-red-300 border-red-700/50',
};

const TradePage: React.FC<{
    outlook: ReturnType<typeof selectTradeOutlook>;
    onOpenMonitor: () => void;
    onOpenBoard: () => void;
}> = ({ outlook, onOpenMonitor, onOpenBoard }) => (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Roads &amp; Markets</SectionHeading>
            <div className="flex gap-2">
                <DeskLinkButton onClick={onOpenMonitor}>Open Route Monitor</DeskLinkButton>
                <DeskLinkButton onClick={onOpenBoard}>Investment Board</DeskLinkButton>
            </div>
        </div>

        {outlook.routes.length === 0 ? (
            <p className="text-amber-500/60 italic text-sm">No trade routes are known to you yet.</p>
        ) : (
            <div className="space-y-2">
                {outlook.routes.map(route => (
                    <div key={route.id} className="flex items-center gap-3 bg-amber-900/25 border border-amber-800/40 rounded p-3">
                        <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${routeStatusStyle[route.status]}`}>
                            {route.status}
                        </span>
                        <div className="min-w-0">
                            <p className="font-cinzel text-amber-200 text-sm truncate">{route.name}</p>
                            <p className="text-xs text-amber-500/60 truncate">
                                {route.goods.join(', ')} · profit {route.profitability}% · risk {(route.riskLevel * 100).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <div>
            <h4 className="text-sm font-cinzel text-amber-300 mb-2">Market Word</h4>
            {outlook.shortages.length + outlook.surpluses.length + outlook.otherEvents.length === 0 ? (
                <p className="text-amber-500/60 italic text-sm">Trade is flowing normally. No unusual market word.</p>
            ) : (
                <ul className="space-y-1 text-sm">
                    {outlook.shortages.map(e => <MarketLine key={e.id} event={e} tone="text-red-300" fallback="Shortage" />)}
                    {outlook.surpluses.map(e => <MarketLine key={e.id} event={e} tone="text-green-300" fallback="Surplus" />)}
                    {outlook.otherEvents.map(e => <MarketLine key={e.id} event={e} tone="text-purple-300" fallback={e.type} />)}
                </ul>
            )}
        </div>
    </div>
);

const MarketLine: React.FC<{ event: MarketEvent; tone: string; fallback: string }> = ({ event, tone, fallback }) => (
    <li className="flex gap-2 items-baseline">
        <span className={`shrink-0 text-xs font-bold uppercase ${tone}`}>{event.name || fallback}</span>
        <span className="text-amber-500/60 text-xs truncate">
            {event.description || (event.affectedTags?.length ? event.affectedTags.join(', ') : 'regional markets')}
        </span>
    </li>
);

// --- Ventures ---

const VenturesPage: React.FC<{
    ventures: ReturnType<typeof selectVenturesSummary>;
    gold: number;
    onCollect: (investmentId: string) => void;
    onRepay: (loan: PlayerInvestment, amount: number) => void;
    onOpenLedger: () => void;
}> = ({ ventures, gold, onCollect, onRepay, onOpenLedger }) => (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Ventures &amp; Obligations</SectionHeading>
            <DeskLinkButton onClick={onOpenLedger}>Open Full Ledger</DeskLinkButton>
        </div>

        {ventures.collectible.length > 0 && (
            <section>
                <h4 className="text-sm font-cinzel text-green-300 mb-2">Ready to Collect</h4>
                <div className="space-y-2">
                    {ventures.collectible.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between bg-green-900/20 border border-green-800/40 rounded p-3">
                            <div>
                                <p className="font-cinzel text-amber-200 capitalize text-sm">{inv.type.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-amber-500/60">
                                    Staked {formatGpAsCoins(inv.principalGold)} — pays {formatGpAsCoins(inv.currentValue)}
                                </p>
                            </div>
                            <button
                                onClick={() => onCollect(inv.id)}
                                className="px-3 py-1.5 rounded text-xs font-cinzel bg-green-800 hover:bg-green-700 text-green-200 border border-green-600 transition-colors"
                            >
                                Collect {formatGpAsCoins(inv.currentValue)}
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        )}

        <section>
            <h4 className="text-sm font-cinzel text-amber-300 mb-2">Working Capital</h4>
            {ventures.active.length === 0 ? (
                <p className="text-amber-500/60 italic text-sm">
                    No coin at work. The Investment Board lists caravan shares and loan offers.
                </p>
            ) : (
                <div className="space-y-2">
                    {ventures.active.map(inv => (
                        <div key={inv.id} className="bg-amber-900/25 border border-amber-800/40 rounded p-3 flex justify-between items-center">
                            <div>
                                <p className="font-cinzel text-amber-200 capitalize text-sm">{inv.type.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-amber-500/60">
                                    In: {formatGpAsCoins(inv.principalGold)} · now {formatGpAsCoins(inv.currentValue)}
                                </p>
                            </div>
                            <span className={`text-sm font-bold ${inv.currentValue >= inv.principalGold ? 'text-green-400' : 'text-red-400'}`}>
                                {inv.currentValue >= inv.principalGold ? '▲' : '▼'}{' '}
                                {inv.principalGold > 0 ? Math.round(((inv.currentValue - inv.principalGold) / inv.principalGold) * 100) : 0}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>

        <section>
            <h4 className="text-sm font-cinzel text-red-300 mb-2">Debts</h4>
            {ventures.loans.length === 0 ? (
                <p className="text-amber-500/60 italic text-sm">No outstanding debts. Your credit is clean.</p>
            ) : (
                <div className="space-y-2">
                    {ventures.loans.map(loan => {
                        const repayAmount = Math.min(gold, loan.currentValue);
                        return (
                            <div key={loan.id} className="bg-red-900/15 border border-red-800/40 rounded p-3 flex justify-between items-center">
                                <div>
                                    <p className="font-cinzel text-red-300 text-sm">Loan</p>
                                    <p className="text-xs text-red-400/60">
                                        Owed {formatGpAsCoins(loan.currentValue)}
                                        {loan.interestRate ? ` · ${(loan.interestRate * 100).toFixed(1)}% interest` : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onRepay(loan, repayAmount)}
                                    disabled={repayAmount <= 0}
                                    className="px-3 py-1.5 rounded text-xs font-cinzel bg-red-900/60 hover:bg-red-800 disabled:opacity-40 text-red-200 border border-red-700 transition-colors"
                                >
                                    Repay {formatGpAsCoins(repayAmount)}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    </div>
);

// --- Couriers ---

import { PendingCourier } from '../../types/economy';

const COURIER_ICONS: Record<string, string> = {
    business_report: '📊',
    investment_result: '💰',
    market_intel: '🗺️',
    loan_notice: '⚖️',
    faction_edict: '📜',
};

const CouriersPage: React.FC<{
    delivered: PendingCourier[];
    enRoute: PendingCourier[];
    currentDay: number;
    onOpenPouch: () => void;
}> = ({ delivered, enRoute, currentDay, onOpenPouch }) => (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Courier Intel</SectionHeading>
            <DeskLinkButton onClick={onOpenPouch}>Open Courier Pouch</DeskLinkButton>
        </div>

        <section>
            <h4 className="text-sm font-cinzel text-amber-300 mb-2">Latest Word ({delivered.length})</h4>
            {delivered.length === 0 ? (
                <p className="text-amber-500/60 italic text-sm">No reports have reached you yet.</p>
            ) : (
                <div className="space-y-2">
                    {delivered.slice(0, 6).map(msg => (
                        <div key={msg.id} className="flex gap-3 bg-amber-900/25 border border-amber-800/40 rounded p-3">
                            <span className="text-lg" aria-hidden="true">{COURIER_ICONS[msg.type] || '📜'}</span>
                            <div className="min-w-0">
                                <p className="text-sm text-amber-200">{msg.messageText}</p>
                                <p className="text-xs text-amber-600/50 mt-1">
                                    From {msg.sourceRegionId.replace(/_/g, ' ')} · day {msg.deliveryDay}
                                    {msg.accuracy < 0.8 && <span className="italic"> · rumor</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>

        <section>
            <h4 className="text-sm font-cinzel text-amber-300 mb-2">On the Road ({enRoute.length})</h4>
            {enRoute.length === 0 ? (
                <p className="text-amber-500/60 italic text-sm">No couriers are en route to you.</p>
            ) : (
                <ul className="space-y-1 text-sm">
                    {enRoute.map(msg => (
                        <li key={msg.id} className="flex justify-between text-amber-500/70">
                            <span>Sealed dispatch from {msg.sourceRegionId.replace(/_/g, ' ')}</span>
                            <span className="text-amber-600/50 text-xs">
                                arrives in {msg.deliveryDay - currentDay} day{msg.deliveryDay - currentDay === 1 ? '' : 's'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    </div>
);

export default CommerceDesk;
