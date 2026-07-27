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
export type ModalDialogSize = 'sm' | 'md' | 'lg' | 'xl';
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
export declare const ModalDialog: React.FC<ModalDialogProps>;
export default ModalDialog;
