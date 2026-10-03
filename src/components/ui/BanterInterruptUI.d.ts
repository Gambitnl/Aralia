/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 01:12:02
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/ui/BanterInterruptUI.tsx
 * @component-owner Narrative Team / Core UI
 * @status Stable / Maintained
 *
 * Floating UI that appears during active banter, allowing the player to join the conversation.
 *
 * Called by: src/components/CollapsibleBanterPanel.tsx
 * Depends on: Input.tsx, zIndex.ts
 */
import React from 'react';
interface BanterInterruptUIProps {
    isActive: boolean;
    isWaiting: boolean;
    secondsRemaining: number;
    onInterrupt: (message: string) => void;
    onEndBanter: () => void;
}
export declare const BanterInterruptUI: React.FC<BanterInterruptUIProps>;
export default BanterInterruptUI;
