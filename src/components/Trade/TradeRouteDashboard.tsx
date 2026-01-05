/**
 * @file src/components/Trade/TradeRouteDashboard.tsx
 * Dashboard modal for viewing trade routes and their market impact.
 */
import React, { useState } from 'react';
import { TradeRoute, MarketEvent } from '../../types/economy';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl">
                    <h1 className="text-2xl font-bold text-white tracking-wider flex items-center gap-2">
                        🛤️ Trade Route Monitor
                    </h1>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors text-2xl"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-800">
                    <NavButton tabId="overview">Overview</NavButton>
                    <NavButton tabId="routes">Routes ({tradeRoutes.length})</NavButton>
                    <NavButton tabId="events">Market Events ({marketEvents.length})</NavButton>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Route Status Summary */}
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-3">Route Status</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-bold text-green-400">{activeRoutes}</div>
                                        <div className="text-sm text-green-300">Active</div>
                                    </div>
                                    <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-bold text-amber-400">{boomingRoutes}</div>
                                        <div className="text-sm text-amber-300">Booming</div>
                                    </div>
                                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-bold text-red-400">{blockedRoutes}</div>
                                        <div className="text-sm text-red-300">Blocked</div>
                                    </div>
                                </div>
                            </div>

                            {/* Market Impact Summary */}
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-3">Market Impact</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">📉</span>
                                            <span className="text-red-300 font-medium">Shortages ({shortages})</span>
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            {shortages > 0
                                                ? 'Some goods are scarce. Prices will be higher.'
                                                : 'No active shortages. Markets are stable.'}
                                        </div>
                                    </div>
                                    <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">📈</span>
                                            <span className="text-green-300 font-medium">Surpluses ({surpluses})</span>
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            {surpluses > 0
                                                ? 'Goods are plentiful. Expect lower prices.'
                                                : 'No active surpluses. Normal pricing.'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            {marketEvents.length > 0 && (
                                <div>
                                    <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
                                    <div className="space-y-2">
                                        {marketEvents.slice(0, 3).map(event => (
                                            <MarketEventCard key={event.id} event={event} />
                                        ))}
                                        {marketEvents.length > 3 && (
                                            <button
                                                onClick={() => setActiveTab('events')}
                                                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                                            >
                                                View all {marketEvents.length} events →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
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
        </div>
    );
};

export default TradeRouteDashboard;
