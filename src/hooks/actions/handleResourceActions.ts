/**
 * @file src/hooks/actions/handleResourceActions.ts
 * Handles resource management actions like spellcasting and ability usage.
 */
import React from 'react';
import { GameState, HitPointDiceSpendMap, HitPointDicePool } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { handleGossipEvent, handleResidueChecks, handleLongRestWorldEvents } from './handleWorldEvents'; // Import the new world event handlers.
import { checkPlanarRestRules } from '../../systems/planar/rest';
import { buildHitPointDicePools, getAbilityModifierValue } from '../../utils/characterUtils';
import { rollDice } from '../../utils/combatUtils';
import { formatDuration, getGameDay } from '../../utils/core';

interface HandleRestProps {
    gameState: GameState; // Pass full gameState for context
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
}

interface HandleShortRestProps extends Omit<HandleRestProps, 'addGeminiLog'> {
    hitPointDiceSpend?: HitPointDiceSpendMap;
}

const SHORT_REST_DURATION_SECONDS = 1 * 3600;
const SHORT_REST_COOLDOWN_SECONDS = 2 * 3600;
const SHORT_REST_MAX_PER_DAY = 3;

export function handleCastSpell(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; spellLevel: number }): void {
    dispatch({ type: 'CAST_SPELL', payload });
}

export function handleUseLimitedAbility(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; abilityId: string }): void {
    dispatch({ type: 'USE_LIMITED_ABILITY', payload });
}

export function handleTogglePreparedSpell(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; spellId: string }): void {
    dispatch({ type: 'TOGGLE_PREPARED_SPELL', payload });
}

export async function handleLongRest({ gameState, dispatch, addMessage, addGeminiLog }: HandleRestProps): Promise<void> {
    addMessage("The party begins to settle in for a long rest...", "system");

    // --- NEW: OVERNIGHT WORLD SIMULATION ---
    // This new sequence makes the world feel alive by processing events that happen "overnight".
    // DEPENDS ON: `handleLongRestWorldEvents`, `handleResidueChecks`, `handleGossipEvent` from `handleWorldEvents.ts`.
    // DISPATCHES: `BATCH_UPDATE_NPC_MEMORY` and then `PROCESS_GOSSIP_UPDATES` to `npcReducer.ts`.

    // Step 1: Check for any discovered evidence from player's past actions.
    addMessage("You notice the faint sounds of the world continuing around you as you rest.", "system");
    await handleResidueChecks(gameState, dispatch);

    // Step 2: Calculate all long-term memory changes (decay, pruning, drift) for all NPCs.
    // This is a pure function that returns a new state object.
    const newNpcMemoryState = handleLongRestWorldEvents(gameState);
    
    // Step 3: Dispatch a single, batched action to apply all memory maintenance changes at once.
    // This is highly performant as it causes only one state update for all these changes.
    dispatch({ type: 'BATCH_UPDATE_NPC_MEMORY', payload: newNpcMemoryState });

    // Step 4: Run the gossip simulation. It's crucial to run this *after* the memory decay,
    // using the newly updated state, so that NPCs are gossiping with their most current memories.
    const updatedGameStateForGossip = { ...gameState, npcMemory: newNpcMemoryState };
    await handleGossipEvent(updatedGameStateForGossip, addGeminiLog, dispatch);
    // --- END NEW ---

    // Step 5: Check Planar Rest Rules
    const restOutcome = checkPlanarRestRules(gameState);
    
    if (restOutcome.messages.length > 0) {
        restOutcome.messages.forEach(msg => addMessage(msg, "system"));
    }

    // Step 6: Apply the mechanical benefits of the long rest to the player party.
    dispatch({
        type: 'LONG_REST',
        payload: { deniedCharacterIds: restOutcome.deniedCharacterIds }
    });

    // Step 7: Advance the in-game clock.
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 8 * 3600 } }); // 8 hours

    if (restOutcome.deniedCharacterIds.length === gameState.party.length) {
         addMessage("The party awakes, but finds no comfort in their rest.", "system");
    } else {
         addMessage("You awake feeling refreshed and ready for a new day.", "system");
    }
}

export function handleShortRest({ gameState, dispatch, addMessage, hitPointDiceSpend }: HandleShortRestProps): void {
    const restStartMs = gameState.gameTime.getTime();
    const restStartDay = getGameDay(gameState.gameTime);
    const restTracker = gameState.shortRestTracker ?? {
        restsTakenToday: 0,
        lastRestDay: restStartDay,
        lastRestEndedAtMs: null,
    };
    const restsTakenToday = restTracker.lastRestDay === restStartDay ? restTracker.restsTakenToday : 0;

    // Enforce party-level pacing: max rests per day and a cooldown between rests.
    if (restsTakenToday >= SHORT_REST_MAX_PER_DAY) {
        addMessage(`The party has already taken ${SHORT_REST_MAX_PER_DAY} short rests today.`, "system");
        return;
    }
    if (restTracker.lastRestEndedAtMs !== null) {
        const secondsSinceLastRest = Math.floor((restStartMs - restTracker.lastRestEndedAtMs) / 1000);
        if (secondsSinceLastRest < SHORT_REST_COOLDOWN_SECONDS) {
            const remainingSeconds = SHORT_REST_COOLDOWN_SECONDS - secondsSinceLastRest;
            addMessage(`The party needs ${formatDuration(remainingSeconds)} before taking another short rest.`, "system");
            return;
        }
    }

    addMessage("The party takes a short rest, tending to their wounds.", "system");

    // Aggregate updates per party member so the reducer can apply changes in one pass.
    const healingByCharacterId: Record<string, number> = {};
    const hitPointDiceUpdates: Record<string, HitPointDicePool[]> = {};

    gameState.party.forEach(character => {
        const characterId = character.id;
        if (!characterId) return;

        // Ensure we always spend from normalized pools (class hit dice + prior spend).
        const pools = buildHitPointDicePools(character);
        const spendPlan = hitPointDiceSpend?.[characterId] ?? {};
        const conMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);

        let totalHealing = 0;
        const spentByDie: Record<number, number> = {};
        const rollsByDie: Record<number, number[]> = {};
        const updatedPools = pools.map(pool => {
            const requestedRaw = spendPlan[pool.die] ?? 0;
            const requested = Math.max(0, Math.floor(Number(requestedRaw) || 0));
            const spendCount = Math.min(pool.current, requested);
            if (spendCount > 0) {
                spentByDie[pool.die] = spendCount;
                let poolHealing = 0;
                // Track per-die rolls so the rest log can show a transparent breakdown.
                const rolls: number[] = [];
                for (let i = 0; i < spendCount; i += 1) {
                    const roll = rollDice(`1d${pool.die}`);
                    rolls.push(roll);
                    const heal = Math.max(1, roll + conMod);
                    poolHealing += heal;
                }
                rollsByDie[pool.die] = rolls;
                totalHealing += poolHealing;
                return { ...pool, current: pool.current - spendCount };
            }
            return pool;
        });

        hitPointDiceUpdates[characterId] = updatedPools;

        if (totalHealing > 0) {
            const missingHp = Math.max(0, character.maxHp - character.hp);
            const appliedHealing = Math.min(missingHp, totalHealing);
            healingByCharacterId[characterId] = appliedHealing;

            const spendSummary = Object.entries(spentByDie)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([die, count]) => `${count}d${die}`)
                .join(' + ');
            const rollSummary = Object.entries(rollsByDie)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([die, rolls]) => `d${die}[${rolls.join(', ')}]`)
                .join(' + ');
            const conLabel = conMod !== 0 ? ` ${conMod >= 0 ? '+' : ''}${conMod} Con` : '';
            const capSuffix = totalHealing > appliedHealing ? ` (${totalHealing} rolled, capped by max HP)` : '';
            addMessage(`${character.name} spends ${spendSummary} (rolls ${rollSummary}${conLabel}) and regains ${appliedHealing} HP${capSuffix}.`, "system");
        }
    });

    // Update party-level rest tracking before the time advance moves us forward.
    const restEndMs = restStartMs + SHORT_REST_DURATION_SECONDS * 1000;
    const shortRestTracker = {
        restsTakenToday: restsTakenToday + 1,
        lastRestDay: restStartDay,
        lastRestEndedAtMs: restEndMs,
    };

    dispatch({ type: 'SHORT_REST', payload: { healingByCharacterId, hitPointDiceUpdates, shortRestTracker } });
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: SHORT_REST_DURATION_SECONDS } });
}
