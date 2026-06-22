// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 01:11:44
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/layout/GameModals.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/ui/OllamaDependencyModal.tsx
 * @component-owner Narrative Team / Core UI
 * @status Stable / Maintained
 *
 * Non-blocking, right-docked side pane that explains the Ollama dependency.
 *
 * Unlike a modal, this does NOT dim or capture the rest of the app: it renders inside a
 * full-screen `pointer-events-none` positioning layer, and only the pane itself re-enables
 * pointer events, so the main UI stays fully interactive while the pane is open.
 *
 * It is an expandable "window frame": a title bar (with collapse/expand + close controls)
 * is always visible; the body collapses to just that bar and expands again on toggle.
 *
 * Called by: src/components/layout/GameModals.tsx
 * Depends on: Button.tsx, Input.tsx, zIndex.ts, uiIds.ts
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Checkbox } from './Input';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';

interface OllamaDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: (value: boolean) => void;
}

export const OllamaDependencyModal: React.FC<OllamaDependencyModalProps> = ({
  isOpen,
  onClose,
  onDontShowAgain,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // The pane starts in the top-right corner and stays anchored there while collapsing.
  // This avoids an intermediate jump from center-right to top-right when the user minimizes it.
  const positioningClass = 'items-start justify-end';

  // The expanded pane keeps the original readable width. The collapsed pane uses a fixed
  // compact width so the still-animating body text cannot stretch the frame while it exits.
  const paneWidthClass = isCollapsed ? 'w-64 max-w-[calc(100vw-2rem)]' : 'w-full max-w-md';

  // The title bar is slightly tighter in the collapsed state so the remaining tab is compact
  // while preserving the same expand and close controls for recovery.
  const titleBarClass = isCollapsed ? 'px-3 py-2' : 'px-5 py-3';

  // Collapse should feel deliberate without letting the frame sweep across the play area.
  // A shared duration keeps the body and arrow from finishing at different moments.
  const collapseAnimationDurationSeconds = 0.4;

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }
    onClose();
  };

  const handleLearnMore = () => {
    window.open('https://ollama.ai', '_blank');
  };

  // Escape closes the pane (non-trapping — focus is never locked to the pane).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dontShowAgain]);

  return (
    <AnimatePresence>
      {isOpen && (
        // Full-screen positioning layer — transparent and click-through, so the pane never
        // blocks the main UI. Only the pane below re-enables pointer events.
        <div
          id={UI_ID.OLLAMA_DEPENDENCY_MODAL}
          data-testid={UI_ID.OLLAMA_DEPENDENCY_MODAL}
          className={`fixed inset-0 flex ${positioningClass} p-4 pointer-events-none z-[${Z_INDEX.MODAL_BACKGROUND}]`}
        >
          <motion.aside
            className={`pointer-events-auto bg-gray-900 border border-amber-500/60 rounded-xl shadow-2xl ${paneWidthClass} text-gray-100 focus:outline-none flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden`}
            role="region"
            aria-labelledby="ollama-modal-title"
            tabIndex={-1}
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: collapseAnimationDurationSeconds, ease: 'easeOut' }}
          >
            {/* Window-frame title bar — always visible; click to collapse/expand. */}
            <div
              className={`flex items-center justify-between gap-2 ${titleBarClass} border-b border-amber-500/20 bg-gray-900/80 cursor-pointer select-none`}
              onClick={() => setIsCollapsed((c) => !c)}
              role="button"
              aria-expanded={!isCollapsed}
              aria-controls="ollama-pane-body"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsCollapsed((c) => !c);
                }
              }}
            >
              <h2 id="ollama-modal-title" className="text-lg font-bold text-amber-300 truncate">
                Ollama Dependency
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={isCollapsed ? 'Expand pane' : 'Collapse pane'}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                  className="p-1.5 rounded text-gray-400 hover:text-amber-200 hover:bg-gray-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCollapsed((c) => !c);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-[400ms] ${isCollapsed ? '' : 'rotate-180'}`}
                    aria-hidden="true"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Close pane"
                  title="Close"
                  className="p-1.5 rounded text-gray-400 hover:text-amber-200 hover:bg-gray-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Collapsible body */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  id="ollama-pane-body"
                  key="ollama-pane-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: collapseAnimationDurationSeconds, ease: 'easeOut' }}
                  className="overflow-y-auto"
                >
                  <div className="p-5">
                    <div className="space-y-4 text-sm text-gray-300 leading-relaxed mb-6">
                      <p>
                        Aralia uses <strong>Ollama</strong>, a local AI service, to power dynamic companion commentary and AI-generated dialogue.
                        This enriches the roleplay experience with contextual reactions and banter from your party members.
                      </p>

                      <div className="bg-gray-800/50 border-l-4 border-amber-500/40 p-4 rounded">
                        <h3 className="text-amber-200 font-semibold mb-2">ℹ️ What's Ollama?</h3>
                        <p>
                          Ollama is an open-source tool that runs large language models locally on your computer.
                          This means AI features work entirely offline, with no data sent to external servers.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-amber-200 font-semibold mb-2">Features requiring Ollama:</h3>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>AI-generated companion reactions to events (loot, crimes, discoveries)</li>
                          <li>Dynamic companion banter and dialogue</li>
                          <li>Character-specific response generation</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-amber-200 font-semibold mb-2">Without Ollama:</h3>
                        <p>
                          The game will function normally—companions will simply use pre-written dialogue and reactions instead of AI-generated ones.
                          The roleplay experience is fully intact, just without the dynamic AI enhancement.
                        </p>
                      </div>
                    </div>

                    {/* Reusable premium Checkbox primitive for tracking user preference */}
                    <div className="mb-6">
                      <Checkbox
                        label="Don't show this again"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end space-x-3">
                      <Button onClick={handleLearnMore} variant="secondary" size="md">
                        Learn More
                      </Button>
                      <Button onClick={handleClose} variant="action" size="md">
                        Continue
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
