/**
 * @file src/components/Trade/TradeRouteDashboard.tsx
 * Dashboard modal for viewing trade routes and their market impact.
 */
import React from 'react';
import { TradeRoute, MarketEvent } from '../../types/economy';
interface TradeRouteDashboardProps {
    tradeRoutes: TradeRoute[];
    marketEvents: MarketEvent[];
    onClose: () => void;
}
declare const TradeRouteDashboard: React.FC<TradeRouteDashboardProps>;
export default TradeRouteDashboard;
