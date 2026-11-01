/**
 * Translates a finished combat into application-level state actions. CombatView
 * reports the outcome; App owns whether play resumes or reaches game over.
 *
 * The final enemy roster travels twice on a victory, to two different consumers:
 * `RESOLVE_WORLDFORGE_OPENING_SCENE` reconciles source-authored identities while
 * the tactical map still exists, and `END_BATTLE` carries it so post-combat
 * consequences can read which enemies were actually killed (agora-31fa).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:54:15
 * Dependents: components/screens/AppPhaseContent.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { AppAction } from "../../state/actionTypes";
import { GamePhase, type Item } from "../../types";
import type {
  CombatEnemySnapshotEntry,
  CombatPartySnapshotEntry,
} from "../../types/combat";

import type { CombatOutcomeReview } from "../../types/combatOutcome";

export type BattleEndResult = "victory" | "defeat" | "flee";
export type BattleRewards = { gold: number; items: Item[]; xp: number };

// Victory keeps the established reward path. Defeat tears combat down first,
// then enters the terminal screen instead of resuming exploration.
export const createBattleEndActions = (
  result: BattleEndResult,
  rewards?: BattleRewards,
  finalPartyState?: CombatPartySnapshotEntry[],
  finalEnemyState?: CombatEnemySnapshotEntry[],
  dungeonEncounterId?: string,
  outcomeReview?: CombatOutcomeReview,
): AppAction[] => {
  const dungeonPayload = dungeonEncounterId ? {dungeonEncounterId, finalPartyState, finalEnemyState} : {};
  const reviewPayload = outcomeReview ? {outcomeReview: {...outcomeReview, result}} : {};
  const hasFinalPayload = Boolean(dungeonEncounterId || finalPartyState || finalEnemyState || outcomeReview);
  // WorldForge must see final source identities while the tactical map still
  // exists. This action intentionally precedes END_BATTLE, which clears both
  // the enemy roster and the extracted source map from application state.
  const sourceOutcomeActions: AppAction[] = result !== "flee" && finalEnemyState?.length
    ? [
        {
          type: "RESOLVE_WORLDFORGE_OPENING_SCENE",
          payload: { result, finalEnemyState },
        },
      ]
    : [];

  // A retreat preserves the party's final health but grants no victory rewards
  // and does not resolve the source scene as a victory or defeat.
  if (result === "flee") {
    return [{ type: "END_BATTLE", payload: { finalPartyState, finalEnemyState, ...dungeonPayload, ...reviewPayload } }];
  }

  if (result === "victory") {
    return [
      ...sourceOutcomeActions,
      {
        type: "END_BATTLE",
        ...(rewards
          ? { payload: { rewards, finalPartyState, finalEnemyState, ...dungeonPayload, ...reviewPayload } }
          : hasFinalPayload ? {payload: {finalPartyState, finalEnemyState, ...dungeonPayload, ...reviewPayload}} : {}),
      },
    ];
  }

  return [
    ...sourceOutcomeActions,
    // A loss still spends HP and abilities outside dungeons. Source identity
    // changes the reconciliation, never whether the final party is retained.
    { type: "END_BATTLE", ...(hasFinalPayload ? {payload: {finalPartyState, finalEnemyState, ...dungeonPayload, ...reviewPayload}} : {}) },
    { type: "SET_GAME_PHASE", payload: GamePhase.GAME_OVER },
  ];
};
