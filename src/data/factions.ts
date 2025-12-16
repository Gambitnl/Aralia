/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/factions.ts
 * Initial data for factions in the world.
 */
import { Faction, FactionRank, PlayerFactionStanding } from '../types/factions';

const RANK_INITIATE: FactionRank = {
    id: 'initiate',
    name: 'Initiate',
    level: 1,
    description: 'A newly inducted member of the faction.',
    perks: ['access_guild_hall']
};

const RANK_MEMBER: FactionRank = {
    id: 'member',
    name: 'Member',
    level: 2,
    description: 'A trusted member of the faction.',
    perks: ['access_guild_store', 'take_contracts']
};

const RANK_VETERAN: FactionRank = {
    id: 'veteran',
    name: 'Veteran',
    level: 3,
    description: 'A seasoned member who commands respect.',
    perks: ['command_subordinates', 'access_vault']
};

export const FACTIONS: Record<string, Faction> = {
    'iron_ledger': {
        id: 'iron_ledger',
        name: 'The Iron Ledger',
        description: 'A powerful guild of merchants, bankers, and coin-minters who control trade routes and loan money to kingdoms. They value profit above all else.',
        type: 'GUILD',
        motto: 'Gold never rusts.',
        colors: { primary: '#FFD700', secondary: '#4B5563' }, // Gold and Slate
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['unseen_hand'],
        rivals: [],
        values: ['wealth', 'honesty_in_contracts', 'stability'],
        hates: ['theft', 'chaos', 'bad_debts']
    },
    'unseen_hand': {
        id: 'unseen_hand',
        name: 'The Unseen Hand',
        description: 'A criminal syndicate that operates in the shadows of every major city. They deal in secrets, stolen goods, and assassinations.',
        type: 'CRIMINAL_SYNDICATE',
        motto: 'Silence is golden.',
        colors: { primary: '#1F2937', secondary: '#9CA3AF' }, // Dark Gray and Light Gray
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['iron_ledger', 'house_vane'],
        rivals: [],
        values: ['secrecy', 'loyalty', 'cunning'],
        hates: ['snitches', 'law_enforcement', 'exposure']
    },
    'house_vane': {
        id: 'house_vane',
        name: 'House Vane',
        description: 'An ancient noble house known for their military prowess and strict adherence to tradition. They view themselves as the guardians of the realm.',
        type: 'NOBLE_HOUSE',
        motto: 'Steel and Honor.',
        colors: { primary: '#DC2626', secondary: '#FCD34D' }, // Red and Gold
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['unseen_hand'],
        rivals: [],
        values: ['honor', 'strength', 'tradition'],
        hates: ['cowardice', 'treachery', 'disrespect']
    }
};

export const INITIAL_FACTION_STANDINGS: Record<string, PlayerFactionStanding> = Object.keys(FACTIONS).reduce((acc, factionId) => {
    acc[factionId] = {
        factionId,
        publicStanding: 0,
        secretStanding: 0,
        rankId: 'outsider',
        favorsOwed: 0,
        renown: 0
    };
    return acc;
}, {} as Record<string, PlayerFactionStanding>);
