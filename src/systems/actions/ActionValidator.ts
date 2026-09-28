// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 16:48:51
 * Dependents: systems/actions/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file validates whether a character can perform an action before executing it.
 *
 * In tabletop RPG combat, characters must satisfy multiple rules before taking an action:
 * they must have sufficient action economy (actions, bonus actions, reactions, movement),
 * the required spell slots or class resources (ki, sorcery points), be in a valid physical
 * state (not stunned, paralyzed, or silenced when speaking), and have a legal target within
 * range and line-of-sight. This validator acts as the single gatekeeper checking all these
 * rules before state changes occur.
 *
 * Called by: useGameActions, useAbilitySystem, and combat command executors.
 * Depends on: combat character types, line-of-sight spatial math, and action economy utilities.
 */

import {
  CombatCharacter,
  CombatState,
  BattleMapData,
  Position,
  AbilityCost,
  ActionCostType,
  StatusEffect,
  ActiveCondition,
  TargetableMapObject
} from '../../types/combat';
import { Spell, SpellComponents } from '../../types/spells';
import { hasLineOfSight } from '../../utils/spatial/lineOfSight';
import { getBattleMapTileAltitudeFeet, getCombatDistanceFeet } from '../../utils/spatial/elevationGeometry';

// ============================================================================
// Types & Validation Result Contracts
// ============================================================================
// These interfaces define the standard contract for action validation queries.
// Every check returns a boolean indicating legality, a stable error code for
// programmatic handling, and a human-friendly explanation for the UI or logs.
// ============================================================================

export type ActionValidationErrorCode =
  | 'INCAPACITATED'
  | 'CONDITION_BLOCKED'
  | 'SILENCED_VERBAL'
  | 'BLINDED_SIGHT_REQUIRED'
  | 'INSUFFICIENT_ACTION_RESOURCE'
  | 'INSUFFICIENT_SPELL_SLOTS'
  | 'INSUFFICIENT_KI'
  | 'INSUFFICIENT_SORCERY_POINTS'
  | 'INSUFFICIENT_LIMITED_USES'
  | 'INSUFFICIENT_MOVEMENT'
  | 'OUT_OF_RANGE'
  | 'NO_LINE_OF_SIGHT'
  | 'INVALID_TARGET_TYPE'
  | 'INVALID_TARGET_STATE'
  | 'UNKNOWN_ERROR';

export interface ActionValidationResult {
  /** True if the action is completely legal to perform. */
  isValid: boolean;
  /** Human-readable explanation when validation fails, suitable for display to players. */
  reason?: string;
  /** Categorized error code for UI logic or unit test assertions. */
  code?: ActionValidationErrorCode;
  /** Optional metadata about the failure (e.g. missing points, current distance). */
  details?: Record<string, unknown>;
}

export type TargetKind = 'self' | 'enemy' | 'ally' | 'point' | 'corpse' | 'object' | 'creature';

export interface ActionTargetPayload {
  kind: TargetKind;
  id?: string;
  character?: CombatCharacter;
  position?: Position;
  object?: TargetableMapObject;
  isEnemy?: boolean;
  team?: string;
  currentHP?: number;
}

export interface ActionResourceCost extends AbilityCost {
  kiCost?: number;
  sorceryPointsCost?: number;
  customResourceId?: string;
  customResourceCost?: number;
}

export interface ActionValidationRequest {
  actor: CombatCharacter;
  actionName?: string;
  actionCost?: ActionResourceCost;
  target?: ActionTargetPayload;
  range?: number | 'touch' | 'self';
  requiresLineOfSight?: boolean;
  requiresSight?: boolean;
  components?: SpellComponents;
  targetRequirement?: TargetKind | TargetKind[];
  mapData?: BattleMapData | null;
  state?: CombatState;
}

// Conditions that impose total incapacitation (cannot take any action, bonus action, or reaction)
const INCAPACITATING_CONDITIONS = new Set([
  'incapacitated',
  'stunned',
  'paralyzed',
  'unconscious',
  'petrified',
  'sleeping',
]);

// Conditions that reduce movement speed to zero
const ZERO_SPEED_CONDITIONS = new Set([
  'grappled',
  'paralyzed',
  'petrified',
  'restrained',
  'unconscious',
  'stunned',
]);

// ============================================================================
// Helper Utilities for Character State
// ============================================================================
// Internal inspection functions to cleanly extract active conditions,
// status effects, and custom class pools without repeated boilerplate.
// ============================================================================

// Collects all active condition names from both statusEffects and conditions arrays.
function getActiveConditionNames(character: CombatCharacter): Set<string> {
  const names = new Set<string>();

  // Check traditional statusEffects array
  if (Array.isArray(character.statusEffects)) {
    for (const status of character.statusEffects) {
      if (status?.name) {
        names.add(status.name.toLowerCase());
      }
    }
  }

  // Check new active conditions array
  if (Array.isArray(character.conditions)) {
    for (const cond of character.conditions) {
      if (typeof cond === 'string') {
        names.add(cond.toLowerCase());
      } else if (cond && typeof cond === 'object' && 'name' in cond && typeof (cond as ActiveCondition).name === 'string') {
        names.add((cond as ActiveCondition).name.toLowerCase());
      }
    }
  }

  return names;
}

// Determines if a character is incapacitated according to 5e rules.
function isCharacterIncapacitated(character: CombatCharacter): boolean {
  if (character.currentHP <= 0) {
    return true;
  }
  const conditions = getActiveConditionNames(character);
  for (const cond of INCAPACITATING_CONDITIONS) {
    if (conditions.has(cond)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Action Validator Core Engine
// ============================================================================
// The main validation class containing individual rule checkers and a
// unified composite validation pipeline.
// ============================================================================

export class ActionValidator {
  /**
   * Performs complete end-to-end validation of an action request.
   * Checks condition prerequisites, resource costs, target requirements,
   * range constraints, and line-of-sight in priority order.
   *
   * @param request - The full action request parameters.
   * @returns ActionValidationResult indicating whether the action is permitted.
   */
  static validate(request: ActionValidationRequest): ActionValidationResult {
    const {
      actor,
      actionName = 'Action',
      actionCost,
      target,
      range,
      requiresLineOfSight = true,
      requiresSight = false,
      components,
      targetRequirement,
      mapData = null
    } = request;

    // 1. Condition & State Prerequisites
    const conditionCheck = this.validateConditionPrerequisites(actor, {
      actionName,
      components,
      requiresSight,
      actionCost
    });
    if (!conditionCheck.isValid) {
      return conditionCheck;
    }

    // 2. Resource Costs (Action Economy, Spell Slots, Ki, Sorcery Points, Movement)
    if (actionCost) {
      const resourceCheck = this.validateResourceCosts(actor, actionCost);
      if (!resourceCheck.isValid) {
        return resourceCheck;
      }
    }

    // 3. Target Type Requirements
    if (target && targetRequirement) {
      const targetCheck = this.validateTargetType(actor, target, targetRequirement);
      if (!targetCheck.isValid) {
        return targetCheck;
      }
    }

    // 4. Range and Line of Sight Validation
    if (target && range !== undefined) {
      const targetPos = target.position || target.character?.position;
      if (targetPos) {
        const rangeCheck = this.validateRange(actor, targetPos, range);
        if (!rangeCheck.isValid) {
          return rangeCheck;
        }

        if (requiresLineOfSight && mapData && range !== 'self') {
          const losCheck = this.validateLineOfSight(actor.position, targetPos, mapData);
          if (!losCheck.isValid) {
            return losCheck;
          }
        }
      }
    }

    // If all checks passed, the action is completely legal to perform.
    return { isValid: true };
  }

  // ==========================================================================
  // Section: Condition & State Prerequisites
  // ==========================================================================
  // Checks if the actor's physical or mental state prevents performing actions.
  // Stunned, paralyzed, unconscious, silenced, or blinded states are evaluated.
  // ==========================================================================

  /**
   * Validates whether the character's active conditions permit taking the action.
   */
  static validateConditionPrerequisites(
    actor: CombatCharacter,
    actionContext: {
      actionName?: string;
      components?: SpellComponents;
      requiresSight?: boolean;
      actionCost?: ActionResourceCost;
    } = {}
  ): ActionValidationResult {
    const { actionName = 'Action', components, requiresSight = false, actionCost } = actionContext;
    const conditions = getActiveConditionNames(actor);

    // Downed / Dead check
    if (actor.currentHP <= 0) {
      return {
        isValid: false,
        code: 'INCAPACITATED',
        reason: `${actor.name} is incapacitated or unconscious with 0 HP and cannot act.`
      };
    }

    // General Incapacitation check (Stunned, Paralyzed, Unconscious, Petrified)
    if (isCharacterIncapacitated(actor)) {
      const matchingCondition = Array.from(conditions).find(c => INCAPACITATING_CONDITIONS.has(c)) || 'incapacitated';
      return {
        isValid: false,
        code: 'INCAPACITATED',
        reason: `${actor.name} is ${matchingCondition} and cannot take actions or reactions.`
      };
    }

    // Silence check: Verbal components cannot be spoken while silenced
    const isSilenced = conditions.has('silence') || conditions.has('silenced');
    if (isSilenced && components?.verbal) {
      return {
        isValid: false,
        code: 'SILENCED_VERBAL',
        reason: `${actor.name} is silenced and cannot cast spells requiring verbal components.`
      };
    }

    // Blindness check: If the action explicitly requires sight
    const isBlinded = conditions.has('blinded') || conditions.has('blind');
    if (isBlinded && requiresSight) {
      return {
        isValid: false,
        code: 'BLINDED_SIGHT_REQUIRED',
        reason: `${actor.name} is blinded and cannot target creatures or areas requiring visual sight.`
      };
    }

    // Movement-only check under immobilized conditions
    if (actionCost && (actionCost.type === 'movement-only' || (actionCost.movementCost ?? 0) > 0)) {
      const isImmobilized = Array.from(conditions).some(c => ZERO_SPEED_CONDITIONS.has(c));
      if (isImmobilized) {
        const blockingCondition = Array.from(conditions).find(c => ZERO_SPEED_CONDITIONS.has(c));
        return {
          isValid: false,
          code: 'CONDITION_BLOCKED',
          reason: `${actor.name} is ${blockingCondition} and cannot move.`
        };
      }
    }

    return { isValid: true };
  }

  // ==========================================================================
  // Section: Resource Cost Validation
  // ==========================================================================
  // Verifies that the character has the necessary action economy budget,
  // spell slots, movement distance, ki points, or sorcery points to pay costs.
  // ==========================================================================

  /**
   * Validates whether the character can afford all resource costs of an action.
   */
  static validateResourceCosts(actor: CombatCharacter, cost: ActionResourceCost): ActionValidationResult {
    const economy = actor.actionEconomy;

    // 1. Action Economy Check (Action, Bonus Action, Reaction, Legendary, Free)
    switch (cost.type) {
      case 'action': {
        const hasAction = !economy.action.used || (economy.action.remaining ?? 0) > 0;
        if (!hasAction) {
          return {
            isValid: false,
            code: 'INSUFFICIENT_ACTION_RESOURCE',
            reason: `${actor.name} has already expended their Action this turn.`
          };
        }
        break;
      }
      case 'bonus': {
        const hasBonus = !economy.bonusAction.used || (economy.bonusAction.remaining ?? 0) > 0;
        if (!hasBonus) {
          return {
            isValid: false,
            code: 'INSUFFICIENT_ACTION_RESOURCE',
            reason: `${actor.name} has already expended their Bonus Action this turn.`
          };
        }
        break;
      }
      case 'reaction': {
        const hasReaction = !economy.reaction.used || (economy.reaction.remaining ?? 0) > 0;
        if (!hasReaction) {
          return {
            isValid: false,
            code: 'INSUFFICIENT_ACTION_RESOURCE',
            reason: `${actor.name} has already expended their Reaction this round.`
          };
        }
        break;
      }
      case 'legendary': {
        const required = cost.quantity || 1;
        const available = (economy.legendary.total || 0) - (economy.legendary.used || 0);
        if (available < required) {
          return {
            isValid: false,
            code: 'INSUFFICIENT_ACTION_RESOURCE',
            reason: `${actor.name} needs ${required} legendary action(s), but only has ${available} remaining.`
          };
        }
        break;
      }
      case 'free': {
        if (economy.freeActions <= 0) {
          return {
            isValid: false,
            code: 'INSUFFICIENT_ACTION_RESOURCE',
            reason: `${actor.name} has no free object interactions or free actions remaining this turn.`
          };
        }
        break;
      }
      case 'movement-only':
      default:
        break;
    }

    // 2. Movement Distance Check
    if (cost.movementCost && cost.movementCost > 0) {
      const remainingMovement = economy.movement.total - economy.movement.used;
      if (remainingMovement < cost.movementCost) {
        return {
          isValid: false,
          code: 'INSUFFICIENT_MOVEMENT',
          reason: `${actor.name} requires ${cost.movementCost}ft of movement, but only has ${Math.max(0, remainingMovement)}ft remaining.`,
          details: { required: cost.movementCost, available: remainingMovement }
        };
      }
    }

    // 3. Spell Slot Check (with Dev Playtest bypass support)
    const hasUnlimitedSlots = Boolean((actor as unknown as { devPlaytest?: { unlimitedSpellSlots?: boolean } })?.devPlaytest?.unlimitedSpellSlots);
    if (!hasUnlimitedSlots && cost.spellSlotLevel && cost.spellSlotLevel > 0) {
      const slotKey = `level_${cost.spellSlotLevel}` as const;
      const slotData = actor.spellSlots?.[slotKey];
      if (!slotData || slotData.current <= 0) {
        return {
          isValid: false,
          code: 'INSUFFICIENT_SPELL_SLOTS',
          reason: `${actor.name} has no level ${cost.spellSlotLevel} spell slots remaining.`,
          details: { requestedLevel: cost.spellSlotLevel }
        };
      }
    }

    // 4. Ki Points Check (Monk discipline)
    if (cost.kiCost && cost.kiCost > 0) {
      const kiPool =
        actor.limitedUses?.['ki']?.current ??
        actor.limitedUses?.['monk_ki']?.current ??
        actor.limitedUses?.['discipline']?.current ??
        0;

      if (kiPool < cost.kiCost) {
        return {
          isValid: false,
          code: 'INSUFFICIENT_KI',
          reason: `${actor.name} requires ${cost.kiCost} Ki point(s), but only has ${kiPool} available.`,
          details: { required: cost.kiCost, available: kiPool }
        };
      }
    }

    // 5. Sorcery Points Check (Sorcerer metamagic/font of magic)
    if (cost.sorceryPointsCost && cost.sorceryPointsCost > 0) {
      const sorceryPool =
        actor.limitedUses?.['sorcery_points']?.current ??
        actor.limitedUses?.['sorceryPoints']?.current ??
        0;

      if (sorceryPool < cost.sorceryPointsCost) {
        return {
          isValid: false,
          code: 'INSUFFICIENT_SORCERY_POINTS',
          reason: `${actor.name} requires ${cost.sorceryPointsCost} Sorcery Point(s), but only has ${sorceryPool} available.`,
          details: { required: cost.sorceryPointsCost, available: sorceryPool }
        };
      }
    }

    // 6. Custom Limited Uses Check
    if (cost.customResourceId && cost.customResourceCost && cost.customResourceCost > 0) {
      const pool = actor.limitedUses?.[cost.customResourceId]?.current ?? 0;
      if (pool < cost.customResourceCost) {
        return {
          isValid: false,
          code: 'INSUFFICIENT_LIMITED_USES',
          reason: `${actor.name} has insufficient uses of ${cost.customResourceId} (${pool}/${cost.customResourceCost} needed).`,
          details: { resourceId: cost.customResourceId, required: cost.customResourceCost, available: pool }
        };
      }
    }

    return { isValid: true };
  }

  // ==========================================================================
  // Section: Target Type Requirements
  // ==========================================================================
  // Verifies that the selected target matches the ability's targeting rules
  // (e.g. self-only, hostile creature, ally, corpse, or interactive object).
  // ==========================================================================

  /**
   * Validates whether a target matches the requested target kind.
   */
  static validateTargetType(
    actor: CombatCharacter,
    target: ActionTargetPayload,
    requirement: TargetKind | TargetKind[]
  ): ActionValidationResult {
    const allowedKinds = Array.isArray(requirement) ? requirement : [requirement];

    // Check if target matches self
    if (allowedKinds.includes('self')) {
      const isSelf = target.kind === 'self' || target.id === actor.id || target.character?.id === actor.id;
      if (isSelf) return { isValid: true };
      if (allowedKinds.length === 1) {
        return {
          isValid: false,
          code: 'INVALID_TARGET_TYPE',
          reason: 'This action can only target yourself.'
        };
      }
    }

    // Check for corpse targeting
    if (allowedKinds.includes('corpse')) {
      const isCorpse = target.kind === 'corpse' || (target.character && target.character.currentHP <= 0);
      if (isCorpse) return { isValid: true };
    }

    // Check for map object targeting
    if (allowedKinds.includes('object')) {
      if (target.kind === 'object' || target.object) {
        return { isValid: true };
      }
    }

    // Check for ground point targeting
    if (allowedKinds.includes('point')) {
      if (target.kind === 'point' || target.position) {
        return { isValid: true };
      }
    }

    // Creature checks (enemy / ally / creature)
    const targetChar = target.character;
    if (targetChar) {
      // Living check: normal creature targeting requires target to be alive (>0 HP) unless corpse is allowed
      if (targetChar.currentHP <= 0 && !allowedKinds.includes('corpse')) {
        return {
          isValid: false,
          code: 'INVALID_TARGET_STATE',
          reason: `${targetChar.name} is dead or unconscious and cannot be targeted by this action.`
        };
      }

      const isHostile = target.isEnemy ?? (targetChar.team ? targetChar.team !== actor.team : targetChar.isEnemy !== actor.isEnemy);

      if (allowedKinds.includes('enemy') && isHostile) {
        return { isValid: true };
      }

      if (allowedKinds.includes('ally') && !isHostile) {
        return { isValid: true };
      }

      if (allowedKinds.includes('creature')) {
        return { isValid: true };
      }

      // If we got here, hostility mismatch
      if (allowedKinds.includes('enemy') && !isHostile) {
        return {
          isValid: false,
          code: 'INVALID_TARGET_TYPE',
          reason: `${targetChar.name} is an ally and cannot be targeted by a hostile action.`
        };
      }

      if (allowedKinds.includes('ally') && isHostile) {
        return {
          isValid: false,
          code: 'INVALID_TARGET_TYPE',
          reason: `${targetChar.name} is an enemy and cannot be targeted by an allied blessing or heal.`
        };
      }
    }

    // Generic fallback for mismatched kind
    if (!allowedKinds.includes(target.kind)) {
      return {
        isValid: false,
        code: 'INVALID_TARGET_TYPE',
        reason: `Target of type '${target.kind}' does not satisfy requirement: [${allowedKinds.join(', ')}].`
      };
    }

    return { isValid: true };
  }

  // ==========================================================================
  // Section: Range & Line-of-Sight Validation
  // ==========================================================================
  // Verifies physical proximity and clear line-of-sight between caster/actor
  // and the chosen target tile on the battle map.
  // ==========================================================================

  /**
   * Validates whether the target coordinate is within the permitted range.
   */
  static validateRange(
    actor: CombatCharacter,
    targetPosition: Position,
    maxRange: number | 'touch' | 'self'
  ): ActionValidationResult {
    const actorPos = actor.position;

    // Self-range check
    if (maxRange === 'self') {
      const isSamePos = actorPos.x === targetPosition.x && actorPos.y === targetPosition.y;
      if (!isSamePos) {
        return {
          isValid: false,
          code: 'OUT_OF_RANGE',
          reason: 'Self-range abilities can only be cast on the actor.'
        };
      }
      return { isValid: true };
    }

    // Distance calculation: 1 grid tile = 5 feet
    const tileDx = Math.abs(actorPos.x - targetPosition.x);
    const tileDy = Math.abs(actorPos.y - targetPosition.y);
    // Chebyshev distance (diagonal movement counts as 1 tile in standard 5e grid rules)
    const tileDistance = Math.max(tileDx, tileDy);
    const distanceFeet = tileDistance * 5;

    // Touch range check (adjacent tile: 1 tile / 5 feet max)
    if (maxRange === 'touch') {
      if (tileDistance > 1) {
        return {
          isValid: false,
          code: 'OUT_OF_RANGE',
          reason: `Target is out of reach (${distanceFeet}ft away). Touch spells require being adjacent (5ft).`,
          details: { distanceFeet, maxAllowedFeet: 5 }
        };
      }
      return { isValid: true };
    }

    // Numeric range in feet
    const maxFeet = maxRange;
    if (distanceFeet > maxFeet) {
      return {
        isValid: false,
        code: 'OUT_OF_RANGE',
        reason: `Target is ${distanceFeet}ft away, which exceeds the maximum range of ${maxFeet}ft.`,
        details: { distanceFeet, maxAllowedFeet: maxFeet }
      };
    }

    return { isValid: true };
  }

  /**
   * Validates whether there is an unobstructed line-of-sight between two positions on the battle map.
   */
  static validateLineOfSight(
    fromPosition: Position,
    toPosition: Position,
    mapData: BattleMapData
  ): ActionValidationResult {
    const fromKey = `${fromPosition.x}-${fromPosition.y}`;
    const toKey = `${toPosition.x}-${toPosition.y}`;

    const startTile = mapData.tiles.get(fromKey);
    const endTile = mapData.tiles.get(toKey);

    // If tiles are not found on the map, we cannot evaluate LoS safely
    if (!startTile || !endTile) {
      return {
        isValid: false,
        code: 'UNKNOWN_ERROR',
        reason: 'Unable to verify line of sight: target position is outside the mapped battlefield.'
      };
    }

    const hasLoS = hasLineOfSight(startTile, endTile, mapData);
    if (!hasLoS) {
      return {
        isValid: false,
        code: 'NO_LINE_OF_SIGHT',
        reason: 'Line of sight is blocked by an obstacle or solid wall.'
      };
    }

    return { isValid: true };
  }
}
