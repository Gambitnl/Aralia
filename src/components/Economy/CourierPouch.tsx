/**
 * @file CourierPouch.tsx
 * Courier message delivery UI — sealed scrolls and letters.
 * Wax seal icon on unread messages. Click to "break seal" and read.
 * Sorted by arrival day. Gives the medieval feel of information trickling in.
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../../state/GameContext';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { PendingCourier } from '../../types/economy';

interface CourierPouchProps {
    isOpen: boolean;
    onClose: () => void;
    deliveredMessages?: PendingCourier[];
}

const CourierPouch: React.FC<CourierPouchProps> = ({ isOpen, onClose, deliveredMessages }) => {
    const { state } = useGameState();
    const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());

    // Combine delivered messages (from props or state)
    const messages = useMemo(() => {
        const msgs = deliveredMessages || [];
        // Also show any pending couriers that have been delivered (deliveryDay <= currentDay)
        const pending = state.pendingCouriers || [];
        return [...msgs, ...pending].sort((a, b) => b.deliveryDay - a.deliveryDay);
    }, [deliveredMessages, state.pendingCouriers]);

    const handleOpenMessage = (id: string) => {
        setOpenedIds(prev => new Set(prev).add(id));
    };

    if (!isOpen) return null;

    return (
        <WindowFrame
            title="Courier Pouch"
            onClose={onClose}
            storageKey={WINDOW_KEYS.COURIER_POUCH}
            initialMaximized={false}
            headerActions={
                <span className="self-center text-xs text-amber-600/70 italic whitespace-nowrap">
                    {messages.length} message{messages.length !== 1 ? 's' : ''} received
                </span>
            }
        >
            <div className="flex flex-col h-full bg-amber-950/20">
                {/* Messages */}
                <div className="flex-grow min-h-0 overflow-y-auto p-4 space-y-3 scrollable-content">
                    {messages.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl block mb-4">📭</span>
                            <p className="text-amber-500/60 italic">No messages. Your courier pouch is empty.</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <CourierMessage
                                key={msg.id}
                                message={msg}
                                isOpened={openedIds.has(msg.id)}
                                onOpen={() => handleOpenMessage(msg.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

const CourierMessage: React.FC<{
    message: PendingCourier;
    isOpened: boolean;
    onOpen: () => void;
}> = ({ message, isOpened, onOpen }) => {
    const typeIcons: Record<string, string> = {
        'business_report': '📊',
        'investment_result': '💰',
        'market_intel': '🗺️',
        'loan_notice': '⚖️',
        'faction_edict': '📜'
    };

    const typeColors: Record<string, string> = {
        'business_report': 'border-blue-800/40',
        'investment_result': 'border-green-800/40',
        'market_intel': 'border-purple-800/40',
        'loan_notice': 'border-red-800/40',
        'faction_edict': 'border-amber-800/40'
    };

    const icon = typeIcons[message.type] || '📜';
    const borderColor = typeColors[message.type] || 'border-amber-800/40';
    const sourceLabel = message.sourceRegionId.replace(/_/g, ' ');
    const cardClasses = `border rounded-lg overflow-hidden ${borderColor} ${
        isOpened ? 'bg-amber-900/20' : 'bg-amber-900/40'
    }`;

    if (!isOpened) {
        return (
            <motion.button
                layout
                type="button"
                className={`${cardClasses} w-full cursor-pointer text-left transition-colors hover:bg-amber-900/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-950`}
                onClick={onOpen}
                aria-label={`Open sealed ${message.type.replace(/_/g, ' ')} message from ${sourceLabel}`}
            >
                <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl" aria-hidden="true">🔒</span>
                    <div className="flex-grow">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-amber-400 font-cinzel">Sealed Message</p>
                            <span className="text-xs text-amber-600/50">
                                Click to break seal
                            </span>
                        </div>
                    </div>
                </div>
            </motion.button>
        );
    }

    // Opened messages stop behaving like controls so keyboard focus only lands
    // on scrolls the player can still reveal. The visual card stays the same
    // size and color family as the sealed state to preserve the pouch metaphor.
    return (
        <motion.div
            layout
            className={cardClasses}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden="true">{icon}</span>
                <div className="flex-grow">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <p className="text-sm text-amber-200">{message.messageText}</p>
                        <div className="flex gap-4 mt-2 text-xs text-amber-600/50">
                            <span>From: {sourceLabel}</span>
                            {message.accuracy < 0.8 && (
                                <span className="text-amber-500/40 italic">(rumor — accuracy uncertain)</span>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default CourierPouch;
