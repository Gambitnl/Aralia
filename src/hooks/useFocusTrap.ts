// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 03/06/2026, 00:43:01
 * Dependents: components/ActionPane/SystemMenu.tsx, components/CharacterSheet/LevelUpModal.tsx, components/Combat/ReactionPrompt.tsx, components/Dialogue/DialogueInterface.tsx, components/Economy/CourierPouch.tsx, components/Economy/InvestmentBoard.tsx, components/Economy/LedgerBook.tsx, components/Religion/TempleModal.tsx, components/Town/PassTimeModal.tsx, components/Trade/MerchantModal.tsx, components/puzzles/LockpickingModal.tsx, components/ui/ConfirmationModal.tsx, components/ui/GameGuideModal.tsx, components/ui/ImageModal.tsx, components/ui/LongRestModal.tsx, components/ui/MissingChoiceModal.tsx, components/ui/RestModal.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

/**
 * Hook to trap focus within a container when it is active.
 *
 * WHAT CHANGED (G7 fix): Added focus restoration on component unmount and
 * optional `restoreFocusTo` override. Previously, if a modal was removed
 * from the DOM while `isOpen` was still true (conditional rendering in
 * GameModals.tsx), the first useEffect had no cleanup and focus was lost
 * to `document.body`. Now the cleanup restores focus on unmount, and
 * callers can supply a custom restoration target.
 *
 * @param isOpen - Whether the focus trap should be active.
 * @param onClose - Optional callback to handle Escape key.
 * @param restoreFocusTo - Optional element ref to restore focus to on close/unmount
 *   instead of the element that was focused when the trap activated.
 * @returns A ref to attach to the container element.
 */
export const useFocusTrap = <T extends HTMLElement>(
  isOpen: boolean,
  onClose?: () => void,
  restoreFocusTo?: RefObject<HTMLElement | null>,
) => {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Restore focus to the appropriate element. Prefers the caller-supplied
   * `restoreFocusTo` target, then falls back to the element that was focused
   * when the trap activated.
   */
  const restoreFocus = useCallback(() => {
    const target = restoreFocusTo?.current ?? previousFocusRef.current;
    if (target && typeof target.focus === 'function') {
      // Defer to next frame so the DOM has settled after unmount/transition.
      requestAnimationFrame(() => target.focus());
    }
  }, [restoreFocusTo]);

  // Activate / deactivate trap when isOpen changes.
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element for later restoration.
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the container or the first focusable element inside it.
      if (containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
        } else {
          containerRef.current.focus();
        }
      }
    } else {
      // Restore focus when closed via state transition.
      restoreFocus();
    }

    // Cleanup: restore focus on unmount while trap was still active.
    return () => {
      if (isOpen) {
        restoreFocus();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !containerRef.current) return;

      if (e.key === 'Escape') {
        if (onClose) {
          onClose();
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return containerRef;
};
