/**
 * @file BanterAttentionBanner.tsx
 *
 * Floating centre-bottom banner that appears when a companion NPC addresses the
 * player directly during PLAYER_DIRECTED banter mode.
 *
 * Shows:
 *  - The NPC's name and a truncated version of their opening line
 *  - A countdown to the response deadline
 *  - An "Open Chat" button that expands the banter panel
 *  - A "Dismiss" button to hide the banner without ending banter
 *
 * Auto-fades after 10 seconds of inactivity (the banter panel tab still pulses).
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BanterAttentionBannerProps {
  /** Name of the NPC who spoke. */
  speakerName: string | null | undefined;
  /** The directed line the NPC said (truncated if long). */
  lastLine: string | null | undefined;
  /** Seconds remaining for the player to reply. */
  deadlineSeconds: number;
  /** Called when the player clicks "Open Chat". */
  onOpenChat: () => void;
  /** Extends the player response deadline by 60 seconds. */
  onExtendDeadline?: () => void;
}

const MAX_LINE_LENGTH = 80;

export const BanterAttentionBanner: React.FC<BanterAttentionBannerProps> = ({
  speakerName,
  lastLine,
  deadlineSeconds,
  onOpenChat,
  onExtendDeadline,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [autoFadeTimer, setAutoFadeTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-fade after 10 seconds — the tab continues to pulse even after dismissal
  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), 10_000);
    setAutoFadeTimer(timer);
    return () => clearTimeout(timer);
  }, []);

  // Re-show if the deadline changes (new banter session)
  useEffect(() => {
    setDismissed(false);
    if (autoFadeTimer) clearTimeout(autoFadeTimer);
    const timer = setTimeout(() => setDismissed(true), 10_000);
    setAutoFadeTimer(timer);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerName, lastLine]);

  const truncatedLine = lastLine && lastLine.length > MAX_LINE_LENGTH
    ? `${lastLine.slice(0, MAX_LINE_LENGTH)}…`
    : lastLine;

  const handleOpenChat = () => {
    setDismissed(true);
    onOpenChat();
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="banter-attention-banner"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[var(--z-index-content-overlay-high,500)]
                     w-[min(480px,90vw)] pointer-events-auto"
          role="alertdialog"
          aria-label={`${speakerName ?? 'Companion'} is speaking to you`}
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-pulse" aria-hidden="true" />

          {/* Card */}
          <div className="relative rounded-2xl border border-amber-500/60 bg-gray-900/95 shadow-2xl shadow-amber-500/20 backdrop-blur-sm overflow-hidden">
            {/* Amber top accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

            <div className="px-4 py-3 flex flex-col gap-2">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Pulsing indicator dot */}
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <span className="text-amber-400 font-semibold text-sm">
                    {speakerName ?? 'Companion'}
                  </span>
                  <span className="text-gray-400 text-xs">speaks to you</span>
                </div>

                {/* Countdown + extend button */}
                <div className="flex items-center gap-2 text-xs text-gray-400 tabular-nums">
                  <span>⏱</span>
                  <span className={deadlineSeconds <= 30 ? 'text-amber-400 font-semibold' : ''}>
                    {deadlineSeconds}s
                  </span>
                  {onExtendDeadline && (
                    <button
                      onClick={onExtendDeadline}
                      className="px-1.5 py-0.5 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-600/50 text-amber-300 text-[10px] font-semibold rounded transition-colors"
                      title="Extend reply window by 1 minute"
                    >
                      +1 min
                    </button>
                  )}
                </div>
              </div>

              {/* Quoted line */}
              {truncatedLine && (
                <p className="text-gray-200 text-sm italic leading-relaxed pl-4 border-l-2 border-amber-500/50">
                  "{truncatedLine}"
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleOpenChat}
                  className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Open Chat ▸
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  title="Dismiss (banter continues in background)"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
