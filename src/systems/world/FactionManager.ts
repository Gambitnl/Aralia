/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/FactionManager.ts
 * Centralizes faction reputation logic, ripple effects, and rumor generation.
 * Replaces scattered utility functions in factionUtils.ts for better encapsulation.
 */
// TODO(lint-intent): 'Faction' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, GameMessage, WorldRumor, Faction as _Faction, PlayerFactionStanding } from '../../types';
import { calculateRippleEffects, calculateNewStanding, formatReputationChangeMessage } from '../../utils/factionUtils';
import { getGameDay } from '../../utils/timeUtils';

export interface ApplyReputationResult {
    standings: Record<string, PlayerFactionStanding>;
    logs: GameMessage[];
    rumors: WorldRumor[];
}

export class FactionManager {
    /**
     * Applies a reputation change and calculates ripple effects and rumors.
     * Does NOT mutate the input state.
     */
    static applyReputationChange(
        state: GameState,
        factionId: string,
        amount: number,
        reason: string
    ): ApplyReputationResult {
        // Clone standings to avoid mutation
        const newStandings = { ...state.playerFactionStandings };
        const logs: GameMessage[] = [];
        const rumors: WorldRumor[] = [];
        const timestamp = state.gameTime || new Date();

        // Helper to apply change
        const applyToFaction = (fId: string, amt: number, rsn: string, isRipple: boolean) => {
            if (!newStandings[fId]) {
                 // Initialize if missing (should exist from game start, but safe fallback)
                 newStandings[fId] = {
                     factionId: fId,
                     publicStanding: 0,
                     secretStanding: 0,
                     rankId: 'outsider',
                     favorsOwed: 0,
                     renown: 0
                 };
            }

            const current = newStandings[fId];
            const oldStanding = current.publicStanding;
            const newStanding = calculateNewStanding(oldStanding, amt);

            // Update state
            newStandings[fId] = {
                ...current,
                publicStanding: newStanding,
                secretStanding: calculateNewStanding(current.secretStanding, amt) // Assume secret moves with public for now
            };

            // Log if visible change
            if (amt !== 0) {
                const factionName = state.factions[fId]?.name || fId;
                logs.push({
                    id: Date.now() + Math.random(), // Simple ID generation
                    text: formatReputationChangeMessage(factionName, amt, 'public', rsn),
                    sender: 'system',
                    timestamp: timestamp
                });

                // Generate Rumor if significant change
                if (Math.abs(amt) >= 10 && !isRipple) {
                    rumors.push(FactionManager.createRumor(
                        state,
                        fId,
                        amt,
                        rsn,
                        factionName
                    ));
                }
            }
        };

        // 1. Apply primary change
        applyToFaction(factionId, amount, reason, false);

        // 2. Calculate and apply ripples
        const ripples = calculateRippleEffects(state.factions, factionId, amount);
        ripples.forEach(ripple => {
            applyToFaction(ripple.factionId, ripple.amount, ripple.reason, true);
        });

        return { standings: newStandings, logs, rumors };
    }

    /**
     * Creates a WorldRumor based on a reputation change.
     */
    private static createRumor(
        state: GameState,
        factionId: string,
        amount: number,
        reason: string,
        factionName: string
    ): WorldRumor {
        const day = getGameDay(state.gameTime || new Date());

        let type: WorldRumor['type'] = 'misc';
        let text = '';
        const absAmount = Math.abs(amount);

        if (amount > 0) {
            type = 'event'; // Positive event
            text = `Word spreads that someone has gained favor with ${factionName} for ${reason}.`;
        } else {
            type = 'event'; // Negative event
            text = `Rumors circulate that ${factionName} was slighted due to ${reason}.`;
        }

        // Generate ID
        const id = `rep_${factionId}_${Date.now().toString(36)}`;

        return {
            id,
            text,
            type,
            sourceFactionId: factionId,
            timestamp: day,
            expiration: day + 7, // Lasts a week
            spreadDistance: 0,
            virality: absAmount >= 20 ? 0.8 : 0.4 // Big changes spread faster
        };
    }
}
