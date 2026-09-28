
import { Portal, PortalRequirement } from '../../types/planes';
import { GameState, PlayerCharacter } from '../../types/index';
import { getTimeOfDay, getSeason, TimeOfDay, Season } from '../../utils/core';
import { getMoonPhase, getHoliday, HOLIDAYS, MoonPhase } from '../time/CalendarSystem';

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
      case 'item': {
        // Check inventory
        const hasItem = gameState.inventory.some(item => item.name === req.value || item.id === req.value);
        if (!hasItem) return { met: false, reason: `Requires ${req.value}` };
        return { met: true };
      }

      case 'time': {
        if (!gameState.gameTime) {
             return { met: false, reason: "Time is undefined." };
        }
        return this.checkTimeCondition(req.value, gameState.gameTime);
      }

      case 'condition':
        if (req.value === 'Bloodied') {
            const isBloodied = gameState.party.some(pc => pc.hp < pc.maxHp / 2);
            if (!isBloodied) return { met: false, reason: "A sacrifice of vitality (Bloodied) is required." };
            return { met: true };
        }
        return { met: false, reason: `Unknown condition: ${req.value}` };

      case 'spell':
         return this.checkSpellCondition(req.value, gameState);

      default:
        return { met: false, reason: "Unknown requirement type" };
    }
  }

  /**
   * Evaluates a calendar condition against the game clock.
   *
   * Four vocabularies are understood, in this order: time of day (Dawn/Day/Dusk/Night),
   * moon phase (the 28-day cycle in CalendarSystem, so "Full Moon" is a real check
   * rather than a closed door), season, and holiday. A value from none of them is
   * reported as unrecognized instead of as an unmet condition, because a portal keyed
   * to a condition the game cannot evaluate is authoring data that needs fixing.
   */
  private static checkTimeCondition(value: string, gameTime: Date): { met: boolean; reason?: string } {
    const timeOfDay = getTimeOfDay(gameTime);
    if (Object.values(TimeOfDay).includes(value as TimeOfDay)) {
      if (timeOfDay !== value) {
        return { met: false, reason: `The portal only opens at ${value}; it is ${timeOfDay}.` };
      }
      return { met: true };
    }

    if (Object.values(MoonPhase).includes(value as MoonPhase)) {
      const phase = getMoonPhase(gameTime);
      if (phase !== value) {
        return { met: false, reason: `The portal waits for the ${value}; the moon shows ${phase}.` };
      }
      return { met: true };
    }

    if (Object.values(Season).includes(value as Season)) {
      const season = getSeason(gameTime);
      if (season !== value) {
        return { met: false, reason: `The portal only opens in ${value}; it is ${season}.` };
      }
      return { met: true };
    }

    const namedHoliday = HOLIDAYS.find(holiday => holiday.name === value);
    if (namedHoliday) {
      const today = getHoliday(gameTime);
      if (today?.id !== namedHoliday.id) {
        return { met: false, reason: `The portal only opens on ${namedHoliday.name}.` };
      }
      return { met: true };
    }

    return { met: false, reason: `Unrecognized time condition '${value}'.` };
  }

  /**
   * Evaluates a spell condition against the magic currently running on the party.
   *
   * A party member carrying an active effect whose name or source names the spell
   * satisfies the requirement. Magic bound to the portal itself is NOT covered:
   * `Portal` has no field recording spells cast upon it, so that half stays unbuilt
   * rather than faked (see the PK-14 report).
   */
  private static checkSpellCondition(value: string, gameState: GameState): { met: boolean; reason?: string } {
    const wanted = value.trim().toLowerCase();
    const party: PlayerCharacter[] = gameState.party ?? [];
    const isActive = party.some(pc =>
      (pc.activeEffects ?? []).some(effect =>
        effect.name.trim().toLowerCase() === wanted || effect.source.trim().toLowerCase() === wanted
      )
    );

    if (!isActive) {
      return { met: false, reason: `Requires the magic of ${value} to be active.` };
    }
    return { met: true };
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
