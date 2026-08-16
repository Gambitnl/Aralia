/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/battlefieldSourceForState.ts
 *
 * Stamps the authoritative "where the battle happens" receipt from live game
 * state.
 *
 * A threat owns only its bestiary roster. Location authority comes from this
 * receipt, which is frozen by the GAME and never accepted from model output, so
 * no generated text can relocate a fight or invent its own source lineage.
 *
 * Extracted from `hooks/useOpeningSituation` once a second caller appeared: a
 * peaceful conversation that turns violent needs the SAME receipt as an authored
 * opening threat. Without it the encounter launches with no source, and
 * CombatView correctly refuses to draw a battlefield — the fight opens on the
 * "Battlefield source missing" boundary instead of the world the player is
 * standing in. Observed live before this existed.
 */
import type { GameState } from '../../types';
import type { OpeningBattlefieldSource } from './types';

/**
 * @param state - Live game state.
 * @param locationLabel - Player-facing place name to carry on the receipt.
 * @returns The receipt, or undefined when the player occupies no canonical
 *   atlas cell. Undefined is honest: there is genuinely no source to name.
 */
export function battlefieldSourceForState(
    state: GameState,
    locationLabel: string,
): OpeningBattlefieldSource | undefined {
    if (!state.playerCell) return undefined;

    // The 3D entry anchor only frames the Locale window when it belongs to the
    // cell the player actually occupies.
    const matchingEntryCenter =
        state.entry3DAnchor?.cellId === state.playerCell.cellId
            ? state.entry3DAnchor.centerPx
            : undefined;

    return {
        kind: 'worldforge-opening-location',
        receiptId: `opening:${state.worldSeed}:cell:${state.playerCell.cellId}`,
        worldSeed: state.worldSeed,
        cellId: state.playerCell.cellId,
        ...(matchingEntryCenter ? { centerPx: matchingEntryCenter } : {}),
        locationLabel,
    };
}
