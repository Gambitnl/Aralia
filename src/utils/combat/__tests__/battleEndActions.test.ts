/** Proves victory and defeat take their intended App-shell routes. */
import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../types';
import { createBattleEndActions } from '../battleEndActions';

describe('createBattleEndActions', () => {
  it('settles victory through END_BATTLE', () => {
    const rewards = { gold: 12, items: [], xp: 50 };
    expect(createBattleEndActions('victory', rewards)).toEqual([
      { type: 'END_BATTLE', payload: { rewards, finalPartyState: undefined } },
    ]);
  });

  it('routes defeat through teardown to game over', () => {
    expect(createBattleEndActions('defeat')).toEqual([
      { type: 'END_BATTLE' },
      { type: 'SET_GAME_PHASE', payload: GamePhase.GAME_OVER },
    ]);
  });
});
