/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/factions.ts
 * Defines types for the Faction and Reputation system, enabling nuanced political gameplay.
 */
export type FactionType = 'NOBLE_HOUSE' | 'GUILD' | 'RELIGIOUS_ORDER' | 'CRIMINAL_SYNDICATE' | 'GOVERNMENT' | 'MILITARY' | 'SECRET_SOCIETY';
export type FactionRankId = string;
export interface FactionRank {
    id: FactionRankId;
    name: string;
    level: number;
    description: string;
    perks: string[];
}
export interface FactionAsset {
    id: string;
    name: string;
    type: 'territory' | 'resource' | 'information' | 'personnel';
    value: number;
}
export interface Faction {
    id: string;
    name: string;
    description: string;
    type: FactionType;
    motto?: string;
    symbolIcon?: string;
    colors: {
        primary: string;
        secondary: string;
    };
    ranks: FactionRank[];
    allies: string[];
    enemies: string[];
    rivals: string[];
    relationships: Record<string, number>;
    values: string[];
    hates: string[];
    services?: string[];
    power: number;
    assets: FactionAsset[];
    treasury: number;
    taxRate: number;
    controlledRegionIds: string[];
    controlledRouteIds: string[];
    economicPolicy: FactionEconomicPolicy;
    tradeGoodPriorities: string[];
}
export type FactionEconomicPolicy = 'protectionist' | 'free_trade' | 'exploitative' | 'mercantile';
export interface ReputationEvent {
    id: string;
    timestamp: number;
    change: number;
    newStanding: number;
    reason: string;
    source?: string;
}
export interface PlayerFactionStanding {
    factionId: string;
    publicStanding: number;
    secretStanding: number;
    rankId: FactionRankId;
    favorsOwed: number;
    joinedDate?: number;
    renown: number;
    history: ReputationEvent[];
}
export interface FactionReputationChange {
    factionId: string;
    amount: number;
    type: 'public' | 'secret' | 'both';
    reason: string;
    source: string;
}
