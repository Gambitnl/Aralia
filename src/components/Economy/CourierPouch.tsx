/**
 * @file CourierPouch.tsx
 * Courier message delivery UI — sealed scrolls and letters.
 * Wax seal icon on unread messages. Click to "break seal" and read.
 * Sorted by arrival day. Gives the medieval feel of information trickling in.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { useGameState } from '../../state/GameContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PendingCourier } from '../../types/economy';

const overlayMotion: MotionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const pouchMotion: MotionProps = {
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 30, opacity: 0 },
    transition: { type: 'spring', damping: 25 }
};

interface CourierPouchProps {
    isOpen: boolean;
    onClose: () => void;
    deliveredMessages?: PendingCourier[];
}

const CourierPouch: React.FC<CourierPouchProps> = ({ isOpen, onClose, deliveredMessages }) => {
    const { state } = useGameState();
    const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
    const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

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
        <AnimatePresence>
            <motion.div
                {...overlayMotion}
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-[var(--z-index-modal-background)] p-4"
                onClick={onClose}
            >
                <motion.div
                    ref={modalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Courier Pouch"
                    {...pouchMotion}
                    className="bg-amber-950/95 border-2 border-amber-800/50 rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={-1}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b-2 border-amber-700/40">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📨</span>
                            <div>
                                <h2 className="text-xl font-cinzel text-amber-300">Courier Pouch</h2>
                                <p className="text-xs text-amber-600/70 italic">
                                    {messages.length} message{messages.length !== 1 ? 's' : ''} received
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-amber-600 hover:text-amber-300 text-2xl transition-colors"
                            aria-label="Close courier pouch"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollable-content">
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
                </motion.div>
            </motion.div>
        </AnimatePresence>
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

    return (
        <motion.div
            layout
            className={`border rounded-lg overflow-hidden ${borderColor} ${
                isOpened ? 'bg-amber-900/20' : 'bg-amber-900/40 cursor-pointer'
            }`}
            onClick={!isOpened ? onOpen : undefined}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{isOpened ? icon : '🔒'}</span>
                <div className="flex-grow">
                    {isOpened ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <p className="text-sm text-amber-200">{message.messageText}</p>
                            <div className="flex gap-4 mt-2 text-xs text-amber-600/50">
                                <span>From: {message.sourceRegionId.replace(/_/g, ' ')}</span>
                                {message.accuracy < 0.8 && (
                                    <span className="text-amber-500/40 italic">(rumor — accuracy uncertain)</span>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-amber-400 font-cinzel">Sealed Message</p>
                            <span className="text-xs text-amber-600/50">
                                Click to break seal
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default CourierPouch;
