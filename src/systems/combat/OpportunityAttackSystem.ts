/**
 * @file src/systems/combat/OpportunityAttackSystem.ts
 * Logic for detecting and resolving opportunity attacks in combat.
 *
 * Rules:
 * - Trigger: Hostile creature moves out of a character's reach.
 * - Condition: Attacker must have reaction available.
 * - Condition: Attacker must wield a melee weapon (or unarmed).
 * - Condition: Target must not have Disengaged.
 * - Result: Consumes reaction, makes an immediate melee attack.
 */

import { CombatCharacter, Position } from '../../types/combat';
import { getDistance, bresenhamLine } from '../../utils/combatUtils';

export interface OpportunityAttackResult {
  attackerId: string;
  targetId: string;
  triggerPosition: Position; // Where the target was when they provoked
  weaponId?: string;
}

export class OpportunityAttackSystem {
  /**
   * Checks for potential opportunity attacks along a movement path.
   *
   * @param mover The character moving.
   * @param from Start position of the move.
   * @param to End position of the move.
   * @param potentialAttackers List of all other characters who might attack.
   * @returns Array of valid opportunity attack triggers.
   */
  static checkForOpportunityAttacks(
    mover: CombatCharacter,
    from: Position,
    to: Position,
    potentialAttackers: CombatCharacter[]
  ): OpportunityAttackResult[] {
    // 1. Check if mover has Disengage active
    const isDisengaged = mover.statusEffects.some(e => e.name === 'Disengaged');
    if (isDisengaged) return [];

    // 2. Generate path (approximation)
    // We include the start point, but exclude the end point for checking "leaving"
    // Actually, we need to check the transition from Step N to Step N+1.
    const path = bresenhamLine(from.x, from.y, to.x, to.y);

    const results: OpportunityAttackResult[] = [];
    const triggeredAttackers = new Set<string>(); // Prevent multiple OAs from same attacker in one move

    // Iterate through the path to find moments of "leaving reach"
    // We check each segment: path[i] -> path[i+1]
    for (let i = 0; i < path.length - 1; i++) {
      const currentPos = path[i];
      const nextPos = path[i+1];

      for (const attacker of potentialAttackers) {
        if (attacker.id === mover.id) continue;
        if (attacker.team === mover.team) continue; // Only enemies provoke
        if (triggeredAttackers.has(attacker.id)) continue; // Already attacked this move
        if (attacker.actionEconomy.reaction.used) continue; // No reaction left
        if (attacker.currentHP <= 0) continue; // Unconscious/Dead

        // Determine Reach
        const reach = OpportunityAttackSystem.getMeleeReach(attacker);
        if (reach === 0) continue; // No melee weapon

        const distCurrent = getDistance(currentPos, attacker.position);
        const distNext = getDistance(nextPos, attacker.position);

        // TRIGGER: Was in reach, now out of reach
        // Note: In 5e grid (Chebyshev), adjacent is 1. Reach 1 = 5ft.
        if (distCurrent <= reach && distNext > reach) {
          results.push({
            attackerId: attacker.id,
            targetId: mover.id,
            triggerPosition: currentPos,
            weaponId: OpportunityAttackSystem.getEquippedMeleeWeaponId(attacker)
          });
          triggeredAttackers.add(attacker.id);
        }
      }
    }

    return results;
  }

  /**
   * Determines the melee reach of a character based on equipped weapons.
   * Default is 1 (5ft). Reach weapons give 2 (10ft).
   * Returns 0 if no melee capability (though everyone has unarmed 1).
   */
  private static getMeleeReach(character: CombatCharacter): number {
    // Check equipped weapons for 'reach' property
    // We iterate abilities since 'equippedItems' is on PlayerCharacter, not CombatCharacter directly,
    // but CombatCharacter.abilities links back to weapon.

    // Fallback: everyone has at least Unarmed Strike (Reach 1)
    let maxReach = 1;

    // Look for melee weapons in abilities
    const meleeAbilities = character.abilities.filter(a =>
      a.type === 'attack' &&
      a.range > 0 && // sanity check
      // Ideally we check if it's a melee attack.
      // Our data doesn't explicitly flag "melee" vs "ranged" well in 'Ability' except via range usually being 1 or 2,
      // or description/name.
      // However, createPlayerCombatCharacter sets range=2 for reach weapons.
      // Ranged weapons (bows) usually have range 30/60+.
      // Heuristic: Range <= 2 is Melee. Range > 2 is Ranged.
      a.range <= 2
    );

    if (meleeAbilities.length > 0) {
        // If we have a reach weapon (range 2), use that.
        const hasReachWeapon = meleeAbilities.some(a => a.range === 2);
        if (hasReachWeapon) maxReach = 2;
    }

    // TODO: Monsters with reach > 10ft (Reach 3+) needs explicit support in Monster Data.
    // For now, assuming standard sizes.

    return maxReach;
  }

  private static getEquippedMeleeWeaponId(character: CombatCharacter): string | undefined {
      // Prioritize Main Hand
      const main = character.abilities.find(a => a.id.includes('main') && a.type === 'attack');
      if (main && main.range <= 2) return main.id;

      // Fallback to Unarmed
      const unarmed = character.abilities.find(a => a.id === 'unarmed_strike');
      if (unarmed) return unarmed.id;

      // Fallback to any melee
      return character.abilities.find(a => a.type === 'attack' && a.range <= 2)?.id;
  }
}
