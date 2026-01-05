/**
 * @file src/components/Trade/RouteCard.tsx
 * Displays a single trade route with status, goods, and risk/profitability indicators.
 */
import React from 'react';
import { TradeRoute } from '../../types/economy';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';

interface RouteCardProps {
    route: TradeRoute;
}

const getStatusBadge = (status: TradeRoute['status'] | 'booming') => {
    switch (status) {
        case 'active':
            return { icon: '🟢', text: 'Active', color: 'bg-green-700/50 text-green-200' };
        case 'booming':
            return { icon: '✨', text: 'Booming', color: 'bg-amber-600/50 text-amber-200' };
        case 'blockaded':
            return { icon: '🔴', text: 'Blockaded', color: 'bg-red-700/50 text-red-200' };
        case 'disrupted':
            return { icon: '🟡', text: 'Disrupted', color: 'bg-yellow-700/50 text-yellow-200' };
        default:
            return { icon: '⚪', text: 'Unknown', color: 'bg-gray-700/50 text-gray-200' };
    }
};

const RouteCard: React.FC<RouteCardProps> = ({ route }) => {
    const originRegion = REGIONAL_ECONOMIES[route.originId];
    const destRegion = REGIONAL_ECONOMIES[route.destinationId];
    const statusBadge = getStatusBadge(route.status as TradeRoute['status'] | 'booming');

    return (
        <div className="bg-gray-800/70 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">{route.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
                    {statusBadge.icon} {statusBadge.text}
                </span>
            </div>

            {/* Description */}
            {route.description && (
                <p className="text-gray-400 text-sm mb-3">{route.description}</p>
            )}

            {/* Route Path */}
            <div className="flex items-center gap-2 text-sm mb-3">
                <span className="text-blue-300">{originRegion?.name || route.originId}</span>
                <span className="text-gray-500">→</span>
                <span className="text-purple-300">{destRegion?.name || route.destinationId}</span>
            </div>

            {/* Goods */}
            <div className="mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Goods</span>
                <div className="flex flex-wrap gap-1 mt-1">
                    {route.goods.map(good => (
                        <span key={good} className="px-2 py-0.5 bg-gray-700/70 rounded text-xs text-gray-300">
                            {good}
                        </span>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                {/* Risk Meter */}
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Risk</span>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${route.riskLevel > 0.5 ? 'bg-red-500' : route.riskLevel > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${route.riskLevel * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(route.riskLevel * 100)}%</span>
                    </div>
                </div>

                {/* Profitability Meter */}
                <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Profit</span>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500"
                                style={{ width: `${route.profitability}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-400">{route.profitability}%</span>
                    </div>
                </div>
            </div>

            {/* Days in Status */}
            {route.daysInStatus !== undefined && route.daysInStatus > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                    {route.daysInStatus} day{route.daysInStatus !== 1 ? 's' : ''} in current status
                </p>
            )}
        </div>
    );
};

export default RouteCard;
