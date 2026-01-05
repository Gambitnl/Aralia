// TODO(lint-intent): 'PlayerCharacter' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, Location, PlayerCharacter as _PlayerCharacter } from '../../types';
import { getCurrentPlane } from '../../utils/planarUtils';
import { rollSavingThrow } from '../../utils/savingThrowUtils';
// TODO(lint-intent): 'logger' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { logger as _logger } from '../../utils/logger';
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
    mapCoordinates: { x: 0, y: 0 },
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
    // TODO(2026-01-03 pass 4 Codex-CLI): Require PlayerCharacter ids before rest checks run.
    // Previously mapped c.id directly; now default to a placeholder to satisfy optional id.
    outcome.deniedCharacterIds = gameState.party.map(c => c.id ?? 'unknown-character');
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
            // TODO(2026-01-03 pass 4 Codex-CLI): Require PlayerCharacter ids before rest checks run.
            // Previously pushed character.id directly; now default to a placeholder to satisfy optional id.
            const characterId = character.id ?? 'unknown-character';
            outcome.deniedCharacterIds.push(characterId);
            outcome.messages.push(`${character.name} succumbs to despair (Rolled ${usedTotal} vs DC 15) and finds no rest.`);
        } else {
            outcome.messages.push(`${character.name} resists the gloom.`);
        }
     });
  }

  return outcome;
}
