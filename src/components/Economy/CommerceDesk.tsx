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
import {
    AlertTriangle,
    CircleCheck,
    CircleDollarSign,
    Landmark,
    Mail,
    Map,
    PackageCheck,
    Route,
    Scale,
    ScrollText,
    Store,
    type LucideIcon,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { formatGpAsCoins } from '../../utils/character';
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

// ============================================================================
// Desk Navigation
// ============================================================================
// These definitions keep each section's icon and plain-language purpose in one
// place. The counts are supplied from live game state inside the panel below.
// ============================================================================
type DeskTab = 'holdings' | 'trade' | 'ventures' | 'couriers';

interface CommerceDeskProps {
    isOpen: boolean;
    onClose: () => void;
}

const TAB_DEFS: { id: DeskTab; label: string; description: string; icon: LucideIcon }[] = [
    { id: 'holdings', label: 'Holdings', description: 'Shops & strongholds', icon: Store },
    { id: 'trade', label: 'Trade Map', description: 'Routes & market word', icon: Map },
    { id: 'ventures', label: 'Ventures', description: 'Capital & debts', icon: ScrollText },
    { id: 'couriers', label: 'Couriers', description: 'Reports on the road', icon: Mail },
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

    // Small counts beside the navigation labels turn the rail into an at-a-glance
    // index. They mirror the same live collections rendered by each page.
    const tabCounts: Record<DeskTab, number> = {
        holdings: holdings.length,
        trade: outlook.routes.length,
        ventures: ventures.active.length + ventures.collectible.length + ventures.loans.length,
        couriers: couriers.delivered.length + couriers.enRoute.length,
    };

    return (
        <WindowFrame
            title="Commerce Desk"
            onClose={onClose}
            storageKey={WINDOW_KEYS.COMMERCE_DESK}
            initialMaximized={false}
            headerActions={<CoinPurseDisplay goldValue={state.gold} />}
        >
            <div className="flex h-full flex-col bg-[#100d0f] text-stone-200">
                {/* The overview is deliberately calm and ledger-like. Only the
                    attention card uses warning red, so genuine trouble stands out. */}
                <div className="shrink-0 border-b border-amber-900/50 bg-[#171216] px-4 py-4">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-500/70">Ledger overview</p>
                            <p className="mt-1 text-sm text-stone-400">Day {currentDay} · Your commercial interests at a glance</p>
                        </div>
                        <span className="rounded-full border border-amber-800/60 bg-amber-950/50 px-3 py-1 text-xs text-amber-200">
                            {attentionCount > 0 ? `${attentionCount} action${attentionCount === 1 ? '' : 's'} waiting` : 'All books balanced'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <DeskStat icon={Store} label="Establishments" value={String(holdings.length)} note="Under your banner" />
                    <DeskStat icon={Route} label="Routes flowing" value={`${outlook.activeCount + outlook.boomingCount}/${outlook.routes.length}`} note="Active or booming" />
                    <DeskStat icon={CircleDollarSign} label="Capital out" value={formatGpAsCoins(ventures.totalInvested)} note="Currently at work" />
                    <DeskStat
                        icon={AlertTriangle}
                        label="Needs Attention"
                        value={String(attentionCount)}
                        note="Holdings or payouts"
                        alert={attentionCount > 0}
                    />
                    </div>
                </div>

                {/* A vertical rail leaves more room for comparison inside the
                    selected page. On narrow screens it becomes a compact grid. */}
                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                    <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-amber-900/40 bg-[#151116] p-2 md:w-52 md:grid-cols-1 md:content-start md:border-b-0 md:border-r md:p-3" role="tablist" aria-label="Commerce desk sections">
                        {TAB_DEFS.map(tab => {
                            const Icon = tab.icon;
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`group flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected
                                        ? 'border-amber-700/70 bg-amber-950/70 text-amber-100 shadow-inner'
                                        : 'border-transparent text-stone-400 hover:border-amber-900/50 hover:bg-amber-950/30 hover:text-stone-200'
                                    }`}
                                    aria-selected={selected}
                                    role="tab"
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-amber-600 text-stone-950' : 'bg-stone-900 text-amber-600 group-hover:text-amber-400'}`}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-cinzel text-xs font-semibold sm:text-sm">{tab.label}</span>
                                        <span className="mt-0.5 hidden truncate text-[10px] text-stone-500 md:block">{tab.description}</span>
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${selected ? 'bg-amber-200/10 text-amber-200' : 'bg-stone-900 text-stone-500'}`}>
                                        {tabCounts[tab.id]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Each page shares a constrained reading width so a maximized
                        window still feels like a desk rather than an empty canvas. */}
                    <div className="scrollable-content min-h-0 flex-1 overflow-y-auto bg-[#110f13] p-4 sm:p-6">
                      <div className="mx-auto w-full max-w-5xl">
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
                </div>
            </div>
        </WindowFrame>
    );
};

// ============================================================================
// Shared Ledger Pieces
// ============================================================================
// These small pieces keep the status cards, health bars, headings, and actions
// visually consistent across every commerce page.
// ============================================================================

const DeskStat: React.FC<{ icon: LucideIcon; label: string; value: string; note: string; alert?: boolean }> = ({ icon: Icon, label, value, note, alert }) => (
    <div className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 ${alert ? 'border-red-800/60 bg-red-950/30' : 'border-amber-900/50 bg-black/20'}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${alert ? 'bg-red-900/50 text-red-300' : 'bg-amber-950 text-amber-500'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${alert ? 'text-red-400/70' : 'text-stone-500'}`}>{label}</p>
            <p className={`truncate font-cinzel text-base ${alert ? 'text-red-200' : 'text-amber-100'}`}>{value}</p>
            <p className="truncate text-[10px] text-stone-600">{note}</p>
        </div>
    </div>
);

const MetricBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div>
        <div className="mb-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wide text-stone-500">
            <span>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5">
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
    <div className="mb-4 border-b border-amber-900/50 pb-3">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-600">Commerce desk</p>
        <h3 className="font-cinzel text-lg text-amber-100">{children}</h3>
    </div>
);

const DeskLinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        onClick={onClick}
        className="min-h-10 rounded-md border border-amber-700/70 bg-amber-900/60 px-3 py-2 font-cinzel text-xs text-amber-100 transition-colors hover:border-amber-500 hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
        {children}
    </button>
);

// ============================================================================
// Holdings
// ============================================================================
// The holdings page compares each establishment's health, profit, management,
// and supply state before presenting only the actions that business supports.
// ============================================================================

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
            <div className="rounded-xl border border-dashed border-amber-900/60 bg-black/20 px-6 py-12 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-950 text-amber-500">
                    <Store className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm italic text-stone-500">
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
                    className={`rounded-xl border p-4 shadow-lg shadow-black/10 ${holding.needsAttention ? 'border-red-900/70 bg-red-950/20' : 'border-amber-900/60 bg-[#191317]'}`}
                >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <p className="font-cinzel text-base text-amber-100">{holding.name}</p>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${holding.needsAttention ? 'border-red-800/70 bg-red-950/60 text-red-300' : 'border-emerald-900/70 bg-emerald-950/40 text-emerald-300'}`}>
                                    {holding.needsAttention ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CircleCheck className="h-3 w-3" aria-hidden="true" />}
                                    {holding.needsAttention ? 'Needs attention' : 'Trading steadily'}
                                </span>
                            </div>
                            <p className="text-[11px] capitalize text-stone-500">
                                {holding.businessType.replace(/_/g, ' ')}
                                {holding.kind === 'stronghold' ? ' · stronghold' : ''}
                            </p>
                        </div>
                        {/* gpToCoins clamps negatives to zero, so format the magnitude and sign it ourselves. */}
                        <span className={`rounded-md border px-2.5 py-1 text-sm font-bold ${holding.profitPerDay >= 0 ? 'border-emerald-900/70 bg-emerald-950/40 text-emerald-300' : 'border-red-900/70 bg-red-950/40 text-red-300'}`}>
                            {holding.profitPerDay >= 0 ? '+' : '−'}{formatGpAsCoins(Math.abs(holding.profitPerDay))}/day
                        </span>
                    </div>

                    <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-white/5 bg-black/20 p-3 sm:grid-cols-3">
                        <MetricBar label="Customers" value={holding.metrics.customerSatisfaction} />
                        <MetricBar label="Reputation" value={holding.metrics.reputation} />
                        <MetricBar label="Supply" value={holding.metrics.supplyChainHealth} />
                    </div>

                    {holding.supplyIssues.length > 0 && (
                        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <p>{holding.supplyIssues[0]}</p>
                        </div>
                    )}

                    {holding.kind === 'world' && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-amber-900/40 pt-3">
                            <span className="text-xs text-stone-500">
                                {holding.managerId
                                    ? `Managed (${holding.managerEfficiency ?? 0}% efficiency)`
                                    : holding.needsAttention
                                        ? `Untended for ${holding.daysSinceManaged} days — reputation is slipping`
                                        : `Tended ${holding.daysSinceManaged === 0 ? 'today' : `${holding.daysSinceManaged} day${holding.daysSinceManaged === 1 ? '' : 's'} ago`}`}
                            </span>
                            <div className="ml-auto flex flex-wrap gap-2">
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
    <div className="flex flex-wrap items-center gap-2 border-t border-amber-900/40 pt-3">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-stone-500">Price index</span>
        <button
            onClick={() => onChange(Math.round((multiplier - 0.1) * 10) / 10)}
            disabled={multiplier <= 0.5}
            className="h-9 w-9 rounded-md border border-amber-800/70 bg-amber-950/70 text-amber-200 transition-colors hover:bg-amber-900 disabled:opacity-40"
            aria-label="Lower prices"
        >
            −
        </button>
        <span className="w-14 text-center font-cinzel text-sm text-amber-100">{Math.round(multiplier * 100)}%</span>
        <button
            onClick={() => onChange(Math.round((multiplier + 0.1) * 10) / 10)}
            disabled={multiplier >= 2}
            className="h-9 w-9 rounded-md border border-amber-800/70 bg-amber-950/70 text-amber-200 transition-colors hover:bg-amber-900 disabled:opacity-40"
            aria-label="Raise prices"
        >
            +
        </button>
        <span className="ml-1 rounded-full bg-black/20 px-2 py-1 text-[10px] italic text-stone-500">
            {multiplier > 1.3 ? 'Steep — customers may walk' : multiplier < 0.8 ? 'Cheap — thin margins' : 'Fair dealing'}
        </span>
    </div>
);

// ============================================================================
// Trade Map
// ============================================================================
// Routes and market events are read-only signals here; deeper route and
// investment tools remain available through their established entry points.
// ============================================================================

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
                    <div key={route.id} className="flex items-center gap-3 rounded-lg border border-amber-900/50 bg-[#191317] p-3 transition-colors hover:border-amber-800/70">
                        <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${routeStatusStyle[route.status]}`}>
                            {route.status}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate font-cinzel text-sm text-amber-100">{route.name}</p>
                            <p className="truncate text-xs text-stone-500">
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

// ============================================================================
// Ventures
// ============================================================================
// This page separates money ready to collect, capital still working, and debt
// that can be repaid so unlike financial decisions never compete visually.
// ============================================================================

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

// ============================================================================
// Couriers
// ============================================================================
// Delivered intelligence is readable now, while sealed messages expose only
// their origin and arrival time until the game day reaches delivery.
// ============================================================================

import { PendingCourier } from '../../types/economy';

const COURIER_ICONS: Record<string, LucideIcon> = {
    business_report: Landmark,
    investment_result: CircleDollarSign,
    market_intel: Map,
    loan_notice: Scale,
    faction_edict: ScrollText,
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
                    {delivered.slice(0, 6).map(msg => {
                        const CourierIcon = COURIER_ICONS[msg.type] || PackageCheck;
                        return (
                        <div key={msg.id} className="flex gap-3 rounded-lg border border-amber-900/50 bg-[#191317] p-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-950 text-amber-500">
                                <CourierIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm text-stone-200">{msg.messageText}</p>
                                <p className="mt-1 text-xs text-stone-600">
                                    From {msg.sourceRegionId.replace(/_/g, ' ')} · day {msg.deliveryDay}
                                    {msg.accuracy < 0.8 && <span className="italic"> · rumor</span>}
                                </p>
                            </div>
                        </div>
                        );
                    })}
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
