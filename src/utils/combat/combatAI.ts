/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file combatAI.ts
 */
import { CombatCharacter, CombatAction, BattleMapData, Ability, Position, BattleMapTile } from '../../types/combat';
import { computeAoETiles, getDistance, generateId, resolveAreaDefinition } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';

// Scoring weights used throughout the planner. Tweakable knobs to steer priorities.
const WEIGHTS = {
  KILL_TARGET: 120,
  DAMAGE: 1,
  HEAL: 1.6, // Healing is prioritized slightly over damage
  SELF_PRESERVATION: 4,
  DISTANCE_PENALTY: -0.1, // Slight penalty for moving far
  FOCUS_FIRE_BONUS: 6, // Bonus for attacking a target already damaged
  SAFETY_DISTANCE: 0.4, // Reward for keeping distance when low HP
  AOE_MULTI_TARGET: 14, // Encourage clustering hits
  FRIENDLY_FIRE_PENALTY: -35, // Strongly avoid clipping allies
  POSITIONING_BONUS: 0.6, // Small reward for holding distance while casting
};

interface AIPlan {
  actionType: 'move' | 'ability' | 'end_turn';
  abilityId?: string;
  targetPosition?: Position;
  targetCharacterIds?: string[];
  score: number;
  description: string;
}

/**
 * Evaluates the combat state and returns the best action for the given AI character.
 * The evaluator is intentionally greedy but aware of positioning: it will move into
 * range/LoS for a high-value cast, heal allies, or retreat when threatened.
 */
export function evaluateCombatTurn(
  character: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData
): CombatAction {
  // 1. Identify Potential Targets
  const enemies = characters.filter(c => c.team !== character.team && c.currentHP > 0);
  const allies = characters.filter(c => c.team === character.team && c.currentHP > 0);

  if (enemies.length === 0) {
    return createEndTurnAction(character);
  }

  // Pre-compute reachability once so scoring can reuse it.
  const reachableTiles = buildReachableTileMap(character, mapData);

  // 2. Evaluate Possible Actions
  const possiblePlans: AIPlan[] = [];

  // Consider all abilities with simple action-economy checks.
  for (const ability of character.abilities) {
    if (ability.currentCooldown && ability.currentCooldown > 0) continue;
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
      for (const target of enemies) {
        const plan = evaluateAttackPlan(character, target, ability, mapData, reachableTiles);
        if (plan) possiblePlans.push(plan);
      }
    } else if (ability.targeting === 'single_ally') {
      for (const target of allies) {
        const plan = evaluateSupportPlan(character, target, ability, mapData, reachableTiles);
        if (plan) possiblePlans.push(plan);
      }
    } else if (ability.targeting === 'area' || resolveAreaDefinition(ability)) {
      const plan = evaluateAoEPlan(character, ability, enemies, allies, mapData, reachableTiles);
      if (plan) possiblePlans.push(plan);
    }
  }

  // Evaluate pure repositioning for survival when low HP.
  const safeRetreat = evaluateRetreatPlan(character, enemies, mapData, reachableTiles);
  if (safeRetreat) {
    possiblePlans.push(safeRetreat);
  }

  // Sort plans by score descending
  possiblePlans.sort((a, b) => b.score - a.score);
  const bestPlan = possiblePlans[0];

  if (bestPlan && bestPlan.score > 0) {
    // If the plan is an ability but we are currently out of range/LoS, perform the movement leg first.
    if (bestPlan.actionType === 'ability' && bestPlan.targetPosition) {
      const dist = getDistance(character.position, bestPlan.targetPosition);
      const ability = character.abilities.find(a => a.id === bestPlan.abilityId);
      const inRange = ability ? dist <= ability.range : true;
      if (ability && (!inRange || !hasClearShot(character.position, bestPlan.targetPosition, mapData))) {
        const moveAction = planMovement(character, bestPlan.targetPosition, ability.range, mapData, reachableTiles);
        if (moveAction) return moveAction;
      }
    }

    return {
      id: generateId(),
      characterId: character.id,
      type: bestPlan.actionType,
      abilityId: bestPlan.abilityId,
      targetPosition: bestPlan.targetPosition,
      targetCharacterIds: bestPlan.targetCharacterIds,
      cost: character.abilities.find(a => a.id === bestPlan.abilityId)?.cost || { type: 'free' }, // Fallback cost
      timestamp: Date.now(),
    };
  }

  // Fallback: Move towards nearest enemy if no ability is useful
  const nearestEnemy = getNearestEnemy(character, enemies);
  if (nearestEnemy) {
    const moveAction = planMovement(character, nearestEnemy.position, 1, mapData, reachableTiles);
    if (moveAction) return moveAction;
  }

  return createEndTurnAction(character);
}

function createEndTurnAction(character: CombatCharacter): CombatAction {
  return {
    id: generateId(),
    characterId: character.id,
    type: 'end_turn',
    cost: { type: 'free' },
    timestamp: Date.now(),
  };
}

function canAffordIdeally(character: CombatCharacter, ability: Ability): boolean {
  const cost = ability.cost;
  const eco = character.actionEconomy;

  // Check Action Type availability
  if (cost.type === 'action' && eco.action.used) return false;
  if (cost.type === 'bonus' && eco.bonusAction.used) return false;
  if (cost.type === 'movement-only' && eco.movement.used >= eco.movement.total) return false;
  // ... other checks
  return true;
}

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

function evaluateAttackPlan(
  caster: CombatCharacter,
  target: CombatCharacter,
  ability: Ability,
  mapData: BattleMapData,
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>
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
    if (target.currentHP <= damage) {
      score += WEIGHTS.KILL_TARGET;
    }

    // Focus fire bonus (lower HP % is better target)
    score += (1 - target.currentHP / target.maxHP) * WEIGHTS.FOCUS_FIRE_BONUS;
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
      description: `Attack ${target.name} with ${ability.name}`,
    };
  }

  // If out of range, look for a reachable tile that puts us in range + LoS.
  const moveTile = findCastPosition(reachableTiles, target.position, ability, mapData);
  if (moveTile) {
    return {
      actionType: 'move',
      targetPosition: moveTile.coordinates,
      score: score + WEIGHTS.DISTANCE_PENALTY * moveTile.movementCost,
      description: `Reposition to cast ${ability.name} on ${target.name}`,
    };
  }

  return null;
}

function evaluateSupportPlan(
  caster: CombatCharacter,
  target: CombatCharacter,
  ability: Ability,
  mapData: BattleMapData,
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>
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
    if (missingHP > 0) {
      score += Math.min(missingHP, healAmount) * WEIGHTS.HEAL;
      if (target.currentHP < target.maxHP * 0.3) score += 25; // Save ally
    }
  }

  // Buffs keep allies safe/efficient
  const isBuff = ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  if (isBuff) {
    score += 8;
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
      description: `Heal/Buff ${target.name} with ${ability.name}`,
    };
  }

  const moveTile = findCastPosition(reachableTiles, target.position, ability, mapData);
  if (moveTile) {
    return {
      actionType: 'move',
      targetPosition: moveTile.coordinates,
      score: score + WEIGHTS.DISTANCE_PENALTY * moveTile.movementCost,
      description: `Advance to support ${target.name} with ${ability.name}`,
    };
  }

  return null;
}

/**
 * Evaluates area-of-effect options by scanning likely centers (enemy clusters,
 * ally clumps for healing) and scoring the resulting hit list. The scoring
 * intentionally rewards multi-target hits while strongly penalizing friendly fire
 * to keep the AI tactically sane.
 */
function evaluateAoEPlan(
  caster: CombatCharacter,
  ability: Ability,
  enemies: CombatCharacter[],
  allies: CombatCharacter[],
  mapData: BattleMapData,
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>
): AIPlan | null {
  const area = resolveAreaDefinition(ability);
  if (!area) return null;

  const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
  const startTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
  if (!startTile) return null;

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

  enemies.forEach(enemy => {
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
    allies.forEach(ally => {
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
  // Cache computed AoE tile sets to avoid redundant calculations for the same
  // ability cast from the same tile at the same center. The key combines ability,
  // target center, and the chosen cast position.
  const aoeCache = new Map<string, Position[]>();

  for (const center of candidateCenters) {
    // Ignore centers we cannot possibly reach within this turn when considering movement + cast range.
    if (getDistance(caster.position, center) > ability.range + moveRange) continue;

    // Find an actual tile we can cast from that respects LoS. If none is reachable,
    // fall back to the current tile only when it is legitimately in range and has
    // line of sight. This prevents us from "planning" casts we cannot execute,
    // which previously happened when pathing failed but the start tile was far
    // outside the ability's range.
    const castTile =
      findCastPosition(reachableTiles, center, ability, mapData) ||
      (getDistance(startTile.coordinates, center) <= ability.range &&
      hasClearShot(startTile.coordinates, center, mapData)
        ? startTile
        : null);

    if (!castTile) continue;

    const cacheKey = `${ability.id}:${center.x},${center.y}:${castTile.id}`;
    let aoeTiles = aoeCache.get(cacheKey);
    if (!aoeTiles) {
      aoeTiles = computeAoETiles(area, center, mapData, castTile.coordinates);
      aoeCache.set(cacheKey, aoeTiles);
    }
    const impactedEnemies = enemies.filter(e =>
      aoeTiles.some(tile => tile.x === e.position.x && tile.y === e.position.y)
    );
    const impactedAllies = allies.filter(a =>
      aoeTiles.some(tile => tile.x === a.position.x && tile.y === a.position.y)
    );

    const healEffect = ability.effects.find(e => e.type === 'heal');
    const damageEffect = ability.effects.find(e => e.type === 'damage');

    // For healing spells, we must only consider allies. For pure damage, only enemies.
    // Mixed spells will consider both but need careful target selection.
    const healableAllies = healEffect ? impactedAllies.filter(ally => ally.currentHP < ally.maxHP) : [];

    // If it's a pure healing spell, it must have healable allies.
    if (healEffect && !damageEffect && healableAllies.length === 0) continue;
    // If it's a pure damage spell, it must have enemies.
    if (damageEffect && !healEffect && impactedEnemies.length === 0) continue;
    // If it's a mixed spell, it must have at least one valid target.
    if (damageEffect && healEffect && impactedEnemies.length === 0 && healableAllies.length === 0) continue;


    let score = 0;

    if (damageEffect) {
      const dmgValue = damageEffect.value || 0;
      impactedEnemies.forEach(enemy => {
        score += dmgValue * WEIGHTS.DAMAGE;
        if (enemy.currentHP <= dmgValue) score += WEIGHTS.KILL_TARGET;
        score += (1 - enemy.currentHP / enemy.maxHP) * WEIGHTS.FOCUS_FIRE_BONUS;
      });

      if (impactedEnemies.length > 1) {
        score += (impactedEnemies.length - 1) * WEIGHTS.AOE_MULTI_TARGET;
      }

      // Penalize friendly fire ONLY IF the ability does damage.
      score += impactedAllies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY;
    }

    if (healEffect) {
      const healValue = healEffect.value || 0;
      healableAllies.forEach(ally => {
        const missing = ally.maxHP - ally.currentHP;
        score += Math.min(missing, healValue) * WEIGHTS.HEAL;
        if (ally.currentHP < ally.maxHP * 0.35) score += WEIGHTS.SELF_PRESERVATION;
      });

      if (healableAllies.length > 1) {
        score += (healableAllies.length - 1) * (WEIGHTS.AOE_MULTI_TARGET / 2);
      }

      // NEW: Add a penalty for healing enemies if the spell has a healing component.
      // This prevents using an AoE heal offensively when enemies are in the blast zone.
      const healedEnemies = impactedEnemies.filter(e => e.currentHP < e.maxHP);
      score += healedEnemies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY * 1.5; // Make it even more punishing
    }

    // Prefer keeping some standoff distance when setting up the cast.
    const closestEnemy = getNearestEnemy({ ...caster, position: castTile.coordinates }, enemies);
    if (closestEnemy) {
      const spacing = getDistance(castTile.coordinates, closestEnemy.position);
      score += spacing * WEIGHTS.POSITIONING_BONUS;
    }

    // Movement tax keeps far repositioning from eclipsing immediate casts.
    const movementCost = reachableTiles.get(castTile.id)?.cost || 0;
    score += WEIGHTS.DISTANCE_PENALTY * movementCost;

    if (!bestPlan || score > bestPlan.score) {
      const allyCountForDescription = healEffect ? healableAllies.length : impactedAllies.length;

      bestPlan = {
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: center,
        // Only include allies who can benefit in the target list so downstream effects
        // (animations, logs) reflect the filtered heal targets.
        targetCharacterIds: [...impactedEnemies.map(e => e.id), ...healableAllies.map(a => a.id)],
        score,
        description: `Cast ${ability.name} to affect ${impactedEnemies.length} enemies${
          allyCountForDescription ? ` and ${allyCountForDescription} allies` : ''
        }`,
      };
    }
  }

  return bestPlan;
}

function getNearestEnemy(character: CombatCharacter, enemies: CombatCharacter[]): CombatCharacter | null {
  let nearest: CombatCharacter | null = null;
  let minDist = Infinity;

  for (const enemy of enemies) {
    const dist = getDistance(character.position, enemy.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = enemy;
    }
  }
  return nearest;
}

function planMovement(
  character: CombatCharacter,
  targetPos: Position,
  rangeNeeded: number,
  mapData: BattleMapData,
  reachableTiles?: Map<string, { tile: BattleMapTile; cost: number }>
): CombatAction | null {
  // We want to get within 'rangeNeeded' of 'targetPos'
  const startTile = mapData.tiles.get(`${character.position.x}-${character.position.y}`);
  if (!startTile) return null;

  // If already in range, don't move
  if (getDistance(character.position, targetPos) <= rangeNeeded) return null;

  const availableMovement = character.actionEconomy.movement.total - character.actionEconomy.movement.used;
  if (availableMovement <= 0) return null;

  const searchTiles = reachableTiles || buildReachableTileMap(character, mapData);

  let bestTile: BattleMapTile | null = null;
  let minDistToTarget = Infinity;
  let bestCost = 0;

  // Choose the reachable tile that gets us as close as possible to desired range while avoiding blockers.
  searchTiles.forEach(({ tile, cost }) => {
    const distToTarget = getDistance(tile.coordinates, targetPos);
    if (distToTarget < minDistToTarget) {
      minDistToTarget = distToTarget;
      bestTile = tile;
      bestCost = cost;
    }
  });

  if (bestTile && bestTile.id !== startTile.id) {
    return {
      id: generateId(),
      characterId: character.id,
      type: 'move',
      cost: { type: 'movement-only', movementCost: bestCost },
      targetPosition: bestTile.coordinates,
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Builds a map of all reachable tiles and their cost using a BFS flood fill.
 * This is reused by many scoring functions to avoid redundant map scans.
 */
function buildReachableTileMap(
  character: CombatCharacter,
  mapData: BattleMapData
): Map<string, { tile: BattleMapTile; cost: number }> {
  const reachable = new Map<string, { tile: BattleMapTile; cost: number }>();
  const startTile = mapData.tiles.get(`${character.position.x}-${character.position.y}`);
  if (!startTile) return reachable;

  const availableMovement = character.actionEconomy.movement.total - character.actionEconomy.movement.used;
  const queue: { tile: BattleMapTile; cost: number }[] = [{ tile: startTile, cost: 0 }];
  const visited = new Set<string>([startTile.id]);

  while (queue.length > 0) {
    const { tile, cost } = queue.shift()!;
    reachable.set(tile.id, { tile, cost });

    if (cost >= availableMovement) continue;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborId = `${tile.coordinates.x + dx}-${tile.coordinates.y + dy}`;
        const neighbor = mapData.tiles.get(neighborId);
        if (neighbor && !neighbor.blocksMovement && !visited.has(neighborId)) {
          const newCost = cost + neighbor.movementCost;
          if (newCost <= availableMovement) {
            visited.add(neighborId);
            queue.push({ tile: neighbor, cost: newCost });
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
 */
function findCastPosition(
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>,
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
 */
function hasClearShot(origin: Position, target: Position, mapData: BattleMapData): boolean {
  const startTile = mapData.tiles.get(`${origin.x}-${origin.y}`);
  const targetTile = mapData.tiles.get(`${target.x}-${target.y}`);
  if (!startTile || !targetTile) return false;
  return hasLineOfSight(startTile, targetTile, mapData);
}

/**
 * When low on HP, try to step away from the closest threat while staying within movement.
 */
function evaluateRetreatPlan(
  caster: CombatCharacter,
  enemies: CombatCharacter[],
  mapData: BattleMapData,
  reachableTiles: Map<string, { tile: BattleMapTile; cost: number }>
): AIPlan | null {
  const healthPct = caster.currentHP / caster.maxHP;
  if (healthPct > 0.35) return null; // Only retreat when actually threatened.

  const closestEnemy = getNearestEnemy(caster, enemies);
  if (!closestEnemy) return null;

  let safestTile: BattleMapTile | null = null;
  let bestScore = -Infinity;

  reachableTiles.forEach(({ tile }) => {
    const distance = getDistance(tile.coordinates, closestEnemy.position);
    const safetyScore = distance * WEIGHTS.SAFETY_DISTANCE;
    if (safetyScore > bestScore) {
      bestScore = safetyScore;
      safestTile = tile;
    }
  });

  if (safestTile && bestScore > 0) {
    return {
      actionType: 'move',
      targetPosition: safestTile.coordinates,
      score: bestScore + WEIGHTS.SELF_PRESERVATION,
      description: `Retreat to safety from ${closestEnemy.name}`,
    };
  }

  return null;
}
