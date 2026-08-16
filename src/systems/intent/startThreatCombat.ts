/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/startThreatCombat.ts
 *
 * The one path from a threat roster into a running battle.
 *
 * Lifted out of `hooks/useDeEscalation` so the hostile-opening flow and the new
 * universal intent flow launch combat through the SAME code. Two copies would
 * drift, and the battlefield-receipt handling below is exactly the part that
 * must never drift.
 *
 * Location authority: the threat owns only its bestiary roster. Where the battle
 * happens comes from the frozen receipt plus the currently mounted GroundWorld.
 * If either is absent or rejects the receipt, the encounter launches WITHOUT a
 * map so CombatView presents its source-gap boundary. It is never replaced with
 * procedural terrain.
 */
import type React from 'react';
import type { AppAction } from '../../state/actionTypes';
import type { SituationThreat } from '../gameEntry/types';
import { threatToMonsters } from '../gameEntry/deEscalationToCombat';
import { handleStartBattleMapEncounter } from '../../hooks/actions/handleEncounter';
import {
    awaitActiveGroundOpeningProvider,
    isActiveGroundOpeningProviderMounted,
    prepareActiveGroundOpeningEncounter,
} from '../combat/fightInPlace/activeGroundCombatSession';

/**
 * How long to wait for a GroundWorld to mount before giving up on a real
 * battlefield. Ground load is staged and worker-backed, so it is not instant.
 */
export const GROUND_MOUNT_TIMEOUT_MS = 20000;

export interface StartThreatCombatArgs {
    threat: SituationThreat;
    dispatch: React.Dispatch<AppAction>;
    /** Injectable for tests; defaults to the real encounter launcher. */
    startEncounter?: typeof handleStartBattleMapEncounter;
    /** Injectable live-GroundWorld projector for deterministic source-path tests. */
    prepareOpeningEncounter?: typeof prepareActiveGroundOpeningEncounter;
    /**
     * Mounts the GroundWorld when none is live, e.g. by switching the view to
     * 3D. A fight started from a 2D conversation has no world to crop, and the
     * game owns exactly ONE battlefield source — the GroundWorld — so it mounts
     * that rather than growing a second source for 2D.
     */
    ensureGroundMounted?: () => void;
}

export async function startThreatCombat(args: StartThreatCombatArgs): Promise<void> {
    const { threat, dispatch } = args;
    const startEncounter = args.startEncounter ?? handleStartBattleMapEncounter;
    const prepareOpeningEncounter = args.prepareOpeningEncounter ?? prepareActiveGroundOpeningEncounter;

    const monsters = threatToMonsters(threat);
    const source = threat.battlefieldSource;
    if (!source) {
        console.warn('[intent] threat carried NO battlefieldSource — combat launches mapless.');
        await startEncounter(dispatch, { monsters });
        return;
    }

    // The receipt names the ground, but only a mounted GroundWorld can crop it.
    // Mount one first when the fight started from a 2D conversation.
    if (!isActiveGroundOpeningProviderMounted() && args.ensureGroundMounted) {
        args.ensureGroundMounted();
        const mounted = await awaitActiveGroundOpeningProvider(GROUND_MOUNT_TIMEOUT_MS);
        if (!mounted) {
            console.warn('[intent] GroundWorld did not mount in time — combat launches mapless.');
        }
    }

    const projection = await prepareOpeningEncounter({ source, enemies: threat.enemies });
    if (projection.status !== 'ready') {
        console.warn('[intent] projection not ready:', projection.status, projection.detail, 'source:', source);
        await startEncounter(dispatch, { monsters });
        return;
    }

    // Accept the generated scene into save-backed world history before the
    // combat phase replaces the conversation. The receipt survives return-to-
    // world even though the tactical board itself is transient.
    dispatch({ type: 'RECORD_WORLDFORGE_ENCOUNTER', payload: { receipt: projection.receipt } });

    const combatantWorldSources = projection.receipt.entities.map((entity) => {
        const { sourcePatchTile: _sourcePatchTile, ...sourceIdentity } = entity;
        return sourceIdentity;
    });

    await startEncounter(dispatch, {
        monsters,
        extractedBattleMap: projection.mapData,
        combatantWorldSources,
    });
}
