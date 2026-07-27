/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:55:12
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/Party/RelationshipsPane.tsx
 * Imports: 3 files
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
 * @file src/components/ui/CompanionCard.tsx
 * Displays detailed information about a companion: relationships, approval, and goals.
 * @component-owner Narrative Team / Core UI
 */
import React from 'react';
import { Companion } from '../../types/companions';
interface CompanionCardProps {
    companion: Companion;
    playerId?: string;
}
export declare const CompanionCard: React.FC<CompanionCardProps>;
export {};
