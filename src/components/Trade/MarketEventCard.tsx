/**
 * @file src/components/Trade/MarketEventCard.tsx
 * Displays a market event from the trade route system.
 */
import React from 'react';
import { MarketEvent, MarketEventType } from '../../types/economy';

interface MarketEventCardProps {
    event: MarketEvent;
}

const getEventDisplay = (type: MarketEventType) => {
    switch (type) {
        case MarketEventType.SHORTAGE:
            return { icon: '📉', label: 'Shortage', color: 'border-red-600 bg-red-900/30' };
        case MarketEventType.SURPLUS:
            return { icon: '📈', label: 'Surplus', color: 'border-green-600 bg-green-900/30' };
        case MarketEventType.WAR_TAX:
            return { icon: '⚔️', label: 'War Tax', color: 'border-orange-600 bg-orange-900/30' };
        case MarketEventType.FESTIVAL:
            return { icon: '🎉', label: 'Festival', color: 'border-purple-600 bg-purple-900/30' };
        case MarketEventType.BOOM:
            return { icon: '✨', label: 'Boom', color: 'border-amber-600 bg-amber-900/30' };
        case MarketEventType.BUST:
            return { icon: '💔', label: 'Bust', color: 'border-gray-600 bg-gray-900/30' };
        default:
            return { icon: '❓', label: 'Unknown', color: 'border-gray-600 bg-gray-900/30' };
    }
};

const MarketEventCard: React.FC<MarketEventCardProps> = ({ event }) => {
    const display = getEventDisplay(event.type);
    const intensityPercent = Math.round(event.intensity * 100);

    return (
        <div className={`rounded-lg p-3 border ${display.color}`}>
            <div className="flex items-start gap-3">
                <span className="text-2xl">{display.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                            {event.name || display.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-700/50 rounded text-gray-300">
                            {intensityPercent}% intensity
                        </span>
                    </div>
                    {event.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarketEventCard;
