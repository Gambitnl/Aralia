/**
 * @file src/components/Trade/RouteCard.tsx
 * Displays a single trade route with status, goods, and risk/profitability indicators.
 */
import React from 'react';
import { TradeRoute } from '../../types/economy';
interface RouteCardProps {
    route: TradeRoute;
}
declare const RouteCard: React.FC<RouteCardProps>;
export default RouteCard;
