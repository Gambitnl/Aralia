
import { Portal, PortalRequirement } from '../../types/planes';
import { GameState } from '../../types/index';
import { getTimeOfDay, TimeOfDay } from '../../utils/timeUtils';

export interface PortalActivationResult {
  success: boolean;
  message: string;
  consumedItems?: string[]; // IDs of items consumed
}

export class PortalSystem {

  static checkRequirements(portal: Portal, gameState: GameState): { canActivate: boolean; reason?: string } {
    if (!portal.isActive) {
      return { canActivate: false, reason: "The portal is dormant." };
    }

    for (const req of portal.activationRequirements) {
      const met = this.checkSingleRequirement(req, gameState);
      if (!met.met) {
        return { canActivate: false, reason: met.reason };
      }
    }

    return { canActivate: true };
  }

  private static checkSingleRequirement(req: PortalRequirement, gameState: GameState): { met: boolean; reason?: string } {
    switch (req.type) {
      case 'item':
        // Check inventory
        const hasItem = gameState.inventory.some(item => item.name === req.value || item.id === req.value);
        if (!hasItem) return { met: false, reason: `Requires ${req.value}` };
        return { met: true };

      case 'time':
        if (!gameState.gameTime) {
             return { met: false, reason: "Time is undefined." };
        }
        const timeOfDay = getTimeOfDay(gameState.gameTime);

        if (req.value === 'Night') {
             if (timeOfDay !== TimeOfDay.Night) return { met: false, reason: "Portal only opens at night." };
             return { met: true };
        }
        if (req.value === 'Day') {
             if (timeOfDay !== TimeOfDay.Day) return { met: false, reason: "Portal only opens during the day." };
             return { met: true };
        }

        // Fail closed for unsupported time conditions (e.g. "Full Moon" not yet implemented)
        return { met: false, reason: `Time condition '${req.value}' not currently met.` };

      case 'condition':
        if (req.value === 'Bloodied') {
            const isBloodied = gameState.party.some(pc => pc.hp < pc.maxHp / 2);
            if (!isBloodied) return { met: false, reason: "A sacrifice of vitality (Bloodied) is required." };
            return { met: true };
        }
        return { met: false, reason: `Unknown condition: ${req.value}` };

      case 'spell':
         // This would check if a spell is currently active or was cast on the portal?
         return { met: false, reason: `Requires spell: ${req.value}` };

      default:
        return { met: false, reason: "Unknown requirement type" };
    }
  }

  static activate(portal: Portal, gameState: GameState): PortalActivationResult {
    const check = this.checkRequirements(portal, gameState);
    if (!check.canActivate) {
      return { success: false, message: check.reason || "Portal cannot be activated." };
    }

    const consumedItems: string[] = [];

    // Identify consumable items if any (simplified: assuming 'item' reqs might be consumable)
    // In a real implementation, PortalRequirement should have a 'consumes: boolean' flag.
    // For now, we won't auto-consume unless specified, but we'll prepare the structure.

    return {
        success: true,
        message: `The portal to ${portal.destinationPlaneId} shimmers and opens!`,
        consumedItems
    };
  }
}
