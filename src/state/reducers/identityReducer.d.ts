/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/identityReducer.ts
 * Reducer for identity and intrigue actions.
 */
import { GameState } from '../../types/index';
import { AppAction } from '../actionTypes';
export declare function identityReducer(state: GameState, action: AppAction): Partial<GameState>;
