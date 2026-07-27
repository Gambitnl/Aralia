/**
 * @file src/components/Trade/MarketEventCard.tsx
 * Displays a market event from the trade route system.
 */
import React from 'react';
import { MarketEvent } from '../../types/economy';
interface MarketEventCardProps {
    event: MarketEvent;
}
declare const MarketEventCard: React.FC<MarketEventCardProps>;
export default MarketEventCard;
