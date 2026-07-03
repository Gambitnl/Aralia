import { GameState, Location } from '../../types';
import { getCurrentPlane } from '../../utils/planarUtils';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import { LOCATIONS } from '../../constants';

export interface RestOutcome {
  deniedCharacterIds: string[];
  messages: string[];
}

/**
 * Checks planar rules for resting and determines which characters
 * are denied benefits or suffer consequences.
 */
export function checkPlanarRestRules(gameState: GameState): RestOutcome {
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
  const plane = getCurrentPlane(resolvedLocation ?? fallbackLocation);
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
  const hasDespairTrait = plane.traits.some(t => t.id === 'shadowfell_despair' || t.name.includes('Despair'));

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
