/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ui/CompanionReaction.tsx
 * A component to display transient companion reactions/bubbles.
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Companion } from '../../types/companions';

import { GameMessage } from '../../types';

interface CompanionReactionProps {
  companions: Record<string, Companion>;
  latestMessage?: GameMessage;
}

export const CompanionReaction: React.FC<CompanionReactionProps> = ({ companions, latestMessage }) => {
  const [dismissedMessageId, setDismissedMessageId] = useState<number | null>(null);
  const activeReaction = (() => {
    if (!latestMessage || latestMessage.id === dismissedMessageId) return null;
    if (latestMessage.sender !== 'npc' || !latestMessage.metadata?.companionId) return null;

    const companionId = latestMessage.metadata.companionId;
    const companion = companions[companionId];
    if (!companion) return null;

    // Parse text to remove name prefix if present, or just use raw text
    // The reducer adds "Name: "Reaction"", so we might want to clean it up for the bubble
    // or just show the "Reaction" part.
    // Let's extract the part inside quotes if possible, otherwise show full text.
    const match = latestMessage.text.match(/: "(.*)"$/);
    const textToShow = match ? match[1] : latestMessage.text;

    return {
      companionId: companion.id,
      text: textToShow,
      avatarUrl: companion.identity.avatarUrl
    };
  })();

  useEffect(() => {
    if (!activeReaction || !latestMessage) return;

    // TODO(lint-intent): If reactions should queue or persist per companion, replace the single dismissed id with a queue.
    const timer = setTimeout(() => {
      setDismissedMessageId(latestMessage.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeReaction, latestMessage]);

  if (!activeReaction) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        className="fixed bottom-32 left-8 z-50 flex items-end gap-3 pointer-events-none"
      >
        <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-gray-800 overflow-hidden shadow-lg">
             {/* Placeholder for avatar if url is missing */}
             <div className="w-full h-full bg-gray-700 flex items-center justify-center text-2xl">
                {activeReaction.text.charAt(0)}
             </div>
        </div>
        <div className="bg-gray-900/90 border border-amber-900/50 p-4 rounded-t-xl rounded-br-xl text-amber-100 shadow-xl max-w-md backdrop-blur-sm mb-4">
            <h4 className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">
                {Object.values(companions).find(c => c.id === activeReaction.companionId)?.identity.name}
            </h4>


            {/*
              TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
              TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
              TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
            */}
            <p className="italic text-sm">&quot;{activeReaction.text}&quot;</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
