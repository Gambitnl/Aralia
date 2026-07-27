/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/TavernGossipSystem.ts
 * Manages the generation and purchase of rumors and secrets in taverns.
 */
import { GameState, WorldRumor } from '../../types';
import { Secret } from '../../types/identity';
export interface PurchaseableRumor {
    id: string;
    type: 'rumor' | 'secret' | 'lead';
    cost: number;
    title: string;
    content?: string;
    payload?: WorldRumor | Secret;
}
export declare class TavernGossipSystem {
    /**
     * Generates a list of rumors available for purchase at a specific location/time.
     * Deterministic based on game seed + time + location, so it persists for the day.
     */
    static getAvailableRumors(state: GameState, locationId?: string): PurchaseableRumor[];
}
