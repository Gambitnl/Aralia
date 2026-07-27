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
export declare const useFocusTrap: <T extends HTMLElement>(isOpen: boolean, onClose?: () => void, restoreFocusTo?: RefObject<HTMLElement | null>) => RefObject<T>;
