/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/LoanSystem.ts
 * Static utility class for the loan/lending system.
 * Factions offer loans based on player standing, faction type, and economic policy.
 */
import { Faction, PlayerFactionStanding } from '../../types/factions';
import { LoanOffer } from '../../types/economy';
/**
 * Gets available loan offers from factions the player can borrow from.
 * Loan terms depend on faction type, economic policy, and player standing.
 */
export declare const getAvailableLenders: (factions: Record<string, Faction>, standings: Record<string, PlayerFactionStanding>, playerGold: number) => LoanOffer[];
/**
 * Calculates interest rate based on player standing and faction type.
 * Better standing = lower rates. Criminal syndicates charge more.
 */
export declare const calculateInterestRate: (standing: PlayerFactionStanding, faction: Faction) => number;
/**
 * Calculates reputation consequences for defaulting on a loan.
 * Returns the standing penalty amount.
 */
export declare const calculateDefaultPenalty: (_investment: {
    principalGold: number;
    currentValue: number;
}, faction: Faction) => number;
