// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:10:35
 * Dependents: components/layout/GameModals.tsx, hooks/actions/handleResourceActions.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, Location } from '../../types';
import { getCurrentPlane } from '../../utils/planar';
import { rollSavingThrow } from '../../utils/character';
import { createPlayerCombatCharacter } from '../../utils/combat';
import { LOCATIONS } from '../../data/world/locations';

export interface RestOutcome {
  deniedCharacterIds: string[];
  messages: string[];
}

// Preview and commitment resolve the same authored location, including dynamic
// planes. Opening a dialog must never roll saves or consume world state.
function resolveRestPlane(gameState: GameState) {
  const resolvedLocation =
    gameState.dynamicLocations?.[gameState.currentLocationId] ??
    LOCATIONS[gameState.currentLocationId];
  const fallbackLocation: Location = {
    id: gameState.currentLocationId,
    name: 'Unknown Location',
    baseDescription: '',
    exits: {},
    biomeId: 'unknown',
    planeId: 'material'
  };
  return getCurrentPlane(resolvedLocation ?? fallbackLocation);
}

function hasDespairRestRisk(plane: ReturnType<typeof getCurrentPlane>): boolean {
  return plane.traits.some(trait => trait.id === 'shadowfell_despair' || trait.name.includes('Despair'));
}

export function getPlanarRestPreview(gameState: GameState, kind: 'short' | 'long'): {
  blockReason: string | null;
  warning: string | null;
} {
  const plane = resolveRestPlane(gameState), rules = plane.effects?.affectsRest;
  if (!rules) return {blockReason: null, warning: null};
  const allowed = kind === 'long' ? rules.longRestAllowed : rules.shortRestAllowed;
  if (!allowed) return {blockReason: (kind === 'long' ? 'Long' : 'Short') + ' rests are not possible in ' + plane.name + '.', warning: null};
  return {blockReason: null, warning: kind === 'long' && hasDespairRestRisk(plane)
    ? 'In ' + plane.name + ', each eligible member makes a DC 15 Wisdom saving throw with disadvantage. Those who fail gain no rest benefits. The attempt still uses its normal time and provisions.'
    : null};
}

/**
 * Checks planar rules for resting and determines which characters
 * are denied benefits or suffer consequences.
 */
export function checkPlanarRestRules(gameState: GameState): RestOutcome {
  const plane = resolveRestPlane(gameState);
  const outcome: RestOutcome = {
    deniedCharacterIds: [],
    messages: []
  };

  // If the plane has no rest effects, everyone rests normally
  if (!plane.effects?.affectsRest) {
    return outcome;
  }

  const restRules = plane.effects.affectsRest;

  // Check if Long Rest is allowed at all
  if (!restRules.longRestAllowed) {
    outcome.messages.push(`Long rests are not possible in ${plane.name}.`);
    outcome.deniedCharacterIds = gameState.party.map(c => c.id);
    return outcome;
  }

  // Shadowfell Logic (or any plane with Despair trait)
  const hasDespairTrait = hasDespairRestRisk(plane);

  if (hasDespairTrait) {
     outcome.messages.push(`The despair of the ${plane.name} weighs heavy...`);

     gameState.party.forEach(character => {
        const combatCharLike = createPlayerCombatCharacter(character);

        // Disadvantage due to ShadowfellDespairTrait
        const save1 = rollSavingThrow(combatCharLike, 'Wisdom', 15);
        const save2 = rollSavingThrow(combatCharLike, 'Wisdom', 15);

        // Disadvantage: succeed only if BOTH succeed
        const passed = save1.success && save2.success;
        // Get the actual roll used for display (lower one)
        const usedTotal = save1.total < save2.total ? save1.total : save2.total;

        if (!passed) {
            outcome.deniedCharacterIds.push(character.id);
            outcome.messages.push(`${character.name} succumbs to despair (Rolled ${usedTotal} vs DC 15) and finds no rest.`);
        } else {
            outcome.messages.push(`${character.name} resists the gloom.`);
        }
     });
  }

  return outcome;
}
