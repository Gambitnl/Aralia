/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/LeverageSystem.ts
 * Manages the application of Secrets as leverage to gain favors, currency, or information.
 */

import { Secret } from '../../types/identity';
import { SeededRandom } from '@/utils/random';

/** The categories a Secret can carry. Drives which intel a cornered target gives up. */
type SecretTag = Secret['tags'][number];

/**
 * The vulnerability pool the 'information' goal draws from (agora-0437).
 *
 * Keyed by the KIND of dirt used to corner the target, because a target gives
 * up what they are already thinking about: squeeze someone over a criminal
 * secret and they hand you the fence's name, squeeze them over a ledger and
 * they hand you the ledger. `{target}` is the party that talked.
 *
 * This replaces the single "vulnerability in the West Wing" placeholder, which
 * said the same sentence about every faction in the world.
 */
const INTEL_LEADS_BY_TAG: Record<SecretTag, string[]> = {
    political: [
        'Two seats on the council are bought outright, and {target} pays for them through a wine factor.',
        "The charter {target} governs under lapsed a season ago and was never renewed.",
        "A rival already holds {target}'s letters to the border lords, and is waiting for a price.",
    ],
    military: [
        'The night watch {target} keeps is one company short, and the roster is padded with dead names.',
        "{target}'s armoury was emptied to pay a debt; the racks are filled with unfinished blanks.",
        'A captain in {target} sells the patrol schedule by the month.',
    ],
    personal: [
        "{target}'s heir is not their heir, and two servants can say so under oath.",
        'The physician attending {target} has been paid to keep one illness off the books.',
        "{target} writes to someone in a hand that is not their own, through a laundress.",
    ],
    criminal: [
        '{target} fences through a chandler by the river gate, on the nights the tide is out.',
        "The watch captain who buried {target}'s last case kept the original ledger.",
        'A body {target} paid to lose was never lost, only moved.',
    ],
    supernatural: [
        '{target} keeps a locked room that is opened once a month, always at the same hour.',
        'Something in the service of {target} does not age, and the household has stopped mentioning it.',
        "{target} pays a tithe to a name no temple in the region will say aloud.",
    ],
    financial: [
        "{target}'s books show a vault that has been empty since midwinter.",
        'Three of the creditors {target} lists are the same person under different names.',
        '{target} has pledged the same cargo to two houses, and both expect it.',
    ],
    magical: [
        'The ward on the {target} strongroom fails for an hour whenever the caster is dosed for pain.',
        '{target} bought a contract from a broker who never delivered, and cannot say so publicly.',
        'The charm holding {target}’s bargain together is worn through and has not been renewed.',
    ],
};

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

    /**
     * The lead a cornered target gives up, or null when the secret carries no
     * tag to squeeze along. Every Secret the game generates carries exactly one
     * tag (SecretGenerator), so null means malformed data, and the caller says
     * the target gave up nothing rather than inventing a lead.
     *
     * Deterministic for a given LeverageSystem seed: the draw comes off the same
     * SeededRandom stream as the resistance roll, so a replayed attempt yields
     * the same lead.
     */
    private generateIntelLead(secret: Secret, target: { name: string }): string | null {
        const tag = secret.tags[0];
        if (!tag) return null;

        const body = this.rng.pick(INTEL_LEADS_BY_TAG[tag]).split('{target}').join(target.name);

        // How far the informant will stick their neck out tracks how badly the
        // secret would hurt them, and whether it could be proven at all.
        const confidence =
            secret.verified && secret.value >= 7 ? 'Hard intelligence'
            : secret.value >= 4 ? 'A solid lead'
            : 'A whisper';

        return `${confidence}: ${body}`;
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
            case 'information': {
                // The lead is drawn from the target's own vulnerabilities, shaped by the
                // kind of secret that cornered them (agora-0437). identityReducer does not
                // read rewards.intel, so the lead is also folded into the message — that
                // message is the only surface the player ever sees.
                const lead = this.generateIntelLead(secret, target);
                if (lead) {
                    rewards.intel = lead;
                    result.message += ` They talked. ${lead}`;
                } else {
                    result.message += ` They talked, but gave up nothing you can act on.`;
                }
                break;
            }
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
