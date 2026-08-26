/**
 * @file src/components/Compendium/CompendiumModal.tsx
 *
 * This component renders a draggable, resizable floating modal containing the full
 * PHB 2024 Rules Compendium (Conditions, Cover & Obscurement, Combat Actions, and
 * Weapon Mastery properties).
 *
 * Why it exists:
 * In Aralia, players and DMs can open the Rules Compendium during exploration,
 * character creation, or active combat without losing their current gameplay context.
 * It uses the standard WindowFrame system for persistent window geometry and clean
 * window management controls (minimize, maximize, drag, resize, and escape-to-close).
 *
 * Called by: GameModals.tsx, MainMenu, or Hotkey shortcuts
 * Depends on: WindowFrame, CompendiumRuleTables, and types
 */

import React, { useEffect } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import { CompendiumRuleTables, CompendiumTab } from './CompendiumRuleTables';

// ============================================================================
// Props Definition
// ============================================================================
// Controls modal visibility, initial tab routing, and glossary cross-linking.
// ============================================================================

export interface CompendiumModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional initial tab when opening ('conditions', 'cover_obscurement', 'combat_actions', 'weapon_mastery', 'all') */
  initialTab?: CompendiumTab;
  /** Optional callback fired when navigating to a glossary term */
  onNavigate?: (termId: string) => void;
}

// ============================================================================
// Compendium Modal Component
// ============================================================================
// Renders the floating window frame wrapped around CompendiumRuleTables.
// ============================================================================

export const CompendiumModal: React.FC<CompendiumModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'conditions',
  onNavigate,
}) => {
  // Listen for Escape key press to dismiss the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      data-testid="compendium-modal"
    >
      <div className="pointer-events-auto w-full max-w-6xl h-[85vh]">
        <WindowFrame
          title="PHB 2024 Rules Compendium"
          onClose={onClose}
          storageKey="compendium-rules-window"
          initialMaximized={false}
          minimumSize={{ width: 680, height: 480 }}
        >
          <div className="p-4 overflow-y-auto h-[calc(100%-2.5rem)] bg-gray-950/90 rounded-b-lg">
            <CompendiumRuleTables
              initialTab={initialTab}
              onNavigate={onNavigate}
            />
          </div>
        </WindowFrame>
      </div>
    </div>
  );
};
