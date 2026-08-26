// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 01:54:18
 * Dependents: systems/naval/VoyageManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/naval/voyageEvents.ts
 * Definitions for random events that can occur during sea voyages.
 */
import { VoyageEvent, VoyageState } from '../../types/naval';
import { CrewManager } from '../../systems/naval/CrewManager';
import { rollDamage, rollDice } from '../../systems/dice/rollers';

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
        effect: (state, ship, random) => {
            // Use the voyage manager's seeded stream when available so event
            // damage replays with the same selected event.
            const damage = rollDamage('4d10', false, 1, random);
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
        effect: (state, ship, random) => {
            // 50/50 chance of it being good bonding or bad fighting
            if (rollDice('1d20', { rng: random }) > 10) {
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
        effect: (state, ship, random) => {
            const saveDC = 15;
            // Abstract save for the whole crew
            // If average morale is high, they resist better
            const resistBonus = Math.floor(ship.crew.averageMorale / 10);
            const roll = rollDice('1d20', { rng: random }) + resistBonus;

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
        effect: (_state, _ship, random) => {
            // Simple loot
            const goldFound = rollDice('5d10', { rng: random });
            // We don't have a direct 'ship gold' prop easily accessible in Ship interface (it's usually on player),
            // but we can log it. Or assume it goes to captain's stash.
            return {
                log: `Salvaged debris found floating. Recovered supplies worth ${goldFound}gp.`,
                type: 'Discovery'
            };
        }
    },

    // ========================================================================
    // PORTED FROM THE RETIRED src/data/naval/voyageEvents/index.ts (agora-f821.11)
    // ------------------------------------------------------------------------
    // That directory index exported a second, unreachable VOYAGE_EVENTS table.
    // Most of its twelve entries were re-spellings of events already here
    // (storm_heavy/storm_gale, thick_fog/dense_fog, dead_calm/doldrums,
    // tailwind/fair_winds, scurvy_outbreak/scurvy_signs). These four had no
    // counterpart in this table, so they are carried over rather than pruned:
    // a spoilage event, a superstition beat that reads crew traits, a merfolk
    // trade, and the only pirate encounter in either table.
    // ========================================================================
    {
        id: 'bad_rations',
        name: 'Spoiled Rations',
        description: 'A barrel of salt pork has gone off.',
        type: 'Crew',
        probability: 0.08,
        effect: (_state, ship) => {
            const lostFood = 20;
            ship.cargo.supplies.food = Math.max(0, ship.cargo.supplies.food - lostFood);
            CrewManager.modifyCrewMorale(ship.crew, -3, 'Bad food');

            return {
                log: `Found weevils in the biscuits and rot in the pork. Tossed ${lostFood} rations overboard.`,
                type: 'Warning'
            };
        }
    },
    {
        id: 'religious_omen',
        name: 'Religious Omen',
        description: 'The crew spotted an albino dolphin.',
        type: 'Crew',
        probability: 0.05,
        effect: (_state, ship) => {
            // The beat only lands for a crew that believes in it, so the morale
            // swing is gated on the trait rather than handed to every crew.
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
        id: 'merfolk_trade',
        name: 'Merfolk Traders',
        description: 'Merfolk surface to trade pearls for steel.',
        type: 'Encounter',
        probability: 0.05,
        effect: (_state, ship) => {
            CrewManager.modifyCrewMorale(ship.crew, 5, 'Profitable trade');
            return {
                log: `Traded old knives for pearls with a pod of Merfolk. A profitable day!`,
                type: 'Discovery'
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
            // A fast hull simply outruns them. A slow one is caught, and the
            // voyage hands off to the naval combat status.
            if (ship.stats.speed > 40) {
                return {
                    log: `Spotted a pirate vessel, but we outran them.`,
                    type: 'Info'
                };
            }

            CrewManager.modifyCrewMorale(ship.crew, -5, 'Fear');
            state.status = 'Combat';
            return {
                log: `Pirates closing in! Prepare for battle!`,
                type: 'Warning'
            };
        }
    }
];
