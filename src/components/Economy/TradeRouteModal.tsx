/**
 * This file renders the Regional Trade Route & Logistics interface (TradeRouteModal).
 *
 * Players use this modal to inspect regional merchant routes, evaluate risk
 * and profitability profiles, and monitor ongoing market events affecting
 * commodity prices.
 *
 * Features include:
 * - Trade route monitoring (origin, destination, goods, status, profit multiplier).
 * - Active market events (shortages, booms, blockades) across game regions.
 * - Caravan investment dispatching and risk mitigation.
 * - Keyboard focus trapping and accessibility standards.
 *
 * Called by: GameModals.tsx, PlayingScreen.tsx, or CommerceDesk.tsx
 * Depends on: WindowFrame, TradeRouteDashboard, GameContext, TradeRoute, MarketEvent
 */

// ============================================================================
// Imports
// ============================================================================
import React, { useMemo, useState } from 'react';
import {
    Activity,
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    Coins,
    Globe2,
    MapPin,
    Navigation,
    Package,
    Route,
    Shield,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Truck,
} from 'lucide-react';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { MarketEvent, TradeRoute } from '../../types/economy';

// ============================================================================
// Props & Types
// ============================================================================
export interface TradeRouteModalProps {
    // Controls modal visibility
    isOpen?: boolean;
    // Callback when the player closes the trade route modal
    onClose?: () => void;
    // Optional list of trade routes to display
    tradeRoutes?: TradeRoute[];
    // Optional list of active market events
    marketEvents?: MarketEvent[];
    // Optional callback when investing in a route
    onInvestInRoute?: (routeId: string, amount: number) => void;
}

type RouteTab = 'routes' | 'events';

// ============================================================================
// Main Component
// ============================================================================
export const TradeRouteModal: React.FC<TradeRouteModalProps> = ({
    isOpen = true,
    onClose,
    tradeRoutes,
    marketEvents,
    onInvestInRoute,
}) => {
    const { state, dispatch } = useGameState();
    const [activeTab, setActiveTab] = useState<RouteTab>('routes');
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    // Resolve active routes and market events from props or global economy state
    const routes = useMemo(() => {
        if (tradeRoutes && tradeRoutes.length > 0) return tradeRoutes;
        return state.economy?.tradeRoutes || [];
    }, [tradeRoutes, state.economy?.tradeRoutes]);

    const events = useMemo(() => {
        if (marketEvents && marketEvents.length > 0) return marketEvents;
        return state.economy?.marketEvents || [];
    }, [marketEvents, state.economy?.marketEvents]);

    if (!isOpen) return null;

    // Helper to format status tag colors
    const getStatusBadge = (status: TradeRoute['status']) => {
        switch (status) {
            case 'booming':
                return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40';
            case 'disrupted':
                return 'bg-amber-950/60 text-amber-300 border-amber-800/40';
            case 'blockaded':
                return 'bg-red-950/60 text-red-300 border-red-800/40';
            default:
                return 'bg-slate-800 text-slate-300 border-slate-700';
        }
    };

    return (
        <WindowFrame
            title="Trade Route Logistics & Market Monitor"
            storageKey={WINDOW_KEYS.TRADE_ROUTE}
            onClose={onClose}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
                {/* Header Banner */}
                <div className="shrink-0 px-6 py-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Route className="w-5 h-5 text-amber-400" />
                        <div>
                            <div className="text-sm font-bold text-amber-200">Merchant Caravan Logistics</div>
                            <div className="text-xs text-slate-400">Trade paths, regional market shifts, and caravan security</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Globe2 className="w-4 h-4 text-amber-400" />
                        <span>Active Routes: {routes.length} • Market Events: {events.length}</span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="shrink-0 px-6 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('routes')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'routes'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Caravan Routes ({routes.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('events')}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'events'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Market Intelligence ({events.length})</span>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 scrollable-content">
                    {/* Tab 1: Caravan Routes */}
                    {activeTab === 'routes' && (
                        <div className="space-y-3">
                            {routes.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <Route className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">No active trade routes recorded.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {routes.map(route => (
                                        <div
                                            key={route.id}
                                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-100">{route.name}</h4>
                                                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 text-amber-400" />
                                                        <span>{route.originId} → {route.destinationId}</span>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded border capitalize ${getStatusBadge(route.status)}`}>
                                                    {route.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-slate-950/60 text-xs">
                                                <div>
                                                    <span className="text-slate-400">Profitability:</span>
                                                    <div className="font-bold text-emerald-400">+{route.profitability}%</div>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">Hazard Risk:</span>
                                                    <div className="font-bold text-amber-400">{Math.round(route.riskLevel * 100)}%</div>
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-400 flex items-center gap-1">
                                                <Package className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Goods: {route.goods.join(', ') || 'General Commodities'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Market Events */}
                    {activeTab === 'events' && (
                        <div className="space-y-3">
                            {events.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                                    <Activity className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <p className="text-sm font-medium">Markets are currently stable across all regions.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {events.map(ev => (
                                        <div
                                            key={ev.id}
                                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-amber-300">{ev.name || ev.type}</h4>
                                                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                    Intensity {Math.round((ev.intensity || 0.5) * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400">{ev.description || 'Regional commodity shift impacting market prices.'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default TradeRouteModal;
