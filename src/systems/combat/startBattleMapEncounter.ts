/**
 * @file src/systems/combat/startBattleMapEncounter.ts
 * Starts a battle-map encounter from a prepared payload: rejects a
 * contradictory source gap, builds combatants from the bestiary when the
 * caller supplied none, joins WorldForge source identities by order, and
 * dispatches START_BATTLE_MAP_ENCOUNTER.
 *
 * C11 (agora-9ed9.11): moved verbatim from hooks/actions/handleEncounter.ts so
 * systems code can start a battle without a systems -> hooks import. That file
 * re-exports this function, so every existing caller is unchanged.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 16:27:40
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx, hooks/actions/handleEncounter.ts, systems/intent/startThreatCombat.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type React from 'react';
import type { StartBattleMapEncounterPayload } from '../../types';
import type { AppAction } from '../../state/actionTypes';

export async function handleStartBattleMapEncounter(dispatch: React.Dispatch<AppAction>, payload: StartBattleMapEncounterPayload): Promise<void> {
    // A declared source gap is an inert production state, not a partially built
    // encounter. Reject contradictory payloads here so no caller can smuggle a
    // generic roster or unrelated terrain behind the fail-closed UI.
    if (payload.sourceGap) {
        const hasPreparedActors = payload.monsters.length > 0
            || (payload.combatants?.length ?? 0) > 0
            || (payload.combatantWorldSources?.length ?? 0) > 0;
        if (hasPreparedActors || payload.extractedBattleMap) {
            throw new Error(
                `Battlefield source gap "${payload.sourceGap.code}" cannot include monsters, combatants, source identities, or extracted terrain.`,
            );
        }

        dispatch({
            type: 'START_BATTLE_MAP_ENCOUNTER',
            payload: {
                startBattleMapEncounterData: {
                    ...payload,
                    monsters: [],
                    combatants: [],
                },
            },
        });
        return;
    }

    // A source-world encounter may already provide regiment-derived actors with
    // stable WorldForge identities. Preserve those prepared combatants instead
    // of rebuilding them as generic bestiary monsters. Callers without a map
    // may still prepare their actors here, but CombatView deliberately withholds
    // play until that encounter class supplies a real WorldForge projection.
    const preparedCombatants = payload.combatants ?? await (async () => {
        if (payload.monsters.length === 0) return [];
        // First contact must use the authored bestiary, even when a prior cold
        // lookup saw only custom creatures. Prepared source actors bypass this
        // branch; a catalog load failure leaves the encounter undispatched.
        const { ensureMonsterRegistryLoaded } = await import('../../data/adapters/runtimeMonsterRegistry');
        await ensureMonsterRegistryLoaded();
        const { createEnemyFromMonster } = await import('../../utils/combat/createEnemyFromMonster');
        return payload.monsters.flatMap((monster) =>
            Array.from({ length: monster.quantity }, (_, i) => createEnemyFromMonster(monster, i))
        );
    })();
    // Scene receipts and bestiary construction intentionally live on opposite
    // sides of this bridge. Join them by stable flattened order, and fail
    // closed when a caller claims source identities for a different roster.
    if (
        payload.combatantWorldSources
        && payload.combatantWorldSources.length !== preparedCombatants.length
    ) {
        throw new Error(
            `WorldForge supplied ${payload.combatantWorldSources.length} combatant sources for ${preparedCombatants.length} prepared actors.`,
        );
    }
    const combatants = preparedCombatants.map((combatant, index) => ({
        ...combatant,
        ...(payload.combatantWorldSources?.[index]
            ? { worldSource: payload.combatantWorldSources[index] }
            : {}),
    }));
    dispatch({ type: 'START_BATTLE_MAP_ENCOUNTER', payload: { startBattleMapEncounterData: { ...payload, combatants } } });
}
