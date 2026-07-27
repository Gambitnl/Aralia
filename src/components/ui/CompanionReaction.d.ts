/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:55:13
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewComponents.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ui/CompanionReaction.tsx
 * A component to display transient companion reactions/bubbles.
 * @component-owner Narrative Team / Core UI
 */
import React from 'react';
import { Companion } from '../../types/companions';
import { GameMessage } from '../../types';
interface CompanionReactionProps {
    companions: Record<string, Companion>;
    latestMessage?: GameMessage;
}
export declare const CompanionReaction: React.FC<CompanionReactionProps>;
export {};
