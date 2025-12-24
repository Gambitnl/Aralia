/**
 * @file src/systems/combat/reactions/OpportunityAttackSystem.ts
 * Logic for detecting and validating Opportunity Attacks (Attacks of Opportunity) in D&D 5e.
 *
 * Rules:
 * - Trigger: Hostile creature moves out of reach.
 * - Requirement: Attacker has Reaction available.
 * - Requirement: Attacker can see target.
 * - Requirement: Attacker is wielding a melee weapon.
 * - Prevention: Disengage action, Teleportation, Forced Movement.
 */

import { CombatCharacter, Position, BattleMapData } from '../../../types/combat';
import { getDistance, canTakeReaction } from '../../../utils/combatUtils';
import { hasLineOfSight } from '../../../utils/lineOfSight';

export interface OpportunityAttackResult {
  canAttack: boolean;
  attackerId: string;
  targetId: string;
  triggerPosition: Position; // The position *before* leaving reach
  reason?: string; // Why it failed (debug/log)
}

export class OpportunityAttackSystem {
  /**
   * Checks if a specific movement step triggers an Opportunity Attack.
   *
   * @param mover The character moving.
   * @param fromPos The tile the mover is leaving.
   * @param toPos The tile the mover is entering.
   * @param potentialAttackers List of all other characters in combat.
   * @param mapData Map data for Line of Sight checks.
   * @returns List of valid Opportunity Attacks triggered by this specific step.
   */
  public checkOpportunityAttacks(
    mover: CombatCharacter,
    fromPos: Position,
    toPos: Position,
    potentialAttackers: CombatCharacter[],
    mapData?: BattleMapData | null
  ): OpportunityAttackResult[] {
    const results: OpportunityAttackResult[] = [];

    // 1. Check if mover is immune
    if (this.isDisengaged(mover)) {
      return [];
    }
    // Note: Teleportation and Forced Movement checks are handled by the caller
    // (caller should not call this system if moveType !== 'willing')

    for (const attacker of potentialAttackers) {
      // Skip self
      if (attacker.id === mover.id) continue;

      // Skip allies (assuming simplistic team check)
      if (attacker.team === mover.team) continue;

      // Skip incapacitated/dead attackers (Dead, Paralyzed, Stunned, etc.)
      if (!canTakeReaction(attacker)) continue;

      // Skip if no reaction
      if (attacker.actionEconomy.reaction.used) continue;

      // Check Visibility (Line of Sight)
      if (mapData) {
        // We check LoS from attacker to the 'fromPos' (where the provoke happens)
        const startTile = mapData.tiles.get(`${attacker.position.x}-${attacker.position.y}`);
        const targetTile = mapData.tiles.get(`${fromPos.x}-${fromPos.y}`);
        if (startTile && targetTile && !hasLineOfSight(startTile, targetTile, mapData)) {
            continue; // Cannot see target
        }
      }

      // Calculate Reach
      const reach = this.getReach(attacker);

      // Geometric Check:
      // OA is triggered when you leave a threatened square.
      // Was 'fromPos' within reach?
      const distFrom = getDistance(attacker.position, fromPos);
      const wasInReach = distFrom <= reach;

      // Is 'toPos' outside reach?
      const distTo = getDistance(attacker.position, toPos);
      const isLeavingReach = distTo > reach;

      if (wasInReach && isLeavingReach) {
          // Valid Trigger
          results.push({
            canAttack: true,
            attackerId: attacker.id,
            targetId: mover.id,
            triggerPosition: fromPos
          });
      }
    }

    return results;
  }

  private isDisengaged(character: CombatCharacter): boolean {
    return character.statusEffects.some(e => e.id === 'disengage' || e.name === 'Disengage');
  }

  private getReach(character: CombatCharacter): number {
    // Default reach is 1 tile (5ft)
    let reach = 1;

    // Check weapon properties
    // We assume the first melee weapon determines reach for OAs
    // In complex 5e, you track reach per weapon. Here we simplify.
    // Critical Fix: Ensure we don't pick up Ranged weapons (like Longbows) as "Reach" weapons.
    // We assume melee weapons have range 1 or 2 (reach). Ranged usually 5+.
    // A better check would be looking at weapon properties, but for now we heuristics on range + name/tags.
    const meleeReachAbility = character.abilities.find(a =>
      a.type === 'attack' &&
      a.range <= 2 && // Strictly limit to melee reach ranges (5ft or 10ft)
      a.range > 1 &&
      a.weapon // It must be a weapon attack
    );

    if (meleeReachAbility) {
      reach = Math.max(reach, meleeReachAbility.range);
    }

    // Check for size/monster reach
    // (Monsters often have Reach 10ft embedded in their attacks)

    return reach;
  }
}
