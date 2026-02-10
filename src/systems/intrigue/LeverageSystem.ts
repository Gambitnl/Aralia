/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/LeverageSystem.ts
 * Manages the application of Secrets as leverage to gain favors, currency, or information.
 */

import { Secret } from '../../types/identity';
// TODO(lint-intent): 'Faction' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Faction as _Faction } from '../../types/factions';
import { SeededRandom } from '@/utils/random';

export type LeverageGoal = 'blackmail' | 'information' | 'favor' | 'safe_passage' | 'forced_sale';
export type LeverageOutcome = 'success' | 'failure' | 'backfire';

export interface LeverageAttempt {
    secretId: string;
    targetId: string; // Faction or NPC ID
    goal: LeverageGoal;
}

export interface LeverageResult {
    outcome: LeverageOutcome;
    message: string;
    rewards?: {
        gold?: number;
        favor?: number; // Reputation gain (or loss mitigation)
        intel?: string; // New information gained
        forcedSaleDiscount?: number; // Percent discount on forced business sale (20-50)
    };
    consequences?: {
        reputationLoss?: number;
        hostility?: boolean; // Target becomes hostile
        secretBurned: boolean; // Is the secret now useless/public?
    };
}

export class LeverageSystem {
    private rng: SeededRandom;

    constructor(seed: number = Date.now()) {
        this.rng = new SeededRandom(seed);
    }

    /**
     * Calculates the "DC" or resistance of a target to being leveraged.
     * @param secret The secret being used.
     * @param targetPower The power/influence of the target (0-100).
     * @param currentReputation The current standing with the target (-100 to 100).
     */
    calculateLeverageResistance(secret: Secret, targetPower: number, currentReputation: number): number {
        // Base resistance is derived from target power
        let resistance = targetPower / 2;

        // Higher value secrets are harder to ignore, but also provoke stronger defense
        // We simulate resistance to the *act* of blackmail here.
        // A high value secret actually *reduces* effective resistance because it's so damaging if released.
        // Formula: Resistance = (Power / 2) - (SecretValue * 5)

        resistance -= (secret.value * 5);

        // If they hate you, they might fight back harder (or be more desperate)
        // If they like you, they might be more willing to deal to save face gently.
        // For now, let's say:
        // Hated (-100): +20 resistance (spite)
        // Loved (+100): -20 resistance (willingness to negotiate)
        resistance -= (currentReputation / 5);

        // Cap resistance between 0 and 100 roughly
        return Math.max(5, Math.min(95, resistance + 50));
    }

    /**
     * Attempts to use a secret as leverage against a target.
     */
    applyLeverage(
        attempt: LeverageAttempt,
        secret: Secret,
        target: { id: string, name: string, power: number, reputation: number }
    ): LeverageResult {
        if (secret.subjectId !== target.id) {
             // In a real complex system, you could blackmail someone with a secret about their ally.
             // For this MVP, we enforce direct subject match for simplicity,
             // or assume the caller has validated the link.
             // Let's allow indirect if the caller allows it, but here we just process the math.
        }

        const resistance = this.calculateLeverageResistance(secret, target.power, target.reputation);
        const roll = this.rng.nextInt(1, 100);

        // Modifiers? e.g. Intimidation skill would go here.
        // For now, raw roll vs resistance (DC).
        // Success if Roll > Resistance
        // Wait, 'Resistance' is a DC. So Roll + Bonuses >= Resistance.
        // Let's treat 'Resistance' as the Target Target Number (DC).

        const success = roll >= resistance;

        // Critical failure check (Natural 1-5 or very low margin)
        const isBackfire = roll < (resistance / 2) || roll <= 5;

        if (isBackfire) {
            return {
                outcome: 'backfire',
                message: `The attempt to blackmail ${target.name} backfired spectacularly. They denied the claim and declared you an enemy.`,
                consequences: {
                    reputationLoss: 20 + secret.value,
                    hostility: true,
                    secretBurned: true // They "inoculated" themselves against it or proved it false
                }
            };
        }

        if (!success) {
            return {
                outcome: 'failure',
                message: `${target.name} refused your demands, calling your bluff.`,
                consequences: {
                    reputationLoss: 5,
                    hostility: false,
                    secretBurned: false // You can try again later or with more proof
                }
            };
        }

        // Success! Calculate rewards
        return this.generateRewards(attempt.goal, secret, target);
    }

    private generateRewards(goal: LeverageGoal, secret: Secret, target: { name: string }): LeverageResult {
        const rewards: NonNullable<LeverageResult['rewards']> = {};
        const result: LeverageResult = {
            outcome: 'success',
            message: `You successfully leveraged the secret against ${target.name}.`,
            rewards,
            consequences: {
                secretBurned: true // Usually, using a secret "spends" it (they pay you to destroy proof)
            }
        };

        const valueMultiplier = secret.verified ? 1.5 : 1.0;
        const baseReward = secret.value * 100; // e.g. Value 5 = 500gp equivalent

        switch (goal) {
            case 'blackmail': // Gold
                rewards.gold = Math.floor(baseReward * valueMultiplier);
                result.message += ` They paid ${rewards.gold} gold for your silence.`;
                break;
            case 'favor': // Reputation
                rewards.favor = secret.value * 2 * valueMultiplier;
                result.message += ` They owe you a significant debt. Standing increased by ${rewards.favor}.`;
                result.consequences!.secretBurned = true;
                break;
            case 'information':
                rewards.intel = `New Lead: The ${target.name} has a vulnerability in the West Wing.`; // Placeholder
                result.message += ` They provided key information.`;
                break;
            case 'safe_passage':
                result.message += ` They have granted you safe passage through their territory.`;
                break;
            case 'forced_sale': {
                // Forced business sale: discount scales with secret value (20-50%)
                const discount = Math.min(50, 20 + secret.value * 3);
                rewards.forcedSaleDiscount = discount;
                result.message += ` Under pressure, they agree to sell their business at a ${discount}% discount.`;
                break;
            }
        }

        return result;
    }
}
