/**
 * @file src/components/Trade/TradeRouteDashboard.tsx
 * Dashboard modal for viewing trade routes and their market impact.
 */
import React, { useState } from 'react';
import { TradeRouteManager } from '../../utils/trade/TradeRouteManager';
import { TradeRoute, MarketEvent } from '../../types/trade';
import { WindowFrame } from '../ui/WindowFrame';
import RouteCard from './RouteCard';
import MarketEventCard from './MarketEventCard';

interface TradeRouteDashboardProps {
    tradeRoutes: TradeRoute[];
    marketEvents: MarketEvent[];
    onClose: () => void;
}

type TabId = 'overview' | 'routes' | 'events';

const TradeRouteDashboard: React.FC<TradeRouteDashboardProps> = ({
    tradeRoutes,
    marketEvents,
    onClose,
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    // Calculate overview stats
    const activeRoutes = tradeRoutes.filter(r => r.status === 'active').length;
    const blockedRoutes = tradeRoutes.filter(r => r.status === 'blockaded' || r.status === 'disrupted').length;
    const boomingRoutes = tradeRoutes.filter(r => (r.status as string) === 'booming').length;
    const shortages = marketEvents.filter(e => e.type === 'SHORTAGE').length;
    const surpluses = marketEvents.filter(e => e.type === 'SURPLUS').length;

    const NavButton: React.FC<{ tabId: TabId; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tabId
                ? 'border-amber-500 text-amber-500 bg-gray-700/50'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                }`}
        >
            {children}
        </button>
    );

    return (
        <WindowFrame
            title="Trade Route Monitor"
            onClose={onClose}
            storageKey="trade-route-dashboard"
        >
            <div className="flex flex-col h-full bg-gray-900">
                {/* Stats Overview */}
                <div className="bg-gray-800 p-4 border-b border-gray-700 grid grid-cols-4 gap-4 text-center shrink-0">
                    <div className="p-2 bg-gray-700/50 rounded">
                        <div className="text-xs text-gray-400 uppercase">Active</div>
                        <div className="text-xl font-bold text-green-400">{activeRoutes}</div>
                    </div>
                    <div className="p-2 bg-gray-700/50 rounded">
                        <div className="text-xs text-gray-400 uppercase">Booming</div>
                        <div className="text-xl font-bold text-amber-400">{boomingRoutes}</div>
                    </div>
                    <div className="p-2 bg-gray-700/50 rounded">
                        <div className="text-xs text-gray-400 uppercase">Blocked</div>
                        <div className="text-xl font-bold text-red-400">{blockedRoutes}</div>
                    </div>
                    <div className="p-2 bg-gray-700/50 rounded">
                        <div className="text-xs text-gray-400 uppercase">Events</div>
                        <div className="text-xl font-bold text-purple-400">{marketEvents.length}</div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-800/50 shrink-0">
                    <NavButton tabId="overview">Overview</NavButton>
                    <NavButton tabId="routes">Routes ({tradeRoutes.length})</NavButton>
                    <NavButton tabId="events">Market Events ({marketEvents.length})</NavButton>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-lg font-bold text-white mb-2">Market Status</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                                        <h4 className="text-red-400 font-bold mb-1">Shortages ({shortages})</h4>
                                        <p className="text-sm text-gray-400">High demand goods. Prices +20-50%.</p>
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                                        <h4 className="text-green-400 font-bold mb-1">Surpluses ({surpluses})</h4>
                                        <p className="text-sm text-gray-400">Excess supply. Prices -10-30%.</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'routes' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {tradeRoutes.map(route => (
                                <RouteCard key={route.id} route={route} />
                            ))}
                            {tradeRoutes.length === 0 && (
                                <p className="col-span-2 text-center text-gray-500 py-8">
                                    No trade routes available.
                                </p>
                            )}
                        </div>
                    )}

                    {activeTab === 'events' && (
                        <div className="space-y-3">
                            {marketEvents.map(event => (
                                <MarketEventCard key={event.id} event={event} />
                            ))}
                            {marketEvents.length === 0 && (
                                <p className="text-center text-gray-500 py-8">
                                    No active market events. Trade is flowing normally.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default TradeRouteDashboard;
