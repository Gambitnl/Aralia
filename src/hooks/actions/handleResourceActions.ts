// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 01:17:38
 * Dependents: components/ConversationPanel/ConversationPanel.tsx, hooks/actions/actionHandlers.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleResourceActions.ts
 * Handles resource management actions like spellcasting and ability usage.
 */
import React from 'react';
import { GameState, HitPointDiceSpendMap, HitPointDicePool, RacialRestChoiceData, Spell, SpellSlots } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { handleGossipEvent, handleResidueChecks, handleLongRestWorldEvents } from './handleWorldEvents'; // Import the new world event handlers.
import { checkPlanarRestRules } from '../../systems/planar/rest';
import { buildHitPointDicePools, getAbilityModifierValue, getRacialSpellGrantForSpell } from '../../utils/characterUtils';
import { rollDice } from '../../utils/combatUtils';
import { formatDuration, getGameDay } from '../../utils/core';
import { CastSpellPayload } from '../../types/actions';
import { spellService } from '../../services/SpellService';
import {
    applyPostCastToCharacter,
    buildOutOfCombatStatusEffect,
    rollOutOfCombatHealing,
} from '../../utils/spells/outOfCombatCasting';

interface HandleRestProps {
    gameState: GameState; // Pass full gameState for context
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    /** Choices collected by the modal must survive the gameplay pipeline. */
    racialRestChoices?: Record<string, Record<string, RacialRestChoiceData>>;
}

interface HandleShortRestProps extends Omit<HandleRestProps, 'addGeminiLog'> {
    hitPointDiceSpend?: HitPointDiceSpendMap;
}

const SHORT_REST_DURATION_SECONDS = 1 * 3600;
const SHORT_REST_COOLDOWN_SECONDS = 2 * 3600;
const SHORT_REST_MAX_PER_DAY = 3;

// ============================================================================
// Spellcasting Actions
// ============================================================================
// Asynchronously handles spellcasting processes, verifying material components,
// resolving consumption of components, and dispatching to state.
// ============================================================================

export async function handleCastSpell(
    dispatch: React.Dispatch<AppAction>,
    payload: CastSpellPayload,
    gameState: GameState,
    addMessage: AddMessageFn
): Promise<void> {
    // If there is no spell ID, dispatch immediately (e.g. legacy/direct spell casts).
    if (!payload.spellId) {
        dispatch({ type: 'CAST_SPELL', payload });
        return;
    }

    try {
        // Fetch spell specifications from the central database.
        const spell = await spellService.getSpellDetails(payload.spellId);
        if (!spell) {
            addMessage(`Unable to cast spell: details not found for ${payload.spellId}.`, "system");
            return;
        }

        // Validate that the party has the required material components.
        // Under D&D rules, spells with costing materials (e.g. 300 gp diamond for Revivify)
        // require the caster to have that component in their inventory.
        if (spell.components?.material && spell.components.materialCost && spell.components.materialCost > 0) {
            const materialCost = spell.components.materialCost;
            
            // Search the party's shared inventory for a matching spell component.
            // It must have the correct type and its worth in gold pieces must meet or exceed the cost.
            const componentItem = gameState.inventory.find(item => 
                item.type === 'spell_component' && 
                item.costInGp !== undefined && 
                item.costInGp >= materialCost
            );

            // If the party doesn't have the necessary component, prevent the cast and log a warning.
            if (!componentItem) {
                const desc = spell.components.materialDescription || `${materialCost} gp worth of components`;
                addMessage(`Cannot cast ${spell.name}: missing required material components (${desc}).`, "system");
                return;
            }

            // If the spell description specifies that the material component is consumed on casting,
            // we attach the item's unique identifier so the reducer can remove it from the inventory.
            if (spell.components.isConsumed) {
                payload = {
                    ...payload,
                    materialComponentItemIdToConsume: componentItem.id
                };
                addMessage(`Consumed material component: ${componentItem.name} (valued at ${componentItem.costInGp} gp) to cast ${spell.name}.`, "system");
            }
        }

        // Out-of-combat spellbook cast: pre-check the slot, deduct it through the
        // normal CAST_SPELL reducer, then apply the spell's downtime effects.
        // Runs inside its own catch so a failure here can never fall through to
        // the outer fallback and dispatch CAST_SPELL a second time.
        if (payload.outOfCombat) {
            try {
                handleOutOfCombatSpellbookCast(dispatch, payload, spell, gameState, addMessage);
            } catch {
                addMessage(`Casting ${spell.name} failed unexpectedly.`, "system");
            }
            return;
        }

        dispatch({ type: 'CAST_SPELL', payload });
    } catch (error) {
        // Fallback to standard casting if the spell database lookup fails, to prevent soft-locks.
        dispatch({ type: 'CAST_SPELL', payload });
    }
}

/**
 * Resolves a spellbook cast made OUTSIDE combat (the combat engine has its own
 * SpellCommand pipeline). The CAST_SPELL reducer only deducts the slot, so the
 * downtime effects are applied here:
 * - immediate healing -> MODIFY_PARTY_HEALTH on the chosen party member
 * - lasting buffs/utility -> APPLY_CHARACTER_STATUS_EFFECT (same-source replace)
 * - if the caster's sheet is open, its snapshot character is refreshed so the
 *   slot pips update immediately (the CAST_SPELL reducer does not sync it).
 */
export function handleOutOfCombatSpellbookCast(
    dispatch: React.Dispatch<AppAction>,
    payload: CastSpellPayload,
    spell: Spell,
    gameState: GameState,
    addMessage: AddMessageFn
): void {
    const caster = gameState.party.find(member => member.id === payload.characterId);
    if (!caster) {
        addMessage(`Unable to cast ${spell.name}: caster not found in the party.`, "system");
        return;
    }
    const target = gameState.party.find(member => member.id === payload.outOfCombat!.targetCharacterId) ?? caster;

    // Racial spell grants may consume a limited use instead of a slot; the
    // reducer owns that branch, so skip the plain-slot pre-check (and the
    // sheet resync, which only mirrors the plain-slot deduction).
    const racialGrant = getRacialSpellGrantForSpell(caster, spell.id);

    if (spell.level > 0 && !racialGrant) {
        const slotKey = `level_${payload.spellLevel}` as keyof SpellSlots;
        const slot = caster.spellSlots?.[slotKey];
        if (!slot || slot.current <= 0) {
            addMessage(`${caster.name} has no level ${payload.spellLevel} spell slots left to cast ${spell.name}.`, "system");
            return;
        }
    }

    // Deduct the slot (and consume any material component) via the normal reducer.
    dispatch({ type: 'CAST_SPELL', payload });

    // Immediate healing (Cure Wounds, Healing Word).
    const healing = target.id ? rollOutOfCombatHealing(spell, caster) : 0;
    if (healing > 0 && target.id) {
        dispatch({ type: 'MODIFY_PARTY_HEALTH', payload: { amount: healing, characterIds: [target.id] } });
    }

    // Lasting buffs/utility (Mage Armor, Guidance, Detect Magic).
    const statusEffect = buildOutOfCombatStatusEffect(spell, caster.id ?? payload.characterId);
    if (statusEffect && target.id) {
        dispatch({ type: 'APPLY_CHARACTER_STATUS_EFFECT', payload: { characterId: target.id, statusEffect } });
    }

    const isSelfCast = target.id === caster.id;
    const targetSuffix = isSelfCast ? '' : ` on ${target.name}`;
    if (healing > 0) {
        addMessage(`${caster.name} casts ${spell.name}${targetSuffix}, restoring ${healing} HP.`, "system");
    } else if (statusEffect) {
        addMessage(`${caster.name} casts ${spell.name}${targetSuffix}.`, "system");
    } else {
        addMessage(`${caster.name} casts ${spell.name}.`, "system");
    }

    // Refresh the open character sheet's snapshot so slot pips (and self-cast
    // HP/effects) update immediately. Racial-grant casts skip this because the
    // reducer may deduct a limited use rather than the slot mirrored here.
    if (
        !racialGrant &&
        gameState.characterSheetModal?.isOpen &&
        gameState.characterSheetModal.character?.id === caster.id
    ) {
        const refreshed = applyPostCastToCharacter(caster, spell.level > 0 ? payload.spellLevel : 0, {
            selfHealing: isSelfCast ? healing : 0,
            statusEffect: isSelfCast ? statusEffect : null,
        });
        dispatch({ type: 'OPEN_CHARACTER_SHEET', payload: refreshed });
    }
}

export function handleUseLimitedAbility(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; abilityId: string }): void {
    dispatch({ type: 'USE_LIMITED_ABILITY', payload });
}

export function handleTogglePreparedSpell(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; spellId: string }): void {
    dispatch({ type: 'TOGGLE_PREPARED_SPELL', payload });
}

export async function handleLongRest({
    gameState,
    dispatch,
    addMessage,
    addGeminiLog,
    racialRestChoices,
}: HandleRestProps): Promise<void> {
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
        // Apply both the world/planar outcome and the player's modal choices in
        // the one mechanical rest update so neither path overwrites the other.
        payload: {
            deniedCharacterIds: restOutcome.deniedCharacterIds,
            racialRestChoices,
        }
    });

    // Step 7: Advance the in-game clock.
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 8 * 3600 } }); // 8 hours

    // Long rest is the session boundary this codebase already exposes in play,
    // so this is where we open a new visible journal page. The reducer now
    // fills in the live date, session/page counters, and queued quest events.
    dispatch({
        type: 'ADD_JOURNAL_ENTRY',
        payload: {
            narrativeText: "The party settles in for a long rest and records the day before sleep.",
        },
    });

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
