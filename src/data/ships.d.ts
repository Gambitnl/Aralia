/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/ships.ts
 * Base definitions for ship types available in the game.
 */
import { ShipType, ShipSize, ShipStats } from '../types/naval';
export declare const SHIP_TEMPLATES: Record<ShipType, {
    size: ShipSize;
    baseStats: ShipStats;
    description: string;
    defaultWeapons?: number;
}>;
