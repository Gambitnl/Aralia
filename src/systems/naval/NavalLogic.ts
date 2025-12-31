/**
 * @file src/systems/naval/NavalLogic.ts
 * Consolidated logic for the Naval system: Voyage management, Crew generation, and Ship creation.
 */
import { Ship, ShipStats, Crew, VoyageState, VoyageLogEntry, CrewMember, CrewRole, ShipType } from '../../types/naval';
import { v4 as uuidv4 } from 'uuid';
import { SHIP_TEMPLATES } from '../../data/ships';

// ============================================================================
// VOYAGE MANAGER
// ============================================================================

const DEFAULT_WEATHER_TYPES = ['Calm', 'Breezy', 'Stormy', 'Foggy'];

export class VoyageManager {
    static startVoyage(shipId: string, destinationId: string, distance: number): VoyageState {
        return {
            shipId,
            destinationId,
            status: 'Sailing',
            daysAtSea: 0,
            distanceTraveled: 0,
            distanceToDestination: distance,
            currentWeather: 'Calm',
            suppliesConsumed: { food: 0, water: 0 },
            log: [{
                day: 0,
                event: 'Voyage started.',
                type: 'Info'
            }]
        };
    }

    static advanceDay(currentVoyage: VoyageState, ship: Ship): VoyageState {
        const speed = ship.stats.speed; // e.g. 50 miles/day
        // Random weather
        const weather = DEFAULT_WEATHER_TYPES[Math.floor(Math.random() * DEFAULT_WEATHER_TYPES.length)];

        // Speed modifiers based on weather (simplified)
        let dailyDistance = speed;
        if (weather === 'Stormy') dailyDistance *= 0.5;
        if (weather === 'Calm') dailyDistance *= 0.8;
        if (weather === 'Breezy') dailyDistance *= 1.2;

        const newDistance = currentVoyage.distanceTraveled + Math.floor(dailyDistance);

        const newLogEntry: VoyageLogEntry = {
            day: currentVoyage.daysAtSea + 1,
            event: `Sailed ${Math.floor(dailyDistance)} miles in ${weather} weather.`,
            type: weather === 'Stormy' ? 'Warning' : 'Info'
        };

        return {
            ...currentVoyage,
            daysAtSea: currentVoyage.daysAtSea + 1,
            distanceTraveled: newDistance,
            currentWeather: weather,
            log: [...currentVoyage.log, newLogEntry]
        };
    }
}

// ============================================================================
// CREW MANAGER
// ============================================================================

export class CrewManager {
    static generateCrewMember(role: CrewRole = 'Sailor'): CrewMember {
        const names = ['Jack', 'Bill', 'Anne', 'Mary', 'Tom', 'Sal'];
        const name = names[Math.floor(Math.random() * names.length)];

        return {
            id: uuidv4(),
            name: `${name} the ${role}`,
            role,
            skills: {},
            morale: 50 + Math.floor(Math.random() * 50),
            loyalty: 50,
            dailyWage: role === 'Captain' ? 10 : 1,
            traits: []
        };
    }
}

// ============================================================================
// NAVAL UTILS (FACTORIES)
// ============================================================================

export const createShip = (type: ShipType, name: string): Ship => {
    // If template exists, use it. Otherwise fallback to basic default (safeguard).
    const template = SHIP_TEMPLATES[type] || SHIP_TEMPLATES['Sloop'];

    // Basic defaults
    const stats: ShipStats = {
        ...template.baseStats
    };

    const crew: Crew = {
        members: [],
        averageMorale: 100,
        unrest: 0,
        quality: 'Average'
    };

    return {
        id: uuidv4(),
        name,
        type: type,
        size: template.size,
        description: template.description,
        stats,
        crew,
        cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 100, water: 100 } },
        modifications: [],
        weapons: [],
        flags: {}
    };
};
