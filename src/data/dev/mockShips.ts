import { Ship } from '../../types/naval';

export const MOCK_SHIP_SLOOP: Ship = {
    id: 'dev_mock_sloop',
    name: 'The Dev Sloop',
    type: 'Sloop',
    size: 'Small',
    description: 'A reliable sloop tailored for development and testing.',
    stats: {
        hullPoints: 100,
        maxHullPoints: 100,
        speed: 40,
        maneuverability: 60,
        armorClass: 12,
        cargoCapacity: 50,
        crewMin: 2,
        crewMax: 10
    },
    cargo: {
        items: [],
        totalWeight: 0,
        capacityUsed: 0,
        supplies: { food: 50, water: 50 }
    },
    crew: {
        members: [],
        averageMorale: 100,
        unrest: 0,
        quality: 'Elite'
    },
    modifications: [],
    weapons: [],
    flags: {}
};
