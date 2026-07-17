// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:12
 * Dependents: App.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Translates a finished combat into application-level state actions. CombatView
 * reports the outcome; App owns whether play resumes or reaches game over.
 */
import type { AppAction } from "../../state/actionTypes";
import { GamePhase, type Item } from "../../types";
import type {
  CombatEnemySnapshotEntry,
  CombatPartySnapshotEntry,
} from "../../types/combat";

export type BattleEndResult = "victory" | "defeat";
export type BattleRewards = { gold: number; items: Item[]; xp: number };

// Victory keeps the established reward path. Defeat tears combat down first,
// then enters the terminal screen instead of resuming exploration.
export const createBattleEndActions = (
  result: BattleEndResult,
  rewards?: BattleRewards,
  finalPartyState?: CombatPartySnapshotEntry[],
  finalEnemyState?: CombatEnemySnapshotEntry[],
): AppAction[] => {
  // WorldForge must see final source identities while the tactical map still
  // exists. This action intentionally precedes END_BATTLE, which clears both
  // the enemy roster and the extracted source map from application state.
  const sourceOutcomeActions: AppAction[] = finalEnemyState?.length
    ? [
        {
          type: "RESOLVE_WORLDFORGE_OPENING_SCENE",
          payload: { result, finalEnemyState },
        },
      ]
    : [];

  if (result === "victory") {
    return [
      ...sourceOutcomeActions,
      {
        type: "END_BATTLE",
        ...(rewards ? { payload: { rewards, finalPartyState } } : {}),
      },
    ];
  }

  return [
    ...sourceOutcomeActions,
    { type: "END_BATTLE" },
    { type: "SET_GAME_PHASE", payload: GamePhase.GAME_OVER },
  ];
};
