/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:12:11
 * Dependents: state/reducers/companionReducer.ts
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
 * @file src/systems/companions/RelationshipManager.ts
 * Manages companion relationships, approval changes, and loyalty checks.
 */
import { Companion, RelationshipLevel } from '../../types/companions';
export declare class RelationshipManager {
    private static readonly APPROVAL_THRESHOLDS;
    private static readonly LOYALTY_RETENTION_FLOOR;
    /**
     * Calculates the new approval value and returns the updated companion state.
     */
    static processApprovalEvent(companion: Companion, targetId: string, // Usually player ID
    change: number, reason: string): Companion;
    static getRelationshipLevel(approval: number): RelationshipLevel;
    static checkLoyalty(companion: Companion): boolean;
}
