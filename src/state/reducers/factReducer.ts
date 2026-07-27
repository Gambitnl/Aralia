/**
 * @file src/state/reducers/factReducer.ts
 * Slice reducer for the durable, world-level fact store (DIAL-002 + DIAL-004).
 *
 * Facts are world knowledge the PLAYER has durably learned (e.g. an NPC told
 * you something that unlocks topics with other NPCs). They are global, survive
 * save/reload (the store serializes with GameState), and are healed on the fly
 * for saves created before the store existed.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import {
  hasWorldFact,
  learnWorldFact,
  normalizeWorldFactStore,
} from '../../systems/facts/worldFactStore';

export function factReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'LEARN_WORLD_FACT': {
      const { fact } = action.payload;
      // A fact is learned once — first provenance wins, re-learning is a no-op.
      if (hasWorldFact(state.worldFacts, fact.key)) return {};
      // Heal-on-write: legacy saves have no store; malformed ones are dropped.
      const store = normalizeWorldFactStore(state.worldFacts);
      return { worldFacts: learnWorldFact(store, fact) };
    }

    default:
      return {};
  }
}
