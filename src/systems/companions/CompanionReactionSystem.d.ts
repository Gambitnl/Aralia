/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 08/06/2026, 13:34:24
 * Dependents: None (Orphan)
 * Imports: 1 files
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
 * @file src/systems/companions/CompanionReactionSystem.ts
 * Evaluates companion reactions to player decisions.
 */
import { Companion, DecisionContext, ReactionResult } from '../../types/companions';
export declare class CompanionReactionSystem {
    /**
     * Evaluates how a companion reacts to a specific decision context.
     * Returns a ReactionResult if they react, or null if they don't care.
     */
    static evaluateReaction(companion: Companion, context: DecisionContext): ReactionResult | null;
}
