/**
 * @file src/systems/naval/NavalLogic.ts
 * Consolidated logic for the Naval system: Voyage management, Crew generation, and Ship creation.
 */
import { Ship, ShipStats, Crew, VoyageState, VoyageLogEntry, CrewMember, CrewRole } from '../../types/naval';
import { v4 as uuidv4 } from 'uuid';

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

export const createShip = (type: string, name: string): Ship => {
    // Basic defaults
    const stats: ShipStats = {
        speed: 48, // miles per day (~2 mph)
        maneuverability: 0,
        hullPoints: 100,
        maxHullPoints: 100,
        armorClass: 15,
        cargoCapacity: 50,
        crewMin: 5,
        crewMax: 20
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
        type: type as any,
        size: 'Medium',
        description: 'A fine vessel.',
        stats,
        crew,
        cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 100, water: 100 } },
        modifications: [],
        weapons: [],
        flags: {}
    };
};
