/**
 * Translates a finished combat into application-level state actions. CombatView
 * reports the outcome; App owns whether play resumes or reaches game over.
 */
import type { AppAction } from '../../state/actionTypes';
import { GamePhase, type Item } from '../../types';
import type { CombatPartySnapshotEntry } from '../../types/combat';

export type BattleEndResult = 'victory' | 'defeat';
export type BattleRewards = { gold: number; items: Item[]; xp: number };

// Victory keeps the established reward path. Defeat tears combat down first,
// then enters the terminal screen instead of resuming exploration.
export const createBattleEndActions = (
  result: BattleEndResult,
  rewards?: BattleRewards,
  finalPartyState?: CombatPartySnapshotEntry[],
): AppAction[] => result === 'victory'
  ? [{ type: 'END_BATTLE', ...(rewards ? { payload: { rewards, finalPartyState } } : {}) }]
  : [{ type: 'END_BATTLE' }, { type: 'SET_GAME_PHASE', payload: GamePhase.GAME_OVER }];
