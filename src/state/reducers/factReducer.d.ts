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
export declare function factReducer(state: GameState, action: AppAction): Partial<GameState>;
