/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/FactionGoalSystem.ts
 * Manages the progression of Faction Goals and generates events/rumors.
 */

import { GameState, GameMessage, WorldRumor, Faction } from '../../types';
import { FactionGoal, FactionGoalType } from '../../types/worldEvents';
import { SeededRandom } from '../../utils/seededRandom';
import { getGameDay } from '../../utils/timeUtils';

export interface FactionGoalResult {
    state: GameState;
    logs: GameMessage[];
}

/**
 * Calculates the progress chance based on faction power and goal difficulty.
 * Returns a number between 0 and 1.
 */
const calculateProgressChance = (power: number, difficulty: number): number => {
    // Base chance is 50% if power equals difficulty
    const baseChance = 0.5;
    const modifier = (power - difficulty) * 0.01; // +/- 1% per point of difference
    return Math.max(0.1, Math.min(0.9, baseChance + modifier));
};

/**
 * Generates a flavor text for a goal update.
 */
const generateGoalFlavorText = (faction: Faction, goal: FactionGoal, outcome: 'progress' | 'completion' | 'setback', rng: SeededRandom): string => {
    const templates: Record<string, Record<FactionGoalType, string[]>> = {
        progress: {
            EXPANSION: [
                `${faction.name} has established a new outpost.`,
                `${faction.name} scouts have mapped new tunnels.`,
                `Patrols from ${faction.name} are seen further from their territory.`
            ],
            WEALTH: [
                `${faction.name} has secured a lucrative contract.`,
                `Caravans bearing the seal of ${faction.name} arrive with heavy chests.`,
                `${faction.name} investments are paying off.`
            ],
            INFLUENCE: [
                `${faction.name} agents have been seen whispering in high courts.`,
                `A noble has publicly pledged support to ${faction.name}.`,
                `${faction.name} hosts a lavish banquet for city officials.`
            ],
            DESTRUCTION: [
                `${faction.name} saboteurs have struck a rival supply line.`,
                `Propaganda against enemies of ${faction.name} spreads through the streets.`,
                `${faction.name} performs a ritual cursing their foes.`
            ],
            KNOWLEDGE: [
                `${faction.name} scholars have unearthed an ancient scroll.`,
                `Strange lights are seen above the ${faction.name} tower.`,
                `${faction.name} sends an expedition to the ruins.`
            ],
            DEFENSE: [
                `${faction.name} is reinforcing their walls.`,
                `New recruits swell the ranks of ${faction.name}.`,
                `${faction.name} has installed new magical wards.`
            ]
        },
        completion: {
            EXPANSION: [
                `News spreads: ${faction.name} has claimed new territory!`,
                `${faction.name} has successfully annexed the disputed lands.`
            ],
            WEALTH: [
                `${faction.name} announces record profits, flooding the market with gold.`,
                `${faction.name} has cornered the market!`
            ],
            INFLUENCE: [
                `${faction.name} has successfully installed a puppet official.`,
                `The King grants a royal charter to ${faction.name}.`
            ],
            DESTRUCTION: [
                `${faction.name} has struck a crippling blow to their enemies!`,
                `An enemy stronghold burns, courtesy of ${faction.name}.`
            ],
            KNOWLEDGE: [
                `${faction.name} has unlocked a lost secret of the ancients!`,
                `${faction.name} masters a forbidden spell.`
            ],
            DEFENSE: [
                `${faction.name} is now considered impenetrable.`,
                `${faction.name} unveils a new fortress.`
            ]
        },
        setback: {
            EXPANSION: [
                `${faction.name} forces were ambushed and retreated.`,
                `Supply lines to ${faction.name}'s new outpost were cut.`
            ],
            WEALTH: [
                `${faction.name} suffers a major heist.`,
                `A bad investment costs ${faction.name} dearly.`
            ],
            INFLUENCE: [
                `${faction.name} is embroiled in a scandal.`,
                `A key ally turns their back on ${faction.name}.`
            ],
            DESTRUCTION: [
                `${faction.name}'s assassination attempt was foiled.`,
                `A ritual by ${faction.name} backfires spectacularly.`
            ],
            KNOWLEDGE: [
                `${faction.name} expedition is lost in the deep.`,
                `An experiment at ${faction.name} explodes.`
            ],
            DEFENSE: [
                `A breach is found in ${faction.name}'s walls.`,
                `Disease strikes the ${faction.name} barracks.`
            ]
        }
    };

    const typeTemplates = templates[outcome][goal.type];
    if (!typeTemplates) return `${faction.name} works on their goal: ${goal.description}`;

    return typeTemplates[Math.floor(rng.next() * typeTemplates.length)];
};

/**
 * Selects a new goal for a faction after one is completed.
 * For now, it just recycles basic goals with slight variations.
 */
const generateNewGoal = (faction: Faction, rng: SeededRandom): FactionGoal => {
    const types: FactionGoalType[] = ['EXPANSION', 'WEALTH', 'INFLUENCE', 'DESTRUCTION', 'KNOWLEDGE', 'DEFENSE'];
    const type = types[Math.floor(rng.next() * types.length)];
    const id = `goal_${faction.id}_${Date.now()}_${Math.floor(rng.next() * 100)}`;

    // Generic descriptions for now
    const descriptions: Record<FactionGoalType, string[]> = {
        EXPANSION: ['Expand influence into the outer districts.', 'Establish a new safehouse.'],
        WEALTH: ['Amass funds for a new project.', 'Secure a monopoly on iron.'],
        INFLUENCE: ['Bribe city officials.', 'Gain favor with the nobility.'],
        DESTRUCTION: ['Sabotage a rival guild.', 'Eliminate a troublesome official.'],
        KNOWLEDGE: ['Recover a lost artifact.', 'Research a new spell.'],
        DEFENSE: ['Recruit more guards.', 'Reinforce the stronghold.']
    };

    const descList = descriptions[type];
    const description = descList[Math.floor(rng.next() * descList.length)];

    return {
        id,
        type,
        description,
        progress: 0,
        difficulty: 40 + Math.floor(rng.next() * 40), // 40-80 difficulty
        status: 'ACTIVE'
    };
};

/**
 * Main function to process faction goals.
 */
export const processFactionGoals = (state: GameState, daysPassed: number): FactionGoalResult => {
    if (daysPassed <= 0) return { state, logs: [] };

    const rng = new SeededRandom(state.worldSeed + getGameDay(state.gameTime));
    let currentState = { ...state };
    let logs: GameMessage[] = [];
    const timestamp = state.gameTime || new Date();
    const gameDay = getGameDay(timestamp);

    // Chance for a faction to make a move on their goal
    const GOAL_MOVE_CHANCE = 0.3; // 30% chance per day per faction

    let factionsChanged = false;
    let newFactions = { ...currentState.factions };
    let newRumors = [...(currentState.activeRumors || [])];

    // Iterate for each day passed to ensure correct simulation speed
    for (let day = 0; day < daysPassed; day++) {
        // We use a fresh random seed for each day iteration if needed,
        // but 'rng' is already seeded. We just keep pulling from it.

        // We must re-fetch factions from 'newFactions' because they might have changed in the previous day loop
        const currentLoopFactions = Object.values(newFactions);

        for (const faction of currentLoopFactions) {
            if (!faction.goals || faction.goals.length === 0) continue;

            // Ensure activeGoalId is set (only need to do this once per faction really, but safe here)
            let activeGoalId = faction.activeGoalId;
            if (!activeGoalId) {
                activeGoalId = faction.goals[0].id;
                // Update local obj immediately so next day sees it
                newFactions[faction.id] = { ...faction, activeGoalId };
                activeGoalId = faction.activeGoalId;
                factionsChanged = true;
            }

            // Get the goal from the potentially updated faction object
            const activeGoal = newFactions[faction.id].goals.find(g => g.id === activeGoalId);
            if (!activeGoal || activeGoal.status !== 'ACTIVE') continue;

            // Check if they make a move today
            if (rng.next() < GOAL_MOVE_CHANCE) {
                const chance = calculateProgressChance(faction.power, activeGoal.difficulty);
                const roll = rng.next();

                let outcome: 'progress' | 'completion' | 'setback' | null = null;
                let progressChange = 0;

                if (roll < chance) {
                    // Success!
                    // Critical success?
                    if (roll < chance * 0.2) {
                        progressChange = 25; // Big jump
                    } else {
                        progressChange = 10;
                    }

                    if (activeGoal.progress + progressChange >= 100) {
                        outcome = 'completion';
                    } else {
                        outcome = 'progress';
                    }
                } else {
                    // Failure
                    if (roll > 0.9) { // Critical failure
                        outcome = 'setback';
                        progressChange = -10;
                    }
                    // Regular failure = no progress
                }

                if (outcome) {
                    factionsChanged = true;
                    const newProgress = Math.min(100, Math.max(0, activeGoal.progress + progressChange));

                    // Create updated goal
                    const updatedGoal: FactionGoal = {
                        ...activeGoal,
                        progress: newProgress,
                        status: outcome === 'completion' ? 'COMPLETED' : 'ACTIVE'
                    };

                    // Update Faction with new goal state
                    // Note: We use 'newFactions[faction.id]' source of truth
                    const currentFactionState = newFactions[faction.id];
                    const updatedGoals = currentFactionState.goals.map(g => g.id === activeGoal.id ? updatedGoal : g);

                    // If completed, maybe give power boost and pick new goal?
                    let powerBoost = 0;
                    if (outcome === 'completion') {
                        powerBoost = 5;
                        // Add new goal
                        const nextGoal = generateNewGoal(currentFactionState, rng);
                        updatedGoals.push(nextGoal);
                    }

                    // Flavor Text
                    const text = generateGoalFlavorText(currentFactionState, activeGoal, outcome, rng);

                    // Add Log
                    logs.push({
                        id: Date.now() + rng.next(),
                        text: `Rumor: ${text}`,
                        sender: 'system',
                        timestamp: new Date(timestamp.getTime() + (day * 24 * 60 * 60 * 1000)) // Approx day offset
                    });

                    // Add World Rumor
                    const rumor: WorldRumor = {
                        id: `goal_${faction.id}_${gameDay + day}_${rng.next().toString(36).substr(2, 5)}`,
                        text,
                        sourceFactionId: faction.id,
                        type: outcome === 'completion' ? 'event' : 'misc',
                        timestamp: gameDay + day,
                        expiration: gameDay + day + (outcome === 'completion' ? 14 : 7),
                        virality: outcome === 'completion' ? 1.0 : 0.4
                    };
                    newRumors.push(rumor);

                    // Commit changes to newFactions
                    newFactions[faction.id] = {
                        ...currentFactionState,
                        goals: updatedGoals,
                        power: Math.min(100, Math.max(0, currentFactionState.power + powerBoost)),
                        activeGoalId: outcome === 'completion' ? updatedGoals[updatedGoals.length - 1].id : currentFactionState.activeGoalId
                    };
                }
            }
        }
    }

    if (factionsChanged) {
        currentState = {
            ...currentState,
            factions: newFactions,
            activeRumors: newRumors
        };
    }

    return { state: currentState, logs };
};
