/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 07:59:58
 * Dependents: components/ActionPane/index.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { Action } from '../../types';
interface SystemMenuProps {
    onAction: (action: Action) => void;
    disabled: boolean;
    unreadDiscoveryCount: number;
    hasNewRateLimitError: boolean;
    isDevModeEnabled: boolean;
    autoSaveEnabled: boolean;
}
export declare const SystemMenu: React.FC<SystemMenuProps>;
export {};
