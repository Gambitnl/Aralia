// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:40
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewComponents.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ui/CompanionReaction.tsx
 * A component to display transient companion reactions/bubbles.
 * @component-owner Narrative Team / Core UI
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Companion } from '../../types/companions';

import { GameMessage } from '../../types';
import { UI_ID } from '../../styles/uiIds';

const REACTION_DISPLAY_MS = 5_000;
const REACTION_DUPLICATE_WINDOW_MS = 3_000;

interface CompanionReactionProps {
  companions: Record<string, Companion>;
  latestMessage?: GameMessage;
}

interface ReactionBubble {
  messageId: number;
  companionId: string;
  companionName: string;
  text: string;
  avatarUrl?: string;
  receivedAt: number;
}

interface AcceptedReactionRef {
  key: string;
  receivedAt: number;
}

// Keep the parsing logic local so the component can normalize the text without
// forcing the rest of the app to know about the bubble formatting contract.
const parseReactionText = (text: string): string => {
  const match = text.match(/:\s*"([^"]*)"$/);
  return (match ? match[1] : text).trim();
};

const getMessageTimestamp = (message: GameMessage): number =>
  message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now();

const buildReactionBubble = (message: GameMessage, companion: Companion): ReactionBubble => ({
  messageId: message.id,
  companionId: companion.id,
  companionName: companion.identity.name,
  text: parseReactionText(message.text),
  avatarUrl: companion.identity.avatarUrl,
  receivedAt: getMessageTimestamp(message),
});

export const CompanionReaction: React.FC<CompanionReactionProps> = ({ companions, latestMessage }) => {
  // The queue stays inside this component so burst handling does not leak into App-level flow.
  const [reactionQueue, setReactionQueue] = useState<ReactionBubble[]>([]);
  const lastProcessedMessageIdRef = useRef<number | null>(null);
  const lastAcceptedReactionRef = useRef<AcceptedReactionRef | null>(null);

  const activeReaction = reactionQueue[0] ?? null;

  useEffect(() => {
    if (!latestMessage) return;
    if (latestMessage.id === lastProcessedMessageIdRef.current) return;

    if (latestMessage.sender !== 'npc' || !latestMessage.metadata?.companionId) {
      lastProcessedMessageIdRef.current = latestMessage.id;
      return;
    }

    const companionId = latestMessage.metadata.companionId;
    const companion = companions[companionId];
    if (!companion) return;

    const bubble = buildReactionBubble(latestMessage, companion);
    const burstKey = `${bubble.companionId}::${bubble.text}`;
    const acceptedReaction = lastAcceptedReactionRef.current;

    // If the same companion repeats the same line in a short burst, keep the
    // original bubble alive instead of stacking a visually redundant duplicate.
    if (
      acceptedReaction &&
      acceptedReaction.key === burstKey &&
      bubble.receivedAt - acceptedReaction.receivedAt < REACTION_DUPLICATE_WINDOW_MS
    ) {
      lastProcessedMessageIdRef.current = latestMessage.id;
      return;
    }

    lastAcceptedReactionRef.current = {
      key: burstKey,
      receivedAt: bubble.receivedAt,
    };
    lastProcessedMessageIdRef.current = latestMessage.id;

    setReactionQueue((currentQueue) => [...currentQueue, bubble]);
  }, [companions, latestMessage]);

  useEffect(() => {
    if (!activeReaction) return;

    // The first item in the queue owns the display timer; when it expires we
    // shift the queue so the next reaction can take the same slot.
    const timer = window.setTimeout(() => {
      setReactionQueue((currentQueue) => currentQueue.slice(1));
    }, REACTION_DISPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeReaction?.messageId]);

  if (!activeReaction) return null;

  return (
    <AnimatePresence>
      <motion.div
        id={UI_ID.COMPANION_REACTION}
        data-testid={UI_ID.COMPANION_REACTION}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        className="fixed bottom-32 left-8 z-[var(--z-index-modal-background)] flex items-end gap-3 pointer-events-none"
      >
        <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-gray-800 overflow-hidden shadow-lg">
          {/* Keep the avatar slot stable even when no portrait is available yet. */}
          {activeReaction.avatarUrl ? (
            <img
              src={activeReaction.avatarUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-2xl">
              {activeReaction.companionName.charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="bg-gray-900/90 border border-amber-900/50 p-4 rounded-t-xl rounded-br-xl text-amber-100 shadow-xl max-w-md backdrop-blur-sm mb-4">
          <h4 className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">
            {activeReaction.companionName}
          </h4>

          {/* Preserve the quoted bubble style from the earlier UI while keeping the text normalized. */}
          <p className="italic text-sm">&quot;{activeReaction.text}&quot;</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
