/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/naval/voyageEvents/index.ts
 * Definitions for dynamic events that can occur during a sea voyage.
 */
// TODO(lint-intent): 'VoyageState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { VoyageEvent, VoyageState as _VoyageState, Ship as _Ship } from '../../../types/naval';
import { CrewManager } from '../../../systems/naval/CrewManager';
import { rollDice } from '../../../utils/combatUtils';

export const VOYAGE_EVENTS: VoyageEvent[] = [
    // ========================================================================
    // WEATHER EVENTS
    // ========================================================================
    {
        id: 'storm_heavy',
        name: 'Heavy Storm',
        description: 'A violent storm batters the ship.',
        type: 'Weather',
        probability: 0.1,
        conditions: (state) => state.currentWeather !== 'Storm',
        effect: (state, ship) => {
            const damage = rollDice('3d10');
            ship.stats.hullPoints = Math.max(0, ship.stats.hullPoints - damage);
            state.currentWeather = 'Storm';

            CrewManager.modifyCrewMorale(ship.crew, -5, 'Heavy storm');

            // Storm slows progress by increasing remaining distance (blown off course)
            const lostDistance = 10;
            state.distanceToDestination += lostDistance;

            return {
                log: `A heavy storm caught us! The ship took ${damage} damage and we were blown ${lostDistance} miles off course.`,
                type: 'Warning'
            };
        }
    },
    {
        id: 'tailwind',
        name: 'Strong Tailwind',
        description: 'The winds are in our favor.',
        type: 'Weather',
        probability: 0.15,
        effect: (state, ship) => {
            const bonusDist = 20; // Miles
            // Tailwind reduces remaining distance
            state.distanceToDestination = Math.max(0, state.distanceToDestination - bonusDist);
            state.currentWeather = 'Calm';

            CrewManager.modifyCrewMorale(ship.crew, 2, 'Good sailing');

            return {
                log: `Caught a strong tailwind. Gained an extra ${bonusDist} miles.`,
                type: 'Info'
            };
        }
    },
    {
        id: 'thick_fog',
        name: 'Thick Fog',
        description: 'Visibility reduced to near zero.',
        type: 'Weather',
        probability: 0.1,
        // TODO(lint-intent): 'ship' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        effect: (state, _ship) => {
            state.currentWeather = 'Fog';
            // Fog slows progress (adds to remaining distance effectively, or just we travel less)
            // But since VoyageManager calculates travel separately, let's say we got lost.
            const lostDist = 15;
            state.distanceToDestination += lostDist;

            return {
                log: `A thick fog rolled in. We drifted off course. Added ${lostDist} miles to the journey.`,
                type: 'Info'
            };
        }
    },
    {
        id: 'dead_calm',
        name: 'Dead Calm',
        description: 'The wind dies completely.',
        type: 'Weather',
        probability: 0.05,
        conditions: (state) => state.shipId !== 'Rowboat' && state.shipId !== 'Galley',
        effect: (state, ship) => {
            const lostDist = 30;
            state.distanceToDestination += lostDist;
            state.currentWeather = 'Calm';

            CrewManager.modifyCrewMorale(ship.crew, -2, 'Boredom');

            return {
                log: `The wind died. Drifting aimlessly. Voyage extended by ${lostDist} miles.`,
                type: 'Warning'
            };
        }
    },

    // ========================================================================
    // CREW EVENTS
    // ========================================================================
    {
        id: 'scurvy_outbreak',
        name: 'Signs of Scurvy',
        description: 'The crew is showing signs of vitamin deficiency.',
        type: 'Crew',
        probability: 0.05,
        conditions: (state) => state.daysAtSea > 10 && state.suppliesConsumed.food > 0,
        effect: (state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, -10, 'Sickness');
            return {
                log: `Scurvy is setting in. The crew is weak and gums are bleeding. Morale plummets.`,
                type: 'Warning'
            };
        }
    },
    {
        id: 'gambling_ring',
        name: 'Gambling Ring',
        description: 'Crew members are distracted by high-stakes dice games.',
        type: 'Crew',
        probability: 0.1,
        effect: (state, ship) => {
            if (Math.random() > 0.5) {
                CrewManager.modifyCrewMorale(ship.crew, 5, 'Fun distractions');
                return {
                    log: `The crew organized a dice tournament. Morale is high!`,
                    type: 'Fluff'
                };
            } else {
                CrewManager.modifyCrewMorale(ship.crew, -5, 'Fights over money');
                return {
                    log: `A gambling dispute turned into a fistfight. Morale suffers.`,
                    type: 'Warning'
                };
            }
        }
    },
    {
        id: 'religious_omen',
        name: 'Religious Omen',
        description: 'The crew spotted an albino dolphin.',
        type: 'Crew',
        probability: 0.05,
        effect: (state, ship) => {
            const superstitious = ship.crew.members.filter(m => m.traits.includes('Superstitious'));
            if (superstitious.length > 0) {
                CrewManager.modifyCrewMorale(ship.crew, 10, 'Divine favor');
                return {
                    log: `An albino dolphin! The superstitious crew members claim it's a blessing from the Sea Gods.`,
                    type: 'Fluff'
                };
            }
            return {
                log: `We saw a white dolphin today. Pretty.`,
                type: 'Fluff'
            };
        }
    },
    {
        id: 'bad_rations',
        name: 'Spoiled Rations',
        description: 'A barrel of salt pork has gone off.',
        type: 'Crew',
        probability: 0.08,
        effect: (state, ship) => {
            const lostFood = 20;
            ship.cargo.supplies.food = Math.max(0, ship.cargo.supplies.food - lostFood);
            CrewManager.modifyCrewMorale(ship.crew, -3, 'Bad food');

            return {
                log: `Found weevils in the biscuits and rot in the pork. Tossed ${lostFood} rations overboard.`,
                type: 'Warning'
            };
        }
    },

    // ========================================================================
    // ENCOUNTERS / FLUFF
    // ========================================================================
    {
        id: 'merfolk_trade',
        name: 'Merfolk Traders',
        description: 'Merfolk surface to trade pearls for steel.',
        type: 'Encounter',
        probability: 0.05,
        effect: (state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, 5, 'Profitable trade');
            return {
                log: `Traded old knives for pearls with a pod of Merfolk. A profitable day!`,
                type: 'Discovery'
            };
        }
    },
    {
        id: 'floating_debris',
        name: 'Floating Debris',
        description: 'Wreckage from another ship.',
        type: 'Discovery',
        probability: 0.1,
        effect: (state, ship) => {
            const foundSupplies = rollDice('2d6');
            ship.cargo.supplies.food += foundSupplies;
            return {
                log: `Salvaged some floating barrels. Gained ${foundSupplies} days of rations.`,
                type: 'Discovery'
            };
        }
    },
    {
        id: 'st_elmos_fire',
        name: "St. Elmo's Fire",
        description: 'Blue plasma glows on the mast.',
        type: 'Fluff',
        probability: 0.05,
        conditions: (state) => state.currentWeather === 'Storm',
        // TODO(lint-intent): 'state' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        effect: (_state, _ship) => {
            return {
                log: `St. Elmo's Fire dances on the mast tips. A hauntingly beautiful sight in the storm.`,
                type: 'Fluff'
            };
        }
    },
    {
        id: 'pirate_sighting',
        name: 'Pirate Sighting',
        description: 'Black sails on the horizon.',
        type: 'Encounter',
        probability: 0.05,
        effect: (state, ship) => {
            if (ship.stats.speed > 40) {
                 return {
                    log: `Spotted a pirate vessel, but we outran them.`,
                    type: 'Info'
                };
            } else {
                CrewManager.modifyCrewMorale(ship.crew, -5, 'Fear');
                state.status = 'Combat';
                return {
                    log: `Pirates closing in! Prepare for battle! (Combat system linkage)`,
                    type: 'Warning'
                };
            }
        }
    }
];
