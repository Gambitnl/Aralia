/**
 * @file BanterInterruptUI.tsx
 * Floating UI that appears during active banter, allowing the player to join the conversation.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BanterInterruptUIProps {
    isActive: boolean;
    isWaiting: boolean;
    secondsRemaining: number;
    onInterrupt: (message: string) => void;
    onEndBanter: () => void;
}

export const BanterInterruptUI: React.FC<BanterInterruptUIProps> = ({
    isActive,
    isWaiting,
    secondsRemaining,
    onInterrupt,
    onEndBanter
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [playerMessage, setPlayerMessage] = useState('');

    if (!isActive) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerMessage.trim()) {
            onInterrupt(playerMessage.trim());
            setPlayerMessage('');
            setIsExpanded(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
            >
                <div className="bg-gray-800/95 backdrop-blur-sm border border-amber-500/50 rounded-xl shadow-2xl overflow-hidden">
                    {/* Collapsed State: Show countdown + Join button */}
                    {!isExpanded && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-amber-400 text-lg">💬</span>
                                <span className="text-gray-300 text-sm font-medium">Banter in progress</span>
                            </div>

                            {isWaiting && secondsRemaining > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-md">
                                    <span className="text-gray-400 text-xs">Next line in</span>
                                    <span className="text-amber-400 text-sm font-bold tabular-nums">{secondsRemaining}s</span>
                                </div>
                            )}

                            <button
                                onClick={() => setIsExpanded(true)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                ✋ Join In
                            </button>

                            <button
                                onClick={onEndBanter}
                                className="px-2 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-300 text-sm rounded-lg transition-colors"
                                title="End banter"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Expanded State: Text input for player message */}
                    {isExpanded && (
                        <form onSubmit={handleSubmit} className="p-4 min-w-[400px]">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-amber-400 text-lg">💬</span>
                                <span className="text-gray-300 text-sm font-medium">What do you want to say?</span>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={playerMessage}
                                    onChange={(e) => setPlayerMessage(e.target.value)}
                                    placeholder="Type your reply..."
                                    autoFocus
                                    className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!playerMessage.trim()}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                                >
                                    Send
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>

                            <p className="mt-2 text-xs text-gray-500">
                                Your companions will respond to what you say.
                            </p>
                        </form>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BanterInterruptUI;
