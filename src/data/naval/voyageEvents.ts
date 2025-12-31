/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/naval/voyageEvents.ts
 * Definitions for random events that can occur during sea voyages.
 */
// TODO(lint-intent): 'Ship' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { VoyageEvent, VoyageState, Ship as _Ship } from '../../types/naval';
import { CrewManager } from '../../systems/naval/CrewManager';
import { rollDamage, rollDice } from '../../utils/combatUtils';

export const VOYAGE_EVENTS: VoyageEvent[] = [
    // ========================================================================
    // WEATHER EVENTS
    // ========================================================================
    {
        id: 'doldrums',
        name: 'The Doldrums',
        description: 'The wind dies completely. The sea becomes a mirror, and the heat is stifling.',
        type: 'Weather',
        probability: 0.1,
        conditions: (state: VoyageState) => state.currentWeather !== 'Storm',
        effect: (state, ship) => {
            // Delay progress
            state.distanceTraveled -= 20; // Lose relative progress/time
            // Morale hit due to heat and boredom
            CrewManager.modifyCrewMorale(ship.crew, -5, 'Stuck in doldrums');
            return {
                log: 'Caught in the doldrums. Zero progress today. The crew grows restless in the heat.',
                type: 'Warning'
            };
        }
    },
    {
        id: 'storm_gale',
        name: 'Gale Force Storm',
        description: 'Dark clouds gather and the waves swell to mountainous heights.',
        type: 'Weather',
        probability: 0.08,
        effect: (state, ship) => {
            const damage = rollDamage('4d10', false);
            ship.stats.hullPoints = Math.max(0, ship.stats.hullPoints - damage);

            // Check for seasickness/injury
            CrewManager.modifyCrewMorale(ship.crew, -2, 'Battered by storm');

            return {
                log: `A violent gale batters the ship! Took ${damage} hull damage.`,
                type: 'Warning'
            };
        }
    },
    {
        id: 'fair_winds',
        name: 'Fair Winds',
        description: 'A strong, steady tailwind fills the sails.',
        type: 'Weather',
        probability: 0.15,
        effect: (state, ship) => {
            const bonusDist = ship.stats.speed * 2; // Rough approximation of extra travel
            state.distanceTraveled += bonusDist;
            return {
                log: 'Fair winds fill the sails! Made excellent progress today.',
                type: 'Info'
            };
        }
    },
    {
        id: 'dense_fog',
        name: 'Dense Fog',
        description: 'Visibility drops to near zero. Sounds are muffled and strange shapes loom in the mist.',
        type: 'Weather',
        probability: 0.08,
        // TODO(lint-intent): 'ship' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        effect: (state, _ship) => {
            // Risk of running aground or hitting debris if near coast, but for now just slower speed
            state.distanceTraveled -= 10;
            return {
                log: 'Navigating through soup. Speed reduced to avoid collision.',
                type: 'Warning'
            };
        }
    },

    // ========================================================================
    // CREW EVENTS
    // ========================================================================
    {
        id: 'scurvy_signs',
        name: 'Signs of Scurvy',
        description: 'Several crew members are showing loose teeth and spotted skin.',
        type: 'Crew',
        probability: 0.05,
        conditions: (state) => state.daysAtSea > 10, // Only on long voyages
        effect: (state, ship) => {
            const hasSurgeon = ship.crew.members.some(m => m.role === 'Surgeon');
            if (hasSurgeon) {
                CrewManager.modifyCrewMorale(ship.crew, -2, 'Scurvy scare');
                return {
                    log: 'Scurvy detected. The Surgeon treats it with citrus reserves before it spreads.',
                    type: 'Info'
                };
            } else {
                CrewManager.modifyCrewMorale(ship.crew, -15, 'Scurvy outbreak');
                return {
                    log: 'Scurvy is spreading! Without a Surgeon, morale plummets.',
                    type: 'Warning'
                };
            }
        }
    },
    {
        id: 'gambling_ring',
        name: 'Below-deck Gambling',
        description: 'A high-stakes dice game has caused tension among the watches.',
        type: 'Crew',
        probability: 0.08,
        effect: (state, ship) => {
            // 50/50 chance of it being good bonding or bad fighting
            if (rollDice('1d20') > 10) {
                 CrewManager.modifyCrewMorale(ship.crew, 2, 'Fun gambling');
                 return {
                     log: 'The crew bonds over dice and grog.',
                     type: 'Fluff'
                 };
            } else {
                 CrewManager.modifyCrewMorale(ship.crew, -5, 'Gambling fight');
                 // Maybe someone loses money (flavor only for now)
                 return {
                     log: 'A fight breaks out over a crooked dice roll. Morale takes a hit.',
                     type: 'Warning'
                 };
            }
        }
    },
    {
        id: 'cooks_special',
        name: "Cook's Special",
        description: 'The cook has prepared a surprisingly decent meal from the rations.',
        type: 'Crew',
        probability: 0.05,
        effect: (state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, 10, 'Good food');
            return {
                log: "The Cook's surprise stew raises everyone's spirits!",
                type: 'Fluff'
            };
        }
    },

    // ========================================================================
    // ENCOUNTER EVENTS
    // ========================================================================
    {
        id: 'ghost_ship',
        name: 'Ghost Ship',
        description: 'A tattered galleon drifts silently past, glowing with a pale green light.',
        type: 'Encounter',
        probability: 0.02, // Rare
        effect: (state, ship) => {
            const isSuperstitious = ship.crew.members.some(m => m.traits.includes('Superstitious'));
            if (isSuperstitious) {
                CrewManager.modifyCrewMorale(ship.crew, -20, 'Saw ghost ship');
                return {
                    log: 'A Ghost Ship! The superstitious crew are terrified.',
                    type: 'Warning'
                };
            }
            CrewManager.modifyCrewMorale(ship.crew, -5, 'Saw ghost ship');
            return {
                log: 'Sighted a Ghost Ship drifting in the mist. An ill omen.',
                type: 'Fluff'
            };
        }
    },
    {
        id: 'siren_song',
        name: 'Siren Song',
        description: 'Hauntingly beautiful melody drifts across the waves.',
        type: 'Encounter',
        probability: 0.03,
        effect: (state, ship) => {
            const saveDC = 15;
            // Abstract save for the whole crew
            // If average morale is high, they resist better
            const resistBonus = Math.floor(ship.crew.averageMorale / 10);
            const roll = rollDice('1d20') + resistBonus;

            if (roll >= saveDC) {
                return {
                    log: 'Sirens sang, but the crew held fast to their posts.',
                    type: 'Info'
                };
            } else {
                // Some crew try to jump? Just damage/delay for now
                state.distanceTraveled -= 10; // Stopped to restrain crew
                CrewManager.modifyCrewMorale(ship.crew, -10, 'Siren lure');
                return {
                    log: 'Sirens! We had to restrain several sailors from jumping overboard. Lost time.',
                    type: 'Warning'
                };
            }
        }
    },
    {
        id: 'merchant_hail',
        name: 'Passing Merchant',
        description: 'A heavy merchant cog hails you, asking for news.',
        type: 'Encounter',
        probability: 0.1,
        effect: (state, ship) => {
            // Potential for trade logic later
            // For now, information exchange boosts morale
            CrewManager.modifyCrewMorale(ship.crew, 2, 'Shared news');
            return {
                log: 'Exchanged news with a passing merchant vessel.',
                type: 'Fluff'
            };
        }
    },

    // ========================================================================
    // FLAVOR/DISCOVERY EVENTS
    // ========================================================================
    {
        id: 'st_elmos_fire',
        name: "St. Elmo's Fire",
        description: 'Blue plasma glows on the mast tips during a storm.',
        type: 'Fluff',
        probability: 0.04,
        conditions: (state) => state.currentWeather === 'Storm',
        effect: (state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, 15, 'Divine omen');
            return {
                log: "St. Elmo's Fire dances on the rigging! The crew sees it as a blessing.",
                type: 'Fluff'
            };
        }
    },
    {
        id: 'dolphins',
        name: 'Dolphin Pod',
        description: 'A pod of dolphins races alongside the bow.',
        type: 'Fluff',
        probability: 0.1,
        effect: (state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, 5, 'Dolphins');
            return {
                log: 'Dolphins accompanied the ship today. A good sign.',
                type: 'Fluff'
            };
        }
    },
    {
        id: 'floating_debris',
        name: 'Floating Debris',
        description: 'Crates and barrels from a wreck bob in the water.',
        type: 'Discovery',
        probability: 0.05,
        // TODO(lint-intent): 'state' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        effect: (_state, _ship) => {
            // Simple loot
            const goldFound = rollDice('5d10');
            // We don't have a direct 'ship gold' prop easily accessible in Ship interface (it's usually on player),
            // but we can log it. Or assume it goes to captain's stash.
            return {
                log: `Salvaged debris found floating. Recovered supplies worth ${goldFound}gp.`,
                type: 'Discovery'
            };
        }
    }
];
