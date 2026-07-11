// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/07/2026, 14:01:41
 * Dependents: components/Combat/ReactionPrompt.tsx, components/ui/ConfirmationModal.tsx, components/ui/LongRestModal.tsx, components/ui/MissingChoiceModal.tsx, components/ui/RestModal.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/ui/ModalDialog.tsx
 * The app's shared BLOCKING dialog shell — the counterpart to `WindowFrame`.
 *
 * WindowFrame is for floating, draggable content windows (map, party, shop,
 * conversation…). ModalDialog is for the other kind: a small, centered, blocking
 * popup that dims the screen and demands a decision — confirmations, forced
 * choices, rest setup, a dependency warning. Before this, each of those
 * hand-rolled the same portal + dim backdrop + focus-trap + centered panel, so
 * they drifted apart. This centralizes that skeleton (extracted from the
 * well-worn `ConfirmationModal`): a document-root portal (so it sits above any
 * WindowFrame it was opened from), a dim backdrop, `useFocusTrap` (Tab wrap +
 * Escape-to-close + focus restore), and a sized centered panel with an optional
 * title and a footer action row.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Z_INDEX } from '../../styles/zIndex';

export type ModalDialogSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalDialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Heading. A string gets the standard dialog title styling. */
  title?: React.ReactNode;
  size?: ModalDialogSize;
  /** Action row pinned under the body (e.g. Cancel / Confirm buttons). */
  footer?: React.ReactNode;
  /** Show an ✕ in the header. Off by default — confirms exit via explicit buttons. */
  showClose?: boolean;
  /** Click on the dim backdrop closes. Off by default — a risky confirm should not dismiss on a stray click. */
  closeOnBackdrop?: boolean;
  /** Panel accent border. Callers keep their identity (e.g. purple for a reaction prompt). */
  accentClass?: string;
  /** id of an element describing the dialog, wired to the panel's `aria-describedby` for screen readers. */
  ariaDescribedBy?: string;
  /** Stable accessible name for custom headers that also contain controls. */
  ariaLabel?: string;
  /** Stacking layer; defaults to the confirm layer so a dialog sits above windows. */
  zIndex?: number;
  id?: string;
  testId?: string;
  children: React.ReactNode;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  footer,
  showClose = false,
  closeOnBackdrop = false,
  accentClass = 'border-amber-500/60',
  ariaDescribedBy,
  ariaLabel,
  zIndex = Z_INDEX.CONFIRMATION_MODAL,
  id,
  testId,
  children,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const titleId = id ? `${id}-title` : undefined;

  // A custom header may contain its own close button. When callers provide an
  // explicit label, prefer it so the control's glyph/name cannot become part of
  // the dialog title announced by assistive technology.
  const layer = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={id}
          data-testid={testId}
          className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={closeOnBackdrop ? onClose : undefined}
        >
          <motion.div
            ref={dialogRef}
            className={`max-h-[calc(100vh-2rem)] w-full ${SIZE_CLASS[size]} overflow-y-auto rounded-xl border ${accentClass} bg-gray-900 p-6 text-gray-100 shadow-xl focus:outline-none scrollable-content`}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-describedby={ariaDescribedBy}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showClose) && (
              <div className="mb-3 flex items-start justify-between gap-4">
                {typeof title === 'string' ? (
                  <h3 id={titleId} className="text-xl font-bold text-amber-300">{title}</h3>
                ) : (
                  <div id={titleId} className="min-w-0">{title}</div>
                )}
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-700 text-xl leading-none text-gray-400 transition-colors hover:border-red-800/60 hover:bg-red-900/30 hover:text-red-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
            {footer && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return layer;
  return createPortal(layer, document.body);
};

export default ModalDialog;
