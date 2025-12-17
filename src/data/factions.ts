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
        allies: ['house_vane'],
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
        hates: ['snitches', 'law_enforcement', 'exposure'],
        services: ['fence', 'forgery', 'safehouse']
    },
    'house_vane': {
        id: 'house_vane',
        name: 'House Vane',
        description: 'An ancient noble house known for their military prowess and strict adherence to tradition. They view themselves as the guardians of the realm.',
        type: 'NOBLE_HOUSE',
        motto: 'Steel and Honor.',
        colors: { primary: '#DC2626', secondary: '#FCD34D' }, // Red and Gold
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: ['iron_ledger'],
        enemies: ['unseen_hand'],
        rivals: [],
        values: ['honor', 'strength', 'tradition'],
        hates: ['cowardice', 'treachery', 'disrespect']
    },
    // --- UNDERDARK FACTIONS ---
    'house_xorlarrin': {
        id: 'house_xorlarrin',
        name: 'House Xorlarrin',
        description: 'A powerful Drow noble house of wizardry and secrets, residing in the depths of Menzoberranzan. They seek to unlock the secrets of Faerzress.',
        type: 'NOBLE_HOUSE',
        motto: 'Magic is the only truth.',
        colors: { primary: '#6D28D9', secondary: '#000000' }, // Violet and Black
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['ironhead_clan'],
        rivals: ['house_vane'], // Surface rivals
        values: ['arcane_power', 'ambition', 'secrecy'],
        hates: ['weakness', 'light_dwellers', 'surface_elves']
    },
    'deepkings_guard': {
        id: 'deepkings_guard',
        name: "Deepking's Guard",
        description: 'The elite Duergar military force protecting Gracklstugh, the City of Blades. They are disciplined, ruthless, and heavily armored.',
        type: 'MILITARY',
        motto: 'Iron stands eternal.',
        colors: { primary: '#4B5563', secondary: '#9CA3AF' }, // Grey and Silver
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['house_xorlarrin', 'ironhead_clan'],
        rivals: [],
        values: ['discipline', 'labor', 'conquest'],
        hates: ['chaos', 'laziness', 'drow']
    },
    'ironhead_clan': {
        id: 'ironhead_clan',
        name: 'Ironhead Clan',
        description: 'A clan of Svirfneblin (Deep Gnomes) known for their peerless mining and gem-cutting skills. They are secretive and distrustful of outsiders.',
        type: 'GUILD', // Functionally a guild/clan hybrid
        motto: 'Stone keeps its secrets.',
        colors: { primary: '#78350F', secondary: '#D97706' }, // Brown and Amber
        ranks: [RANK_INITIATE, RANK_MEMBER, RANK_VETERAN],
        allies: [],
        enemies: ['deepkings_guard', 'house_xorlarrin'],
        rivals: ['iron_ledger'], // Rivals in gem trade
        values: ['community', 'stealth', 'craftsmanship'],
        hates: ['slavers', 'open_spaces', 'wastefulness']
    }
};

export const INITIAL_FACTION_STANDINGS: Record<string, PlayerFactionStanding> = Object.keys(FACTIONS).reduce((acc, factionId) => {
    acc[factionId] = {
        factionId,
        publicStanding: 0,
        secretStanding: 0,
        rankId: 'outsider', // Default to outsider
        favorsOwed: 0,
        renown: 0
    };
    return acc;
}, {} as Record<string, PlayerFactionStanding>);
