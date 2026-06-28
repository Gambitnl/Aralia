// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 15:41:21
 * Dependents: hooks/combat/useActionExecutor.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  triggerReach?: number; // The threatened reach threshold that was crossed.
  reason?: string; // Why it failed (debug/log)
}

type MovementMode = 'fly' | 'walk' | 'swim' | 'climb' | 'any';

export interface OpportunityAttackCheckOptions {
  movementMode?: MovementMode;
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
    mapData?: BattleMapData | null,
    options: OpportunityAttackCheckOptions = {}
  ): OpportunityAttackResult[] {
    const results: OpportunityAttackResult[] = [];

    // 1. Check if mover is immune
    if (this.isDisengaged(mover)) {
      return [];
    }
    if (this.hasSummonOpportunitySuppression(mover, options.movementMode)) {
      return [];
    }
    // Note: Teleportation and Forced Movement checks are handled by the caller
    // (caller should not call this system if moveType !== 'willing')

    for (const attacker of potentialAttackers) {
      // Skip self
      if (attacker.id === mover.id) continue;

      // Skip allies (assuming simplistic team check)
      if (attacker.team === mover.team) continue;

      // Check if attacker can physically take a reaction (Alive, Conscious, Not Incapacitated/Stunned/Paralyzed)
      if (!canTakeReaction(attacker)) continue;

      // Check if attacker has Opportunity Attacks Suppressed
      const hasOASuppressed = attacker.statusEffects.some(e => e.id === 'opportunity_attacks_suppressed' || e.name === 'Opportunity Attacks Suppressed');
      if (hasOASuppressed) continue;

      // Check Visibility (Line of Sight)
      if (mapData) {
        // We check LoS from attacker to the 'fromPos' (where the provoke happens)
        const startTile = mapData.tiles.get(`${attacker.position.x}-${attacker.position.y}`);
        const targetTile = mapData.tiles.get(`${fromPos.x}-${fromPos.y}`);
        if (startTile && targetTile && !hasLineOfSight(startTile, targetTile, mapData)) {
            continue; // Cannot see target
        }
      }

      // Calculate reach thresholds per weapon/ability.
      // We keep the lowest threatened reach that was crossed so a character
      // with both 5ft and 10ft weapons still provokes at the first boundary
      // without generating duplicate OA entries for the same reaction spend.
      const triggeredReach = this.getTriggeredReach(attacker, fromPos, toPos);
      if (triggeredReach === null) continue;

      // Valid Trigger
      const isEnemiesAbound = attacker.statusEffects.some(e => e.id === 'enemies_abound' || e.name === 'Enemies Abound');

      results.push({
        canAttack: true,
        attackerId: attacker.id,
        targetId: mover.id,
        triggerPosition: fromPos,
        triggerReach: triggeredReach,
        reason: isEnemiesAbound ? 'enemies_abound_must_attack' : undefined
      });
    }

    return results;
  }

  private isDisengaged(character: CombatCharacter): boolean {
    return character.statusEffects.some(e => e.id === 'disengage' || e.name === 'Disengage');
  }

  private hasSummonOpportunitySuppression(character: CombatCharacter, explicitMovementMode?: MovementMode): boolean {
    const traits = character.summonMetadata?.formTraits ?? [];

    // Summon Beast's Air form has Flyby: leaving enemy reach while flying does
    // not provoke opportunity attacks. The summoned actor carries the trait
    // from spell JSON so the opportunity system can enforce it without knowing
    // which spell created the creature. The movement caller must pass the
    // actual movement mode; otherwise a selected Air form would become immune
    // to Opportunity Attacks even when a non-map or future caller did not prove
    // that the movement was flight.
    if (!explicitMovementMode) {
      return false;
    }

    return traits.some(trait =>
      trait.opportunityAttackPolicy === 'does_not_provoke_when_flying_out_of_reach' &&
      (!trait.appliesToForms?.length || trait.appliesToForms.includes(character.summonMetadata?.formName ?? '')) &&
      (trait.movementModeRequired === undefined ||
        trait.movementModeRequired === 'any' ||
        explicitMovementMode === trait.movementModeRequired)
    );
  }

  private getThreatenedReaches(character: CombatCharacter): number[] {
    // Default reach is 1 tile (5ft).
    // We keep the set distinct and sorted so reach checks stay deterministic
    // when a creature has both normal and reach weapons.
    const threatenedReaches = new Set<number>([1]);

    for (const ability of character.abilities) {
      if (
        ability.type === 'attack' &&
        ability.weapon &&
        ability.range > 1 &&
        ability.range <= 2
      ) {
        threatenedReaches.add(ability.range);
      }
    }

    return [...threatenedReaches].sort((a, b) => a - b);
  }

  private getTriggeredReach(character: CombatCharacter, fromPos: Position, toPos: Position): number | null {
    const threatenedReaches = this.getThreatenedReaches(character);
    const distFrom = getDistance(character.position, fromPos);
    const distTo = getDistance(character.position, toPos);

    // Pick the first threatened boundary that was crossed so one movement step
    // still spends only one reaction even if the move passed through multiple
    // threatened radii.
    for (const reach of threatenedReaches) {
      if (distFrom <= reach && distTo > reach) {
        return reach;
      }
    }

    return null;
  }
}
