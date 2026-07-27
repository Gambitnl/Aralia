/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:29:58
 * Dependents: worldReducer.ts
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
 * @file src/systems/economy/InvestmentManager.ts
 * Static utility class for processing player investments daily:
 * caravan returns, speculation value changes, and loan interest.
 */
import { PlayerInvestment, EconomyState } from '../../types/economy';
import { SeededRandom } from '@/utils/random';
export interface InvestmentProcessResult {
    investments: PlayerInvestment[];
    goldChange: number;
    completedIds: string[];
    failedIds: string[];
    logs: string[];
}
/**
 * Process all player investments for one day.
 * Caravans progress toward completion, loans accrue interest,
 * speculation values shift with market conditions.
 */
export declare const processAllInvestments: (investments: PlayerInvestment[], economy: EconomyState, gameDay: number, rng: SeededRandom) => InvestmentProcessResult;
