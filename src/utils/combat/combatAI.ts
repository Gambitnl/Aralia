
import { CombatCharacter, CombatAction, BattleMapData, Ability, Position, BattleMapTile } from '../../types/combat';
import { getDistance, generateId } from '../../utils/combatUtils';
import { hasLineOfSight } from '../../utils/lineOfSight';

// Scoring weights for decision making
const WEIGHTS = {
  KILL_TARGET: 100,
  DAMAGE: 1,
  HEAL: 1.5, // Healing is prioritized slightly over damage
  SELF_PRESERVATION: 2,
  DISTANCE_PENALTY: -0.1, // Slight penalty for moving far
  FOCUS_FIRE_BONUS: 5, // Bonus for attacking a target already damaged
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
 * @param character The AI character taking the turn.
 * @param characters All combat characters on the map.
 * @param mapData The current state of the battle map.
 * @returns A CombatAction object representing the chosen action.
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

  // 2. Evaluate Possible Actions
  const possiblePlans: AIPlan[] = [];

  // Consider all abilities
  for (const ability of character.abilities) {
    if (ability.currentCooldown && ability.currentCooldown > 0) continue;

    // Check cost (simplified check, real check should use canAfford)
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
            description: `Use ${ability.name} on self`
        });
    } else if (ability.targeting === 'single_enemy') {
        for (const target of enemies) {
            const plan = evaluateAttackPlan(character, target, ability, mapData);
            if (plan) possiblePlans.push(plan);
        }
    } else if (ability.targeting === 'single_ally') {
        for (const target of allies) {
             const plan = evaluateSupportPlan(character, target, ability, mapData);
             if (plan) possiblePlans.push(plan);
        }
    }
    // TODO: Add support for AoE targeting
  }

  // Sort plans by score descending
  possiblePlans.sort((a, b) => b.score - a.score);

  const bestPlan = possiblePlans[0];

  if (bestPlan && bestPlan.score > 0) {
      // If the plan involves movement to a target position that isn't the current position,
      // AND the action type is 'ability', we might need to move first.
      // However, the turn manager handles one action at a time.
      // The AI needs to decide: "Do I need to move to get in range?"

      // If the plan is an ability, check if we are in range.
      if (bestPlan.actionType === 'ability' && bestPlan.targetPosition) {
           const dist = getDistance(character.position, bestPlan.targetPosition);
           const ability = character.abilities.find(a => a.id === bestPlan.abilityId);
           if (ability && dist > ability.range) {
               // We need to move towards the target position
               // Find a tile closer to target within movement range
               const moveAction = planMovement(character, bestPlan.targetPosition, ability.range, mapData);
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
          timestamp: Date.now()
      };
  }

  // Fallback: Move towards nearest enemy if no ability is useful
  const nearestEnemy = getNearestEnemy(character, enemies);
  if (nearestEnemy) {
       const moveAction = planMovement(character, nearestEnemy.position, 1, mapData);
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
        timestamp: Date.now()
    };
}

function canAffordIdeally(character: CombatCharacter, ability: Ability): boolean {
    const cost = ability.cost;
    const eco = character.actionEconomy;

    // Check Action Type availability
    if (cost.type === 'action' && eco.action.used) return false;
    if (cost.type === 'bonus' && eco.bonusAction.used) return false;
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
            if (caster.currentHP < caster.maxHP * 0.3) score += 20;
        }
    }
    // Heuristic: Buffs
    const isBuff = ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
    if (isBuff) {
        score += 10; // Base value for buffs
    }
    return score;
}

function evaluateAttackPlan(caster: CombatCharacter, target: CombatCharacter, ability: Ability, mapData: BattleMapData): AIPlan | null {
    const dist = getDistance(caster.position, target.position);

    // Check if reachable within move + range
    const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
    if (dist > ability.range + moveRange) return null; // Too far

    // Line of Sight check (simplified: assumes if we can move into range, we can get LoS)
    // For a rigorous check, we'd simulate the move position and check LoS from there.

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

    // Distance penalty (prefer closer targets to save movement)
    score += (ability.range - dist) * 0.1;

    return {
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: target.position,
        targetCharacterIds: [target.id],
        score,
        description: `Attack ${target.name} with ${ability.name}`
    };
}

function evaluateSupportPlan(caster: CombatCharacter, target: CombatCharacter, ability: Ability, mapData: BattleMapData): AIPlan | null {
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
             if (target.currentHP < target.maxHP * 0.3) score += 20; // Save ally
         }
     }

     if (score <= 0) return null;

     return {
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: target.position,
        targetCharacterIds: [target.id],
        score,
        description: `Heal/Buff ${target.name} with ${ability.name}`
    };
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

function planMovement(character: CombatCharacter, targetPos: Position, rangeNeeded: number, mapData: BattleMapData): CombatAction | null {
    // A simplified pathfinding to move towards target
    // We want to get within 'rangeNeeded' of 'targetPos'

    // BFS to find reachable tiles
    const startTile = mapData.tiles.get(`${character.position.x}-${character.position.y}`);
    if (!startTile) return null;

    // If already in range, don't move
    if (getDistance(character.position, targetPos) <= rangeNeeded) return null;

    const availableMovement = character.actionEconomy.movement.total - character.actionEconomy.movement.used;
    if (availableMovement <= 0) return null;

    // Find best tile to move to: closest to targetPos, within availableMovement
    let bestTile: BattleMapTile | null = null;
    let minDistToTarget = Infinity;

    // Simple exhaustive search of reachable area (BFS)
    const queue: { tile: BattleMapTile; cost: number }[] = [{ tile: startTile, cost: 0 }];
    const visited = new Set<string>([startTile.id]);

    while (queue.length > 0) {
        const { tile, cost } = queue.shift()!;

        const distToTarget = getDistance(tile.coordinates, targetPos);

        // If this tile is valid end spot (within range of target)
        // Or just closer than what we have found so far
        if (distToTarget < minDistToTarget) {
            minDistToTarget = distToTarget;
            bestTile = tile;
        }

        // Explore neighbors
        if (cost < availableMovement) {
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
    }

    if (bestTile && bestTile.id !== startTile.id) {
         return {
            id: generateId(),
            characterId: character.id,
            type: 'move',
            cost: { type: 'movement-only', movementCost: availableMovement }, // Simplify cost calc for now
            targetPosition: bestTile.coordinates,
            timestamp: Date.now()
        };
    }

    return null;
}
