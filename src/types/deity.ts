export interface Deity {
    id: string;
    name: string;
    titles: string[];
    alignment: string;
    domains: string[];
    symbol: string;
    description: string;
    commandments: string[];
    favoredWeapon: string;

    // New mechanical hooks
    approves: DeityReaction[];
    forbids: DeityReaction[];
    relationships: DeityRelationship[];
}

export interface DeityReaction {
    trigger: string; // The specific action key, e.g., 'HEAL_ALLY', 'SLAY_UNDEAD'
    description: string; // "Heal an innocent"
    favorChange: number; // e.g., +2, -5
}

export interface DeityRelationship {
    targetDeityId: string;
    type: 'ally' | 'enemy' | 'neutral' | 'rival';
}

export interface DivineFavor {
    deityId: string;
    favor: number; // -100 to 100
    history: FavorEvent[];
    blessings: Blessing[];
    transgressions: Transgression[];
}

export interface FavorEvent {
    timestamp: number;
    reason: string;
    change: number;
}

export interface Blessing {
    id: string;
    name: string;
    description: string;
    effectType: 'buff' | 'utility' | 'divine_intervention';
    durationHours?: number; // Infinite if undefined
}

export interface Transgression {
    id: string;
    description: string;
    severity: 'minor' | 'major' | 'unforgivable';
    penanceRequired: string; // Description of how to atone
}

export interface DeityAction {
    description: string;
    favorChange: number;
}

export interface Temple {
    id: string;
    deityId: string;
    name: string;
    locationId: string; // References a Location
    services: TempleService[];
}

export interface TempleService {
    id: string;
    name: string;
    description: string;
    costGp: number;
    minFavor?: number; // Minimum favor required to access
    mechanicalEffect?: string; // e.g., 'restore_hp_full', 'remove_curse'
    effect?: string; // Backwards compatibility alias for mechanicalEffect
}
