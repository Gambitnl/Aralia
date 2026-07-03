// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 23:05:12
 * Dependents: hooks/combat/useCombatAI.ts, hooks/combat/useTurnManager.ts, utils/combat/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file combatAI.ts
 */
import { CombatCharacter, CombatAction, BattleMapData, Ability, Position, BattleMapTile } from '../../types/combat';
import { computeAoETiles, getDistance, generateId, resolveAreaDefinition, getOccupiedTiles, getCharacterDistance } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';
import { TargetValidationUtils } from '../../systems/spells/targeting/TargetValidationUtils';
import { logger } from '../logger';

/**
 * Scoring weights used to prioritize AI actions.
 * These constants act as "knobs" to tune the AI's behavior.
 *
 * - Positive values encourage behavior.
 * - Negative values discourage behavior.
 * - Higher magnitude means stronger preference.
 */
const WEIGHTS = {
  /** Bonus for killing a target (removing an enemy action). */
  KILL_TARGET: 120,
  /** Multiplier per point of damage dealt. */
  DAMAGE: 1,
  /** Multiplier per point of healing delivered. Prioritized slightly over damage. */
  HEAL: 1.6,
  /** Bonus for actions that improve the caster's own survival (e.g. retreating when low). */
  SELF_PRESERVATION: 4,
  /** Penalty per tile moved to discourage unnecessary movement. */
  DISTANCE_PENALTY: -0.1,
  /** Bonus for attacking a target that is already damaged (Focus Fire). */
  FOCUS_FIRE_BONUS: 6,
  /** Multiplier for distance from enemies when low on HP. */
  SAFETY_DISTANCE: 0.4,
  /** Bonus per additional target hit in an AoE. */
  AOE_MULTI_TARGET: 14,
  /** Strong penalty for hitting allies with damaging effects. */
  FRIENDLY_FIRE_PENALTY: -35,
  /** Small bonus for keeping distance while casting (kiting). */
  POSITIONING_BONUS: 0.6,
};

const matchesAbilityCreatureTypes = (target: CombatCharacter, validCreatureTypes?: string[]): boolean => {
  if (!validCreatureTypes?.length) return true;

  // AI targeting must use the same taxonomy read path as player spell
  // targeting. During migration, some creatures have top-level creatureTypes
  // while older data keeps the labels under stats.creatureTypes.
  const targetCreatureTypes = TargetValidationUtils.getCreatureTypes(target);
  return validCreatureTypes.some(requiredType =>
    targetCreatureTypes.some(targetType => targetType.toLowerCase() === requiredType.toLowerCase())
  );
};

/**
 * Represents a candidate action for the AI to consider.
 * Each plan includes the type of action, targets, and a computed score
 * indicating its estimated value to the team.
 */
interface AIPlan {
  /** The type of action to perform. */
  actionType: 'move' | 'ability' | 'end_turn';
  /** The ID of the ability to use, if applicable. */
  abilityId?: string;
  /** The target location for the action (move destination or spell target). */
  targetPosition?: Position;
  /** IDs of characters targeted by this action. */
  targetCharacterIds?: string[];
  /** Tile-by-tile movement route for move plans. */
  movementPath?: Position[];
  /** Movement cost for move plans, using the planner's reachable-tile budget. */
  movementCost?: number;
  /** The utility score of this plan. Higher is better. */
  score: number;
  /** Human-readable description of the plan for debugging/logging. */
  description: string;
}

/**
 * Reachable movement tile plus the route used to get there.
 *
 * AI planning chooses a destination first, but spell-zone triggers need the
 * walked route later. Keeping the path in the reachable-tile cache lets every
 * AI movement plan reuse one source of movement truth instead of recalculating
 * a possibly different route after scoring.
 */
type ReachableTilePlan = { tile: BattleMapTile; cost: number; path: Position[] };

/**
 * Evaluates the combat state and returns the best action for the given AI character.
 *
 * The AI uses a "Score-based Utility" approach:
 * 1. It identifies all possible valid actions (abilities, movement).
 * 2. It generates a "Plan" for each possibility.
 * 3. It scores each plan based on heuristics (damage, healing, survival).
 * 4. It executes the plan with the highest score.
 *
 * The evaluator is intentionally greedy but aware of positioning: it will move into
 * range/LoS for a high-value cast, heal allies, or retreat when threatened.
 *
 * @param character - The AI character taking the turn.
 * @param characters - All characters in the combat (enemies and allies).
 * @param mapData - The current state of the battle map.
 * @returns The chosen CombatAction to execute.
 */
export function evaluateCombatTurn(
  character: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData
): CombatAction {
  // TODO #1307(FEATURES): Extend AI planning to cover allied party members (auto-battle companions) with player-configurable tactics (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).

  if (hasCommandSkipTurnDirective(character)) {
    // Halt and Grovel are magical control instructions, not tactical options.
    // Obey it before scoring attacks, movement, retreats, or support spells.
    logger.info(`[AI] ${character.name} is under a skip-turn Command directive and ends its turn.`);
    return createEndTurnAction(character);
  }
  
  // 1. Identify Potential Targets (Active vs. Downed)
  // DOWNED AWARENESS & TARGETING HEURISTICS
  // What changed: Explicit separation of active threats (HP > 0) and downed player characters (HP === 0 with deathSaves).
  // Why: Allows the AI to make intelligent tactical decisions, such as ally healers prioritizing downed targets
  //      to revive them, and enemy attackers prioritizing active players over downed targets.
  // What was preserved: Base target filtering and path planning structure.
  let activeEnemies = characters.filter(c => c.team !== character.team && c.currentHP > 0);
  let downedEnemies = characters.filter(c => c.team !== character.team && c.currentHP === 0 && c.deathSaves);
  if (isUncontrolledSummonGreaterDemon(character)) {
    // Summon Greater Demon stops using normal team allegiance after control
    // breaks. Reuse the existing attack/movement planner, but feed it the
    // spell-authored target set: nearest living non-demons.
    activeEnemies = characters.filter(c =>
      c.id !== character.id &&
      c.currentHP > 0 &&
      !isDemon(c)
    );
    downedEnemies = [];
  }
  const allEnemies = [...activeEnemies, ...downedEnemies];

  const activeAllies = characters.filter(c => c.team === character.team && c.currentHP > 0);
  const downedAllies = characters.filter(c => c.team === character.team && c.currentHP === 0 && c.deathSaves);
  const allAllies = [...activeAllies, ...downedAllies];

  logger.debug(`[AI] evaluating turn for ${character.name}`, {
    hp: `${character.currentHP}/${character.maxHP}`,
    activeEnemiesCount: activeEnemies.length,
    downedEnemiesCount: downedEnemies.length,
    activeAlliesCount: activeAllies.length,
    downedAlliesCount: downedAllies.length
  });

  if (activeEnemies.length === 0) {
    logger.debug(`[AI] No active enemies found. Ending turn.`);
    return createEndTurnAction(character);
  }

  // Pre-compute occupied spaces so movement plans do not move an AI creature
  // onto another living combatant. Unconscious downed player characters block movement
  // grid positions, which is handled correctly by including them in occupied tiles.
  const occupiedTileIds = buildOccupiedTileSet(characters, character.id);

  // Pre-compute reachability once so scoring can reuse it.
  const reachableTiles = buildReachableTileMap(character, mapData, occupiedTileIds);

  const commandApproachAction = planCommandApproachMovement(character, characters, reachableTiles);
  if (commandApproachAction) {
    // Command: Approach overrides ordinary tactical scoring. The creature
    // spends movement closing distance to the caster who issued the command.
    logger.info(`[AI] ${character.name} is under Command: Approach and moves toward the command caster.`);
    return commandApproachAction;
  }

  const commandFleeAction = planCommandFleeMovement(character, characters, reachableTiles);
  if (commandFleeAction) {
    // Command: Flee overrides ordinary tactical scoring. The creature spends
    // its turn moving away from the caster who issued the command.
    logger.info(`[AI] ${character.name} is under Command: Flee and moves away from the command caster.`);
    return commandFleeAction;
  }

  // Turn-scoped AoE geometry cache: keyed by (shape, size, centerX, centerY, castTileId).
  // Shared across all AoE ability evaluations this turn so tile computations for
  // overlapping areas are not repeated when multiple spells target the same center.
  const turnAoECache = new Map<string, Position[]>();
  // Turn-scoped cast-position cache: keyed by (abilityRange, centerX, centerY).
  // Avoids rerunning findCastPosition for abilities with identical range to the same center.
  const castPositionCache = new Map<string, BattleMapTile | null>();

  // 2. Evaluate Possible Actions
  const possiblePlans: AIPlan[] = [];

  // Consider all abilities with simple action-economy checks.
  for (const ability of character.abilities) {
    if (ability.currentCooldown && ability.currentCooldown > 0) continue;
    if (ability.isRecharging) continue;
    if (ability.maxUses !== undefined && (ability.usesRemaining ?? ability.maxUses) <= 0) continue;
    if (!canAffordIdeally(character, ability)) continue;

    // Identify targets based on ability type
    if (ability.targeting === 'self') {
      const score = evaluateSelfAbility(character, ability);
      possiblePlans.push({
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: character.position,
        targetCharacterIds: [character.id],
        score,
        description: `Use ${ability.name} on self`,
      });
    } else if (ability.targeting === 'single_enemy') {
      // Filter by creature-type constraint (e.g. Hold Person: Humanoid only)
      const validTargets = allEnemies.filter(enemy => matchesAbilityCreatureTypes(enemy, ability.validCreatureTypes));
      for (const target of validTargets) {
        const plan = evaluateAttackPlan(character, target, ability, mapData, reachableTiles, activeEnemies);
        if (plan) possiblePlans.push(plan);
      }
    } else if (ability.targeting === 'single_ally') {
      const validTargets = allAllies.filter(ally => matchesAbilityCreatureTypes(ally, ability.validCreatureTypes));
      for (const target of validTargets) {
        const plan = evaluateSupportPlan(character, target, ability, mapData, reachableTiles);
        if (plan) possiblePlans.push(plan);
      }
    } else if (ability.targeting === 'area' || resolveAreaDefinition(ability)) {
      const plan = evaluateAoEPlan(
        character,
        ability,
        activeEnemies,
        downedEnemies,
        activeAllies,
        downedAllies,
        mapData,
        reachableTiles,
        turnAoECache,
        castPositionCache
      );
      if (plan) possiblePlans.push(plan);
    }
  }

  // Evaluate pure repositioning for survival when low HP.
  const safeRetreat = evaluateRetreatPlan(character, activeEnemies, mapData, reachableTiles);
  if (safeRetreat) {
    possiblePlans.push(safeRetreat);
  }

  // Sort plans by score descending
  possiblePlans.sort((a, b) => b.score - a.score);

  // Log top plans
  if (possiblePlans.length > 0) {
    logger.debug(`[AI] Considered ${possiblePlans.length} plans. Top 3:`, {
      plans: possiblePlans.slice(0, 3).map(p => ({ desc: p.description, score: p.score }))
    });
  } else {
    logger.debug(`[AI] No viable plans found.`);
  }

  const bestPlan = possiblePlans[0];

  if (bestPlan && bestPlan.score > 0) {
    logger.info(`[AI] ${character.name} chose: ${bestPlan.description} (Score: ${bestPlan.score.toFixed(1)})`);

    // If the plan is an ability but we are currently out of range/LoS, perform the movement leg first.
    if (bestPlan.actionType === 'ability' && bestPlan.targetPosition) {
      const dist = getDistance(character.position, bestPlan.targetPosition);
      const ability = character.abilities.find(a => a.id === bestPlan.abilityId);
      const inRange = ability ? dist <= ability.range : true;
      if (ability && (!inRange || !hasClearShot(character.position, bestPlan.targetPosition, mapData))) {
        const moveAction = planMovement(character, bestPlan.targetPosition, ability.range, mapData, reachableTiles, occupiedTileIds);
        if (moveAction) {
          logger.debug(`[AI] Moving to position to execute plan.`, { target: moveAction.targetPosition });
          return moveAction;
        }
      }
    }

    return {
      id: generateId(),
      characterId: character.id,
      type: bestPlan.actionType,
      abilityId: bestPlan.abilityId,
      targetPosition: bestPlan.targetPosition,
      movementPath: bestPlan.movementPath,
      targetCharacterIds: bestPlan.targetCharacterIds,
      cost: bestPlan.actionType === 'move'
        ? { type: 'movement-only', movementCost: bestPlan.movementCost ?? 0 }
        : character.abilities.find(a => a.id === bestPlan.abilityId)?.cost || { type: 'free' }, // Fallback cost
      timestamp: Date.now(),
    };
  }

  // Fallback: Move towards nearest active enemy if no ability is useful
  const nearestEnemy = getNearestEnemy(character, activeEnemies);
  if (nearestEnemy) {
    const moveAction = planMovement(character, nearestEnemy.position, 1, mapData, reachableTiles, occupiedTileIds);
    if (moveAction) {
      logger.info(`[AI] No good abilities. Moving towards nearest active enemy.`);
      return moveAction;
    }
  }

  logger.info(`[AI] No valid actions or movement. Ending turn.`);
  return createEndTurnAction(character);
}

/**
 * Creates a generic 'end turn' action when no other actions are viable.
 */
function createEndTurnAction(character: CombatCharacter): CombatAction {
  return {
    id: generateId(),
    characterId: character.id,
    type: 'end_turn',
    cost: { type: 'free' },
    timestamp: Date.now(),
  };
}

function hasCommandSkipTurnDirective(character: CombatCharacter): boolean {
  // UtilityCommand records next-turn Command orders as one-round statuses with
  // readable names and a skip-turn effect. Checking both keeps the AI from
  // treating an unrelated future skip-turn status as this specific spell family.
  return character.statusEffects.some(status =>
    ['Command: Halt', 'Command: Grovel', 'Command: Drop'].includes(String(status.name)) &&
    status.effect?.type === 'skip_turn' &&
    status.duration > 0
  );
}

function isUncontrolledSummonGreaterDemon(character: CombatCharacter): boolean {
  const metadata = character.summonMetadata;
  return character.isSummon === true &&
    metadata?.spellId === 'summon-greater-demon' &&
    (
      metadata.control?.allegiance === 'uncontrolled_hostile' ||
      metadata.aftermathState?.kind === 'uncontrolled_demon_grace_period'
    );
}

function isDemon(character: CombatCharacter): boolean {
  return TargetValidationUtils.getCreatureTypes(character)
    .some(creatureType => creatureType.toLowerCase() === 'demon');
}

function planCommandFleeMovement(
  character: CombatCharacter,
  characters: CombatCharacter[],
  reachableTiles: Map<string, ReachableTilePlan>
): CombatAction | null {
  const fleeDirective = character.statusEffects.find(status =>
    status.name === 'Command: Flee' &&
    status.duration > 0 &&
    !!status.sourceCasterId
  );

  if (!fleeDirective?.sourceCasterId) {
    return null;
  }

  const commandCaster = characters.find(candidate => candidate.id === fleeDirective.sourceCasterId);
  if (!commandCaster) {
    return null;
  }

  // Choose the legal reachable tile farthest from the caster who issued
  // Command. This is intentionally caster-relative instead of nearest-enemy
  // retreat logic, because the spell says to flee from "you."
  const startDistance = getDistance(character.position, commandCaster.position);
  let bestPlan: ReachableTilePlan | null = null;
  let bestDistance = startDistance;

  reachableTiles.forEach(plan => {
    const distanceFromCaster = getDistance(plan.tile.coordinates, commandCaster.position);
    if (distanceFromCaster > bestDistance) {
      bestDistance = distanceFromCaster;
      bestPlan = plan;
    }
  });

  if (!bestPlan) {
    // If there is no legal tile farther away, the directive still prevents a
    // normal attack. End the turn rather than silently ignoring the command.
    return createEndTurnAction(character);
  }

  return {
    id: generateId(),
    characterId: character.id,
    type: 'move',
    cost: { type: 'movement-only', movementCost: bestPlan.cost },
    targetPosition: bestPlan.tile.coordinates,
    movementPath: bestPlan.path,
    timestamp: Date.now(),
  };
}

function planCommandApproachMovement(
  character: CombatCharacter,
  characters: CombatCharacter[],
  reachableTiles: Map<string, ReachableTilePlan>
): CombatAction | null {
  const approachDirective = character.statusEffects.find(status =>
    status.name === 'Command: Approach' &&
    status.duration > 0 &&
    !!status.sourceCasterId
  );

  if (!approachDirective?.sourceCasterId) {
    return null;
  }

  const commandCaster = characters.find(candidate => candidate.id === approachDirective.sourceCasterId);
  if (!commandCaster) {
    return null;
  }

  // Command: Approach is caster-relative. Move to the legal reachable tile
  // nearest to that caster, but do not move if already within 5 feet.
  const startDistance = getDistance(character.position, commandCaster.position);
  if (startDistance <= 1) {
    return createEndTurnAction(character);
  }

  let bestPlan: ReachableTilePlan | null = null;
  let bestDistance = startDistance;

  reachableTiles.forEach(plan => {
    const distanceToCaster = getDistance(plan.tile.coordinates, commandCaster.position);
    if (distanceToCaster < bestDistance && distanceToCaster >= 1) {
      bestDistance = distanceToCaster;
      bestPlan = plan;
    }
  });

  if (!bestPlan) {
    return createEndTurnAction(character);
  }

  return {
    id: generateId(),
    characterId: character.id,
    type: 'move',
    cost: { type: 'movement-only', movementCost: bestPlan.cost },
    targetPosition: bestPlan.tile.coordinates,
    movementPath: bestPlan.path,
    timestamp: Date.now(),
  };
}

/**
 * Checks if a character can afford an ability based on available action economy.
 * This is a "soft" check for planning purposes.
 *
 * @param character - The character attempting the action.
 * @param ability - The ability to check.
 * @returns True if the character has the required action type available.
 */
function canAffordIdeally(character: CombatCharacter, ability: Ability): boolean {
  const cost = ability.cost;
  const eco = character.actionEconomy;

  // Check Action Type availability
  if (cost.type === 'action' && eco.action.used) return false;
  if (cost.type === 'bonus' && eco.bonusAction.used) return false;
  if (cost.type === 'reaction' && eco.reaction.used) return false;
  if (cost.type === 'legendary') {
    return (eco.legendary.total - eco.legendary.used) >= (cost.quantity || 1);
  }
  if (cost.type === 'movement-only' && eco.movement.used >= eco.movement.total) return false;

  return true;
}

/**
 * Evaluates the utility of casting a self-targeting ability (buffs, self-heals).
 *
 * Heuristics:
 * - Healing is valuable only when damaged (efficiency).
 * - Self-preservation (healing when critical) is heavily weighted.
 * - Buffs are generally considered good to maintain.
 */
function evaluateSelfAbility(caster: CombatCharacter, ability: Ability): number {
  let score = 0;
  // Heuristic: If low health and ability heals
  const isHeal = ability.effects.some(e => e.type === 'heal');
  if (isHeal) {
    const missingHP = caster.maxHP - caster.currentHP;
    const healAmount = ability.effects.find(e => e.type === 'heal')?.value || 0;
    // Only heal if we are missing health, score based on efficiency
    if (missingHP > 0) {
      score += Math.min(missingHP, healAmount) * WEIGHTS.HEAL;
      // Bonus if critical health
      if (caster.currentHP < caster.maxHP * 0.3) score += 30;
    }
  }
  // Heuristic: Buffs
  const isBuff = ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  if (isBuff) {
    score += 12; // Base value for buffs
  }
  return score;
}

/**
 * Generates a plan to attack a single enemy.
 *
 * Considers:
 * - Damage output vs target HP.
 * - Kill potential (removing a threat).
 * - Focus Fire (prioritizing damaged enemies).
 * - Movement cost (penalty for having to move).
 *
 * If the target is out of range, it attempts to find a valid move-and-cast position.
 */
function evaluateAttackPlan(
  caster: CombatCharacter,
  target: CombatCharacter,
  ability: Ability,
  mapData: BattleMapData,
  reachableTiles: Map<string, ReachableTilePlan>,
  activeEnemies: CombatCharacter[]
): AIPlan | null {
  const dist = getDistance(caster.position, target.position);

  // Check if reachable within move + range
  const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
  if (dist > ability.range + moveRange) return null; // Too far

  let score = 0;

  // Damage potential
  const damageEffect = ability.effects.find(e => e.type === 'damage');
  if (damageEffect) {
    const damage = damageEffect.value || 0;
    score += damage * WEIGHTS.DAMAGE;

    // Kill potential
    if (target.currentHP <= damage && target.currentHP > 0) {
      score += WEIGHTS.KILL_TARGET;
    }

    // Focus fire bonus (lower HP % is better target)
    if (target.currentHP > 0) {
      score += (1 - target.currentHP / target.maxHP) * WEIGHTS.FOCUS_FIRE_BONUS;
    }
  }

  // Downed Target check: Prioritize active threats
  // What changed: Downed targets are heavily penalized when active threats are present.
  // Why: Enemies should not waste basic attacks executing unconscious player characters
  //      when active threats are still fighting them.
  if (target.currentHP === 0 && target.deathSaves) {
    if (activeEnemies.length > 0) {
      score -= 150; // Heavily penalize attacking downed targets while active threats exist
    } else {
      score += 10; // Moderate value to finish them off if no active enemies remain
    }
  }

  // Distance bonus when already in range (saves actions)
  score += (ability.range - dist) * 0.1;

  const inRange = dist <= ability.range && hasClearShot(caster.position, target.position, mapData);

  if (inRange) {
    return {
      actionType: 'ability',
      abilityId: ability.id,
      targetPosition: target.position,
      targetCharacterIds: [target.id],
      score,
      description: target.currentHP === 0 ? `Execute downed ${target.name} with ${ability.name}` : `Attack ${target.name} with ${ability.name}`,
    };
  }

  // If out of range, look for a reachable tile that puts us in range + LoS.
  const moveTile = findCastPosition(reachableTiles, target.position, ability, mapData);
  if (moveTile) {
    const movePlan = reachableTiles.get(moveTile.id);
    return {
      actionType: 'move',
      targetPosition: moveTile.coordinates,
      movementPath: movePlan?.path,
      movementCost: movePlan?.cost ?? moveTile.movementCost,
      score: score + WEIGHTS.DISTANCE_PENALTY * (movePlan?.cost ?? moveTile.movementCost),
      description: `Reposition to cast ${ability.name} on ${target.name}`,
    };
  }

  return null;
}

/**
 * Generates a plan to support (heal/buff) a single ally.
 *
 * Considers:
 * - Healing efficiency (not overheating).
 * - Critical rescue (bonus for saving low-HP allies).
 * - Buff utility.
 *
 * Similar to attack plans, it will search for a move-to-cast position if needed.
 */
function evaluateSupportPlan(
  caster: CombatCharacter,
  target: CombatCharacter,
  ability: Ability,
  mapData: BattleMapData,
  reachableTiles: Map<string, ReachableTilePlan>
): AIPlan | null {
  // Similar to attack but for heals/buffs on allies
  const dist = getDistance(caster.position, target.position);
  const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
  if (dist > ability.range + moveRange) return null;

  let score = 0;
  const isHeal = ability.effects.some(e => e.type === 'heal');
  if (isHeal) {
    const missingHP = target.maxHP - target.currentHP;
    const healAmount = ability.effects.find(e => e.type === 'heal')?.value || 0;

    // Reviving downed allies check
    // What changed: Downed allies at 0 HP get massive priority boost for healing spells.
    // Why: Keeping teammates alive and in the action economy is the highest priority for AI healers.
    if (target.currentHP === 0 && target.deathSaves) {
      score += 150; // Massively boost score for saving/reviving a downed ally
    } else if (missingHP > 0) {
      score += Math.min(missingHP, healAmount) * WEIGHTS.HEAL;
      if (target.currentHP < target.maxHP * 0.3) score += 25; // Save ally
    }
  }

  // Buffs keep allies safe/efficient
  const isBuff = ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  if (isBuff) {
    // Only buff active allies
    if (target.currentHP > 0) {
      score += 8;
    }
  }

  if (score <= 0) return null;

  const inRange = dist <= ability.range && hasClearShot(caster.position, target.position, mapData);
  if (inRange) {
    return {
      actionType: 'ability',
      abilityId: ability.id,
      targetPosition: target.position,
      targetCharacterIds: [target.id],
      score,
      description: target.currentHP === 0 ? `Revive downed ${target.name} with ${ability.name}` : `Heal/Buff ${target.name} with ${ability.name}`,
    };
  }

  const moveTile = findCastPosition(reachableTiles, target.position, ability, mapData);
  if (moveTile) {
    const movePlan = reachableTiles.get(moveTile.id);
    return {
      actionType: 'move',
      targetPosition: moveTile.coordinates,
      movementPath: movePlan?.path,
      movementCost: movePlan?.cost ?? moveTile.movementCost,
      score: score + WEIGHTS.DISTANCE_PENALTY * (movePlan?.cost ?? moveTile.movementCost),
      description: `Advance to support ${target.name} with ${ability.name}`,
    };
  }

  return null;
}

/**
 * Evaluates area-of-effect options by scanning likely centers (enemy clusters,
 * ally clumps for healing) and scoring the resulting hit list.
 *
 * The scoring rewards multi-target hits while strongly penalizing friendly fire
 * to keep the AI tactically sane.
 *
 * @param caster - The AI character.
 * @param ability - The AoE ability.
 * @param enemies - List of enemies.
 * @param allies - List of allies.
 * @param mapData - The battle map.
 * @param reachableTiles - Pre-computed reachable tiles for the caster.
 * @returns The best AoE plan found, or null.
 */
function evaluateAoEPlan(
  caster: CombatCharacter,
  ability: Ability,
  activeEnemies: CombatCharacter[],
  downedEnemies: CombatCharacter[],
  activeAllies: CombatCharacter[],
  downedAllies: CombatCharacter[],
  mapData: BattleMapData,
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>,
  /** Cross-ability tile cache: keyed by (shape, size, cx, cy, castTileId). Passed from decideTurn. */
  sharedAoECache?: Map<string, Position[]>,
  /** Cross-ability cast-position cache: keyed by (range, cx, cy). Passed from decideTurn. */
  sharedCastPosCache?: Map<string, BattleMapTile | null>
): AIPlan | null {
  const area = resolveAreaDefinition(ability);
  if (!area) return null;

  const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
  const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
  if (!startTile) return null;

  const allEnemies = [...activeEnemies, ...downedEnemies];
  const allAllies = [...activeAllies, ...downedAllies];

  // Candidate centers: enemy positions for offensive casts plus ally clusters for
  // supportive AoEs. We sample a 1-tile ring to let cones/lines slightly offset
  // while still catching groups. A small seen-set keeps the work bounded when
  // both enemies and allies occupy shared spaces.
  const candidateCenters: Position[] = [];
  const seen = new Set<string>();
  const addCandidate = (pos: Position) => {
    if (
      pos.x >= 0 &&
      pos.y >= 0 &&
      pos.x < mapData.dimensions.width &&
      pos.y < mapData.dimensions.height
    ) {
      const key = `${pos.x}-${pos.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidateCenters.push(pos);
      }
    }
  };

  allEnemies.forEach(enemy => {
    addCandidate(enemy.position);
    // Sample a ring around each enemy to catch partial overlaps with cones/lines.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        addCandidate({ x: enemy.position.x + dx, y: enemy.position.y + dy });
      }
    }
  });

  // When an AoE can heal, also seed around allies so we consider supportive casts
  // even in the absence of nearby hostiles (e.g., mid-combat regrouping).
  const canHeal = ability.effects.some(e => e.type === 'heal');
  if (canHeal) {
    allAllies.forEach(ally => {
      addCandidate(ally.position);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          addCandidate({ x: ally.position.x + dx, y: ally.position.y + dy });
        }
      }
    });
  }

  let bestPlan: AIPlan | null = null;
  // Use the shared cross-ability caches from evaluateCombatTurn when available;
  // fall back to local maps for standalone / test calls.
  const aoeCache: Map<string, Position[]> = sharedAoECache ?? new Map();
  const castPosCache: Map<string, BattleMapTile | null> = sharedCastPosCache ?? new Map();

  for (const center of candidateCenters) {
    // Ignore centers we cannot possibly reach within this turn when considering movement + cast range.
    if (getDistance(caster.position, center) > ability.range + moveRange) continue;

    // Cast-position cache: (range, cx, cy) → tile.
    // Abilities with the same range to the same center resolve identically.
    const castPosCacheKey = `${ability.range}:${center.x},${center.y}`;
    let castTile: BattleMapTile | null;
    if (castPosCache.has(castPosCacheKey)) {
      castTile = castPosCache.get(castPosCacheKey)!;
    } else {
      castTile =
        findCastPosition(reachableTiles, center, ability, mapData) ||
        (getDistance(startTile.coordinates, center) <= ability.range &&
        hasClearShot(startTile.coordinates, center, mapData)
          ? startTile
          : null);
      castPosCache.set(castPosCacheKey, castTile);
    }

    if (!castTile) continue;

    // AoE tile cache: keyed by geometry (shape, size, center, castTile) rather than
    // ability.id so that two abilities with identical footprints share the result.
    const cacheKey = `${area.shape}:${area.size}:${center.x},${center.y}:${castTile.id}`;
    let aoeTiles = aoeCache.get(cacheKey);
    if (!aoeTiles) {
      aoeTiles = computeAoETiles(area, center, mapData, castTile.coordinates);
      aoeCache.set(cacheKey, aoeTiles);
    }
    const impactedActiveEnemies = activeEnemies.filter(e => {
      const occupied = getOccupiedTiles(e);
      return aoeTiles.some(tile => 
        occupied.some(ot => ot.x === tile.x && ot.y === tile.y)
      );
    });
    const impactedDownedEnemies = downedEnemies.filter(e => {
      const occupied = getOccupiedTiles(e);
      return aoeTiles.some(tile => 
        occupied.some(ot => ot.x === tile.x && ot.y === tile.y)
      );
    });
    const impactedActiveAllies = activeAllies.filter(a => {
      const occupied = getOccupiedTiles(a);
      return aoeTiles.some(tile => 
        occupied.some(ot => ot.x === tile.x && ot.y === tile.y)
      );
    });
    const impactedDownedAllies = downedAllies.filter(a => {
      const occupied = getOccupiedTiles(a);
      return aoeTiles.some(tile => 
        occupied.some(ot => ot.x === tile.x && ot.y === tile.y)
      );
    });

    const healEffect = ability.effects.find(e => e.type === 'heal');
    const damageEffect = ability.effects.find(e => e.type === 'damage');

    // For healing spells, we must only consider allies. For pure damage, only enemies.
    // Mixed spells will consider both but need careful target selection.
    const healableActiveAllies = healEffect ? impactedActiveAllies.filter(ally => ally.currentHP < ally.maxHP) : [];
    const healableDownedAllies = healEffect ? impactedDownedAllies : []; // All downed allies can be healed/revived

    // If it's a pure healing spell, it must have healable allies/downed allies.
    if (healEffect && !damageEffect && healableActiveAllies.length === 0 && healableDownedAllies.length === 0) continue;
    // If it's a pure damage spell, it must have active enemies.
    if (damageEffect && !healEffect && impactedActiveEnemies.length === 0) continue;
    // If it's a mixed spell, it must have at least one valid target.
    if (damageEffect && healEffect && impactedActiveEnemies.length === 0 && healableActiveAllies.length === 0 && healableDownedAllies.length === 0) continue;

    let score = 0;

    if (damageEffect) {
      const dmgValue = damageEffect.value || 0;
      impactedActiveEnemies.forEach(enemy => {
        score += dmgValue * WEIGHTS.DAMAGE;
        if (enemy.currentHP <= dmgValue) score += WEIGHTS.KILL_TARGET;
        score += (1 - enemy.currentHP / enemy.maxHP) * WEIGHTS.FOCUS_FIRE_BONUS;
      });

      // Downed enemies hit adds minimal value if active threats exist
      impactedDownedEnemies.forEach(enemy => {
        if (activeEnemies.length > 0) {
          score += dmgValue * WEIGHTS.DAMAGE * 0.1;
        } else {
          score += dmgValue * WEIGHTS.DAMAGE;
        }
      });

      if (impactedActiveEnemies.length > 1) {
        score += (impactedActiveEnemies.length - 1) * WEIGHTS.AOE_MULTI_TARGET;
      }

      // Penalize friendly fire ONLY IF the ability does damage.
      score += impactedActiveAllies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY;
      score += impactedDownedAllies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY * 2.0; // Double penalty for hitting dying allies
    }

    if (healEffect) {
      const healValue = healEffect.value || 0;
      healableActiveAllies.forEach(ally => {
        const missing = ally.maxHP - ally.currentHP;
        score += Math.min(missing, healValue) * WEIGHTS.HEAL;
        if (ally.currentHP < ally.maxHP * 0.35) score += WEIGHTS.SELF_PRESERVATION;
      });

      // Massively boost score for healing downed allies (reviving them)
      healableDownedAllies.forEach(ally => {
        score += 150;
      });

      const totalHealed = healableActiveAllies.length + healableDownedAllies.length;
      if (totalHealed > 1) {
        score += (totalHealed - 1) * (WEIGHTS.AOE_MULTI_TARGET / 2);
      }

      // Add a penalty for healing enemies if the spell has a healing component.
      const healedActiveEnemies = impactedActiveEnemies.filter(e => e.currentHP < e.maxHP);
      const healedDownedEnemies = impactedDownedEnemies;
      const totalHealedEnemies = healedActiveEnemies.length + healedDownedEnemies.length;
      score += totalHealedEnemies * WEIGHTS.FRIENDLY_FIRE_PENALTY * 1.5;
    }

    // Prefer keeping some standoff distance when setting up the cast.
    const closestEnemy = getNearestEnemy({ ...caster, position: castTile.coordinates }, activeEnemies);
    if (closestEnemy) {
      const spacing = getDistance(castTile.coordinates, closestEnemy.position);
      score += spacing * WEIGHTS.POSITIONING_BONUS;
    }

    // Movement tax keeps far repositioning from eclipsing immediate casts.
    const movementCost = reachableTiles.get(castTile.id)?.cost || 0;
    score += WEIGHTS.DISTANCE_PENALTY * movementCost;

    if (!bestPlan || score > bestPlan.score) {
      const activeEnemiesCount = impactedActiveEnemies.length;
      const activeAlliesCount = healEffect ? healableActiveAllies.length : impactedActiveAllies.length;
      const downedAlliesCount = healEffect ? healableDownedAllies.length : impactedDownedAllies.length;

      bestPlan = {
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: center,
        targetCharacterIds: [
          ...impactedActiveEnemies.map(e => e.id),
          ...impactedDownedEnemies.map(e => e.id),
          ...healableActiveAllies.map(a => a.id),
          ...healableDownedAllies.map(a => a.id)
        ],
        score,
        description: `Cast ${ability.name} to affect ${activeEnemiesCount} active enemies${
          activeAlliesCount ? ` and ${activeAlliesCount} active allies` : ''
        }${downedAlliesCount ? ` and ${downedAlliesCount} downed allies` : ''}`,
      };
    }
  }

  return bestPlan;
}

/**
 * Finds the nearest enemy character.
 * @param character - The reference character.
 * @param enemies - List of enemy characters.
 * @returns The nearest enemy or null if list is empty.
 */
function getNearestEnemy(character: CombatCharacter, enemies: CombatCharacter[]): CombatCharacter | null {
  let nearest: CombatCharacter | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    const dist = getCharacterDistance(character, enemy);
    if (dist < minDist) {
      minDist = dist;
      nearest = enemy;
    }
  }
  return nearest;
}

/**
 * Builds the set of map spaces already occupied by living combatants.
 * The moving creature is excluded so its own starting tile remains usable as
 * the root of the reachability search.
 */
function buildOccupiedTileSet(characters: CombatCharacter[], movingCharacterId: string): Set<string> {
  const occupied = new Set<string>();

  characters.forEach(character => {
    // DOWNED CHARACTER MAP OCCUPATION
    // What changed: Downed player characters (HP === 0 with deathSaves) now occupy grid tiles.
    // Why: Unconscious characters remain on the field and block movement grid coordinates in standard D&D rules.
    // What was preserved: Caster ID filtering and standard alive-character checks.
    if (character.id !== movingCharacterId && (character.currentHP > 0 || character.deathSaves)) {
      const tiles = getOccupiedTiles(character);
      tiles.forEach(tile => {
        occupied.add(`${tile.x}-${tile.y}`);
      });
    }
  });

  return occupied;
}

/**
 * Plans a movement action to get within a desired range of a target position.
 * It searches the `reachableTiles` for the tile that minimizes distance to the
 * target while respecting movement costs.
 *
 * @param character - The moving character.
 * @param targetPos - The destination to approach.
 * @param rangeNeeded - The desired maximum distance from the target (e.g., attack range).
 * @param mapData - The map data.
 * @param reachableTiles - (Optional) Pre-computed reachable tiles. If missing, it's computed.
 * @returns A CombatAction for movement, or null if no valid move exists.
 */
function planMovement(
  character: CombatCharacter,
  targetPos: Position,
  rangeNeeded: number,
  mapData: BattleMapData,
  reachableTiles?: Map<string, ReachableTilePlan>,
  occupiedTileIds: Set<string> = new Set()
): CombatAction | null {
  // We want to get within 'rangeNeeded' of 'targetPos'
  const startTile = mapData.tiles.get(`${character.position.x}-${character.position.y}`);
  if (!startTile) return null;

  // If already in range, don't move
  if (getDistance(character.position, targetPos) <= rangeNeeded) return null;

  const availableMovement = character.actionEconomy.movement.total - character.actionEconomy.movement.used;
  if (availableMovement <= 0) return null;

  const searchTiles = reachableTiles || buildReachableTileMap(character, mapData, occupiedTileIds);

  let bestTile: BattleMapTile | null = null;
  let minDistToTarget = Infinity;
  let bestCost = 0;
  let bestPath: Position[] | undefined;

  // Choose the reachable tile that gets us as close as possible to desired range while avoiding blockers.
  searchTiles.forEach(({ tile, cost, path }) => {
    const distToTarget = getDistance(tile.coordinates, targetPos);
    if (distToTarget < minDistToTarget) {
      minDistToTarget = distToTarget;
      bestTile = tile;
      bestCost = cost;
      bestPath = path;
    }
  });

  // If no reachable tile improves position, do not issue a move.
  if (!bestTile) {
    // No reachable improvement; stay put.
    return null;
  }

  // Previously used bestTile.id directly; cast once to avoid the never narrowing error.
  const targetTile = bestTile as BattleMapTile;
  if (targetTile.id !== startTile.id && !occupiedTileIds.has(targetTile.id)) {
    return {
      id: generateId(),
      characterId: character.id,
      type: 'move',
      cost: { type: 'movement-only', movementCost: bestCost },
      targetPosition: targetTile.coordinates,
      movementPath: bestPath,
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Builds a map of all reachable tiles and their cost using a BFS flood fill.
 * This is reused by many scoring functions to avoid redundant map scans.
 *
 * @param character - The character to calculate movement for.
 * @param mapData - The map data.
 * @returns A map of Tile ID -> { tile, cost }.
 */
function buildReachableTileMap(
  character: CombatCharacter,
  mapData: BattleMapData,
  occupiedTileIds: Set<string> = new Set()
): Map<string, ReachableTilePlan> {
  const reachable = new Map<string, ReachableTilePlan>();
  const startTile = mapData.tiles.get(`${character.position.x}-${character.position.y}`);
  if (!startTile) return reachable;

  const availableMovement = character.actionEconomy.movement.total - character.actionEconomy.movement.used;
  const queue: ReachableTilePlan[] = [{ tile: startTile, cost: 0, path: [startTile.coordinates] }];
  const visited = new Set<string>([startTile.id]);

  while (queue.length > 0) {
    const { tile, cost, path } = queue.shift()!;
    reachable.set(tile.id, { tile, cost, path });

    if (cost >= availableMovement) continue;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborId = `${tile.coordinates.x + dx}-${tile.coordinates.y + dy}`;
        const neighbor = mapData.tiles.get(neighborId);
        const isOccupied = occupiedTileIds.has(neighborId);
        if (neighbor && !neighbor.blocksMovement && !visited.has(neighborId) && !isOccupied) {
          const newCost = cost + neighbor.movementCost;
          if (newCost <= availableMovement) {
            visited.add(neighborId);
            queue.push({ tile: neighbor, cost: newCost, path: [...path, neighbor.coordinates] });
          }
        }
      }
    }
  }

  return reachable;
}

/**
 * Finds a reachable tile from which an ability can be cast at the target position.
 * The search prioritizes minimal movement and valid line of sight.
 *
 * @param reachableTiles - The set of tiles the caster can move to.
 * @param targetPos - The position of the target.
 * @param ability - The ability to cast.
 * @param mapData - The map data (for LoS checks).
 * @returns The best tile to cast from, or null if none found.
 */
function findCastPosition(
  reachableTiles: Map<string, ReachableTilePlan>,
  targetPos: Position,
  ability: Ability,
  mapData: BattleMapData
): BattleMapTile | null {
  let bestTile: BattleMapTile | null = null;
  let bestCost = Infinity;

  reachableTiles.forEach(({ tile, cost }) => {
    const distance = getDistance(tile.coordinates, targetPos);
    const targetTile = mapData.tiles.get(`${targetPos.x}-${targetPos.y}`);
    const hasLos = targetTile ? hasLineOfSight(tile, targetTile, mapData) : false;
    if (distance <= ability.range && hasLos) {
      if (cost < bestCost) {
        bestCost = cost;
        bestTile = tile;
      }
    }
  });

  return bestTile;
}

/**
 * Returns true if the straight line between origin and target is unobstructed.
 * This reuses the tile-aware line of sight helper for clarity.
 *
 * @param origin - The starting position.
 * @param target - The target position.
 * @param mapData - The map data.
 * @returns True if line of sight exists.
 */
function hasClearShot(origin: Position, target: Position, mapData: BattleMapData): boolean {
  const startTile = mapData.tiles.get(`${origin.x}-${origin.y}`);
  const targetTile = mapData.tiles.get(`${target.x}-${target.y}`);
  if (!startTile || !targetTile) return false;
  return hasLineOfSight(startTile, targetTile, mapData);
}

/**
 * When low on HP, try to step away from the closest threat while staying within movement.
 * This logic identifies the safest tile in movement range that maximizes distance
 * from the nearest enemy.
 *
 * @param caster - The retreating character.
 * @param enemies - List of enemies.
 * @param mapData - The map data.
 * @param reachableTiles - Reachable tiles map.
 * @returns A movement plan (AIPlan) or null if no safer spot is found.
 */
function evaluateRetreatPlan(
  caster: CombatCharacter,
  enemies: CombatCharacter[],
  mapData: BattleMapData,
  reachableTiles: Map<string, ReachableTilePlan>
): AIPlan | null {
  const healthPct = caster.currentHP / caster.maxHP;
  if (healthPct > 0.35) return null; // Only retreat when actually threatened.

  const closestEnemy = getNearestEnemy(caster, enemies);
  if (!closestEnemy) return null;

  let safestTile: BattleMapTile | null = null;
  let bestScore = -Infinity;

  let safestPlan: ReachableTilePlan | undefined;
  reachableTiles.forEach((plan) => {
    const { tile } = plan;
    const distance = getDistance(tile.coordinates, closestEnemy.position);
    const safetyScore = distance * WEIGHTS.SAFETY_DISTANCE;
    if (safetyScore > bestScore) {
      bestScore = safetyScore;
      safestTile = tile;
      safestPlan = plan;
    }
  });

  if (safestTile && bestScore > 0) {
    const retreatTile = safestTile as BattleMapTile;
    return {
      actionType: 'move',
      targetPosition: retreatTile.coordinates,
      movementPath: safestPlan?.path,
      movementCost: safestPlan?.cost,
      score: bestScore + WEIGHTS.SELF_PRESERVATION,
      description: `Retreat to safety from ${closestEnemy.name}`,
    };
  }

  return null;
}
