/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 06:13:08
 * Dependents: systems/religion/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Dispatch } from 'react';
import { TempleService, GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
export interface ServiceResult {
    success: boolean;
    message: string;
    effectApplied?: string;
    costDeducted?: number;
}
/**
 * System to handle Temple interactions, service validation, and effect application.
 */
export declare class TempleSystem {
    /**
     * Validates if a party/character can request a service.
     */
    static validateServiceRequest(service: TempleService, gameState: GameState, deityId: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Performs the service transaction: deducts gold and applies effects.
     */
    static performService(service: TempleService, gameState: GameState, deityId: string, dispatch: Dispatch<AppAction>): ServiceResult;
    /**
     * Resolves the effect string/object into actual game actions.
     */
    private static resolveServiceEffect;
}
