/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/LeverageSystem.ts
 * Manages the application of Secrets as leverage to gain favors, currency, or information.
 */
import { Secret } from '../../types/identity';
export type LeverageGoal = 'blackmail' | 'information' | 'favor' | 'safe_passage' | 'forced_sale';
export type LeverageOutcome = 'success' | 'failure' | 'backfire';
export interface LeverageAttempt {
    secretId: string;
    targetId: string;
    goal: LeverageGoal;
}
export interface LeverageResult {
    outcome: LeverageOutcome;
    message: string;
    rewards?: {
        gold?: number;
        favor?: number;
        intel?: string;
        forcedSaleDiscount?: number;
    };
    consequences?: {
        reputationLoss?: number;
        hostility?: boolean;
        secretBurned: boolean;
    };
}
export declare class LeverageSystem {
    private rng;
    constructor(seed?: number);
    /**
     * Calculates the "DC" or resistance of a target to being leveraged.
     * @param secret The secret being used.
     * @param targetPower The power/influence of the target (0-100).
     * @param currentReputation The current standing with the target (-100 to 100).
     */
    calculateLeverageResistance(secret: Secret, targetPower: number, currentReputation: number): number;
    /**
     * Attempts to use a secret as leverage against a target.
     */
    applyLeverage(attempt: LeverageAttempt, secret: Secret, target: {
        id: string;
        name: string;
        power: number;
        reputation: number;
    }): LeverageResult;
    private generateRewards;
}
