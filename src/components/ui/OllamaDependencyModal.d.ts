/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/07/2026, 01:10:13
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import React from 'react';
interface OllamaDependencyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDontShowAgain: (value: boolean) => void;
    /**
     * Dev Mode exposes operator-only wiring such as the local proxy path.
     * Normal players should only see direct Groq key modes they can set up alone.
     */
    isDevModeEnabled?: boolean;
    /**
     * Optional callback fired after the player switches provider (to Groq or back
     * to Ollama). The host can use this to re-run the availability check / retry
     * the blocked generation. Falls back to onClose when omitted.
     */
    onProviderChanged?: (provider: 'ollama' | 'groq') => void;
}
export declare const OllamaDependencyModal: React.FC<OllamaDependencyModalProps>;
export {};
