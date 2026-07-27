/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/NobleIntrigueManager.ts
 * Manages procedural noble house intrigue events based on faction personalities.
 */
import { GameState } from '../../types';
import { SeededRandom } from '@/utils/random';
import { WorldEventResult } from './WorldEventManager';
/**
 * Attempts to generate a noble intrigue event based on faction personalities.
 */
export declare const generateNobleIntrigue: (state: GameState, rng: SeededRandom) => WorldEventResult;
