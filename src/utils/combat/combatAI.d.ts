/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 19:55:56
 * Dependents: hooks/combat/useCombatAI.ts, hooks/combat/useTurnManager.ts, utils/combat/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file combatAI.ts
 */
import { CombatCharacter, CombatAction, BattleMapData } from '../../types/combat';
/**
 * Evaluates the combat state and returns the best action for the given AI character.
 *
 * The AI uses a "Score-based Utility" approach:
 * 1. It identifies all possible valid actions (abilities, movement).
 * 2. It generates a "Plan" for each possibility.
 * 3. It scores each plan based on heuristics (damage, healing, survival).
 * 4. It executes the plan with the highest score.
 *
 * The evaluator is intentionally greedy but aware of positioning: it will move into
 * range/LoS for a high-value cast, heal allies, or retreat when threatened.
 *
 * @param character - The AI character taking the turn.
 * @param characters - All characters in the combat (enemies and allies).
 * @param mapData - The current state of the battle map.
 * @returns The chosen CombatAction to execute.
 */
export declare function evaluateCombatTurn(character: CombatCharacter, characters: CombatCharacter[], mapData: BattleMapData): CombatAction;
