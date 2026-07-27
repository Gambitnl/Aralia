/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/mechanism.ts
 * Defines the Mechanism system for physical interactions (levers, winches, etc.)
 * that are distinct from Locks (barriers) and Puzzles (intellectual challenges).
 */
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { Mechanism, MechanismOperationResult } from './types';
/**
 * Attempts to operate a physical mechanism.
 *
 * @param character The character performing the action.
 * @param mechanism The mechanism object.
 * @param inventory The character's inventory (to check for tools).
 * @returns MechanismOperationResult
 */
export declare function operateMechanism(character: PlayerCharacter, mechanism: Mechanism, inventory: Item[]): MechanismOperationResult;
