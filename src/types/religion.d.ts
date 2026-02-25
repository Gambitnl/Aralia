/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './core';
import { MechanicalEffect } from './effects';
/**
 * Alignment represents the moral and ethical stance of a creature or deity.
 */
export declare enum Alignment {
    LawfulGood = "Lawful Good",
    NeutralGood = "Neutral Good",
    ChaoticGood = "Chaotic Good",
    LawfulNeutral = "Lawful Neutral",
    TrueNeutral = "True Neutral",
    ChaoticNeutral = "Chaotic Neutral",
    LawfulEvil = "Lawful Evil",
    NeutralEvil = "Neutral Evil",
    ChaoticEvil = "Chaotic Evil",
    Unaligned = "Unaligned"
}
export type AlignmentEthicalAxis = 'Lawful' | 'Neutral' | 'Chaotic';
export type AlignmentMoralAxis = 'Good' | 'Neutral' | 'Evil';
export interface AlignmentTraits {
    ethical: AlignmentEthicalAxis;
    moral: AlignmentMoralAxis;
    description: string;
}
/**
 * Standard traits associated with each alignment.
 */
export declare const AlignmentDefinitions: Record<Alignment, AlignmentTraits>;
export type Domain = 'Life' | 'Light' | 'Nature' | 'Tempest' | 'Trickery' | 'War' | 'Death' | 'Knowledge' | 'Arcana' | 'Forge' | 'Grave' | 'Order' | 'Peace' | 'Twilight' | 'Freedom';
export interface DeityActionTrigger {
    trigger: string;
    description: string;
    favorChange: number;
}
export interface DeityRelationship {
    targetDeityId: string;
    type: 'ally' | 'enemy' | 'rival';
}
export interface Deity {
    id: string;
    name: string;
    titles: string[];
    domains: Domain[];
    alignment: Alignment;
    symbol: string;
    description: string;
    commandments: string[];
    favoredWeapon?: string;
    approves: DeityActionTrigger[];
    forbids: DeityActionTrigger[];
    relationships?: DeityRelationship[];
    title?: string;
    approvedActions?: string[];
    forbiddenActions?: string[];
}
export type FavorRank = 'Heretic' | 'Shunned' | 'Neutral' | 'Initiate' | 'Devotee' | 'Champion' | 'Chosen';
export interface DivineFavor {
    score: number;
    rank: FavorRank;
    consecutiveDaysPrayed: number;
    lastPrayerTimestamp?: number;
    history: {
        timestamp: number;
        reason: string;
        change: number;
    }[];
    blessings: Blessing[];
}
export interface Blessing {
    id: string;
    name: string;
    description: string;
    duration?: number;
    /**
     * The mechanical effect granted by this blessing.
     * Can be a single effect or a list of effects.
     */
    effect: MechanicalEffect | MechanicalEffect[];
}
export interface TempleServiceRequirement {
    minFavor?: number;
    questId?: string;
    goldCost?: number;
    itemCost?: {
        itemId: string;
        count: number;
    };
}
export interface TempleService {
    id: string;
    name: string;
    description: string;
    costGp?: number;
    minFavor?: number;
    requirement?: TempleServiceRequirement;
    effect: string | {
        type: 'heal' | 'buff' | 'cure' | 'identify' | 'quest' | 'favor' | 'restoration';
        value?: number;
        stat?: AbilityScoreName;
        duration?: number;
        description?: string;
    };
}
export interface Temple {
    id: string;
    deityId: string;
    name: string;
    description: string;
    locationId?: string;
    services: (TempleService | string)[];
}
export interface ReligionState {
    divineFavor: Record<string, DivineFavor>;
    discoveredDeities: string[];
    activeBlessings: {
        deityId: string;
        effectId: string;
        expirationTimestamp: number;
    }[];
}
export interface DeityAction {
    id: string;
    description: string;
    domain?: string;
    favorChange: number;
}
