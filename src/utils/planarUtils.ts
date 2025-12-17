
import { Plane, Portal, PortalRequirement } from '../types/planes';
import { PLANES } from '../data/planes';
import { Location, GameState, MagicSchool } from '../types/index';

/**
 * Retrieves the plane object by its ID.
 * @param planeId - The ID of the plane to retrieve.
 * @returns The Plane object, or the Material Plane if not found.
 */
export function getPlane(planeId: string): Plane {
  return PLANES[planeId] || PLANES['material'];
}

/**
 * Determines the current plane based on the current location.
 * @param currentLocation - The current location object.
 * @returns The Plane object the location resides in.
 */
export function getCurrentPlane(currentLocation: Location): Plane {
  if (!currentLocation || !currentLocation.planeId) {
    return PLANES['material'];
  }
  return getPlane(currentLocation.planeId);
}

/**
 * Checks if a portal can be activated given the current game state.
 * @param portal - The portal to check.
 * @param gameState - The current game state.
 * @returns True if the portal can be activated.
 */
export function canActivatePortal(portal: Portal, gameState: GameState): boolean {
  // Check requirements
  for (const req of portal.activationRequirements) {
    if (!checkRequirement(req, gameState)) {
      return false;
    }
  }

  return true;
}

function checkRequirement(req: PortalRequirement, gameState: GameState): boolean {
  switch (req.type) {
    case 'item':
      return gameState.inventory.some(item => item.name === req.value || item.id === req.value);
    case 'time':
      // Simplified time check - would need real time system
      return true;
    case 'condition':
      // Example: "Bloodied" - check if any party member is < 50% HP
      if (req.value === 'Bloodied') {
        return gameState.party.some(pc => pc.hp < pc.maxHp / 2);
      }
      return false;
    default:
      return false;
  }
}

/**
 * Calculates the modified DC or effectiveness of a spell based on the current plane.
 * @param spellSchool - The school of the spell being cast.
 * @param plane - The plane the spell is being cast on.
 * @param baseDC - The original DC of the spell.
 * @returns The modified DC.
 */
export function getPlanarSpellModifier(spellSchool: MagicSchool, plane: Plane): number {
  if (!plane.effects || !plane.effects.affectsMagic) return 0;

  const modifier = plane.effects.affectsMagic.find(m => m.school === spellSchool);
  if (!modifier) return 0;

  switch (modifier.effect) {
    case 'empowered':
      return 1; // +1 to DC or Attack roll
    case 'impeded':
      return -1;
    case 'nullified':
      return -999; // Effectively impossible
    case 'wild':
      return 0; // Wild magic needs separate handling
    default:
      return 0;
  }
}

/**
 * Returns a description of how the plane affects the character's senses/feelings.
 * @param plane - The current plane.
 * @returns A string description.
 */
export function getPlanarAtmosphere(plane: Plane): string {
  return plane.atmosphereDescription || "The air feels stable and familiar.";
}
