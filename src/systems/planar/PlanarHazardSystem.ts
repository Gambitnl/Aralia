
import { GameState, PlayerCharacter } from '../../types';
import { PlanarHazard, Plane } from '../../types/planes';
import { getCurrentPlane } from '../../utils/planarUtils';
import { rollDice , createPlayerCombatCharacter } from '../../utils/combatUtils';
import { rollSavingThrow } from '../../utils/savingThrowUtils';

import { generateId } from '../../utils/idGenerator';
import { logger } from '../../utils/logger';

export interface HazardEvent {
  characterId: string;
  hazardName: string;
  damage?: number;
  damageType?: string; // e.g., 'psychic', 'fire'
  statusEffect?: string;
  message: string;
}

export interface HazardOutcome {
  events: HazardEvent[];
  globalMessages: string[];
}

export class PlanarHazardSystem {

  /**
   * Processes active hazards for the current plane based on time passed.
   * This should be called periodically (e.g., every minute or every tick).
   * @param gameState Current game state.
   * @param minutesPassed Number of minutes passed since last check.
   */
  static processPeriodicHazards(gameState: GameState, minutesPassed: number): HazardOutcome {
    const plane = getCurrentPlane(gameState.currentLocation);
    const outcome: HazardOutcome = {
      events: [],
      globalMessages: []
    };

    // If no hazards or damage effects, return early
    if ((!plane.hazards || plane.hazards.length === 0) && !plane.effects?.psychicDamagePerMinute) {
      return outcome;
    }

    // Process 'psychicDamagePerMinute' from Plane Effects (Legacy/Convenience field)
    if (plane.effects?.psychicDamagePerMinute && minutesPassed > 0) {
      const damage = plane.effects.psychicDamagePerMinute * minutesPassed;
      if (damage > 0) {
        outcome.globalMessages.push(`The intense pressure of ${plane.name} assaults your mind.`);
        gameState.party.forEach(char => {
            outcome.events.push({
                characterId: char.id,
                hazardName: 'Planar Pressure',
                damage: damage,
                damageType: 'psychic',
                message: `${char.name} takes ${damage} psychic damage from the plane's aura.`
            });
        });
      }
    }

    // Process Defined Hazards
    if (plane.hazards) {
      plane.hazards.forEach(hazard => {
        // Calculate how many times this hazard triggers.
        // Assuming hazards trigger once per minute (standard 5e environmental turn).
        let triggers = Math.floor(minutesPassed);

        // Safety cap to prevent infinite loops on massive time skips
        if (triggers > 1440) { // Cap at 24 hours of checks
            outcome.globalMessages.push("Time flows too quickly to track every danger...");
            triggers = 1440;
        }

        if (triggers > 0) {
             this.processSingleHazard(hazard, gameState, outcome, triggers);
        }
      });
    }

    return outcome;
  }

  private static processSingleHazard(hazard: PlanarHazard, gameState: GameState, outcome: HazardOutcome, triggers: number) {
    // If hazard has a Save DC, we roll for each character
    if (hazard.saveDC > 0) {
        gameState.party.forEach(char => {
            let failures = 0;
            let totalDamage = 0;
            let damageType = 'physical';

            for (let i = 0; i < triggers; i++) {
                // Using CombatCharacter for saving throw logic
                const combatChar = createPlayerCombatCharacter(char);
                // Defaulting to Wisdom save for mental hazards, Con for physical.
                // Ideally PlanarHazard should specify save ability.
                let saveAbility: 'Constitution' | 'Wisdom' | 'Dexterity' = 'Constitution';
                if (hazard.damage?.includes('psychic') || hazard.description.toLowerCase().includes('mind')) {
                    saveAbility = 'Wisdom';
                }

                const saveResult = rollSavingThrow(combatChar, saveAbility, hazard.saveDC);

                if (!saveResult.success) {
                    failures++;
                    if (hazard.damage) {
                        const parts = hazard.damage.split(' ');
                        const dice = parts[0];
                        damageType = parts.length > 1 ? parts[1] : 'physical';
                        totalDamage += rollDice(dice);
                    }
                }
            }

            if (failures > 0) {
                 outcome.events.push({
                    characterId: char.id,
                    hazardName: hazard.name,
                    damage: totalDamage > 0 ? totalDamage : undefined,
                    damageType: totalDamage > 0 ? damageType : undefined,
                    statusEffect: hazard.effect,
                    message: `${char.name} failed ${failures} save(s) against ${hazard.name}${totalDamage > 0 ? ` and takes ${totalDamage} ${damageType} damage` : ''}.`
                });
            }
        });
    } else {
        // No save, automatic effect (e.g. constant damage or environment change)
        if (hazard.damage) {
             gameState.party.forEach(char => {
                let totalDamage = 0;
                let damageType = 'physical';
                const parts = hazard.damage!.split(' ');
                const dice = parts[0];
                damageType = parts.length > 1 ? parts[1] : 'physical';

                for (let i = 0; i < triggers; i++) {
                    totalDamage += rollDice(dice);
                }

                outcome.events.push({
                    characterId: char.id,
                    hazardName: hazard.name,
                    damage: totalDamage,
                    damageType: damageType,
                    statusEffect: hazard.effect,
                    message: `${char.name} is affected by ${hazard.name} for ${triggers} minute(s) and takes ${totalDamage} ${damageType} damage.`
                });
             });
        }
    }
  }
}
