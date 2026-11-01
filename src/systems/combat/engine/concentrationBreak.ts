/**
 * @file systems/combat/engine/concentrationBreak.ts
 * Breaks concentration through the command layer, the same path the command flow uses.
 *
 * C2 (agora-9ed9.2): moved out of hooks/combat/engine/useCombatEngine.ts so the
 * rules can be read and tested without React. Bodies are unchanged; values the
 * hook used to close over now arrive through a context object under the same
 * names. The hook keeps a useCallback wrapper with the original dependency list,
 * so callback identity and phase ownership do not change.
 *
 * Called by: hooks/combat/engine/useCombatEngine.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/combat/engine/useCombatEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatState } from '../../../types/combat';
import { ActiveSpellZone } from '../../../systems/spells/effects';
// A failed concentration save runs the same cleanup the command path runs, by
// running the command the command path runs (agora-f821.43).
import { BreakConcentrationCommand } from '../../../commands/effects/ConcentrationCommands';
import type { ConcentrationBreakContext } from './engineContextTypes';

export function breakConcentrationThroughCommandLayer(
    ctx: ConcentrationBreakContext,
    concentrator: CombatCharacter,
): CombatCharacter {
    const { activeLightSources, characters, mapData, onActiveLightSourcesUpdate, onCharacterUpdate, onLogEntry, spellZones, setSpellZones } = ctx;
    const concentration = concentrator.concentratingOn;
    if (!concentration) return concentrator;

    const stateCharacters = characters.map(candidate => (
        candidate.id === concentrator.id ? concentrator : candidate
    ));
    const commandState: CombatState = {
        isActive: true,
        characters: stateCharacters,
        turnState: {
            currentTurn: 0,
            turnOrder: stateCharacters.map(candidate => candidate.id),
            currentCharacterId: concentrator.id,
            phase: 'planning',
            actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: [],
        activeLightSources: activeLightSources ?? [],
        spellZones,
        mapData: mapData || undefined
    };

    const nextState = new BreakConcentrationCommand({
        spellId: concentration.spellId,
        spellName: concentration.spellName,
        castAtLevel: concentration.spellLevel ?? 0,
        caster: concentrator,
        targets: [],
    }).execute(commandState);

    nextState.characters.forEach((character, index) => {
        if (character === stateCharacters[index]) return;
        if (character.id === concentrator.id) return;
        onCharacterUpdate(character);
    });

    nextState.combatLog.forEach(entry => onLogEntry(entry));

    if (nextState.spellZones !== spellZones) {
        setSpellZones((nextState.spellZones ?? []) as ActiveSpellZone[]);
    }
    if (onActiveLightSourcesUpdate && nextState.activeLightSources !== commandState.activeLightSources) {
        onActiveLightSourcesUpdate(nextState.activeLightSources ?? []);
    }

    return nextState.characters.find(candidate => candidate.id === concentrator.id) ?? concentrator;
}
