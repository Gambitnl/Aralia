/**
 * Gives the walking view access to the same saved message history as ordinary
 * exploration. WorldPane owns dates, speaker styling, glossary links and scroll
 * following; this window only owns reading and dismissal. It writes no history.
 * World3DWrapper holds walking while the window is open.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 15:20:52
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect } from 'react';
import type { GameMessage } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalOrchestration } from '../../hooks/useModalOrchestration';
import WorldPane from '../WorldPane';
import { WindowFrame } from '../ui/WindowFrame';

interface WorldMessageLogProps {
  isOpen: boolean;
  messages: GameMessage[];
  openingStatus?: string;
  onClose: () => void;
}

export default function WorldMessageLog({ isOpen, messages, openingStatus, onClose }: WorldMessageLogProps) {
  const focusRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useModalOrchestration([{ id: 'world-message-log', isOpen, locksBackgroundScroll: true }]);
  useEffect(() => {
    if (!isOpen) return;
    // Let the existing document focus trap handle Tab and Escape first, then
    // keep window gameplay shortcuts behind the reader. Browser scrolling and
    // ordinary button activation retain their default behavior.
    const ownKeyboard = (event: KeyboardEvent) => event.stopPropagation();
    document.addEventListener('keydown', ownKeyboard);
    return () => document.removeEventListener('keydown', ownKeyboard);
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    // The backdrop catches outside clicks while reading. The shared frame still
    // supplies desktop resizing; Escape and Close restore the launching focus.
    <div ref={focusRef} tabIndex={-1} className="absolute inset-0 z-50 bg-black/30">
      <WindowFrame title="Adventure log" onClose={onClose} storageKey="world-message-log" initialMaximized={false}>
        <div className="flex h-full min-h-0 flex-col p-3">
          <WorldPane messages={messages} openingStatus={openingStatus} />
        </div>
      </WindowFrame>
    </div>
  );
}
