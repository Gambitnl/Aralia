/**
 * @file src/hooks/combat/useCombatValidation.ts
 * Combat ability prerequisite validation hook.
 *
 * This hook answers one question before an ability is paid for: may this
 * character use this ability right now, given its own conditions, the ability's
 * own availability rules, the battlefield around it, and the ability's authored
 * prerequisites?
 *
 * It is a prerequisite gate, not a targeting gate. Target legality (range to a
 * chosen target, line of sight, target type) belongs to `useTargetValidator`
 * and to `ActionValidator.validateRange`/`validateLineOfSight`, which run once
 * a target exists. This hook runs before a target is required, so it only asks
 * whether the ability is usable at all.
 *
 * Condition rules are delegated to `ActionValidator.validateConditionPrerequisites`
 * so incapacitation, silence, blindness, and immobilization have one owner.
 * The rules added here are the ones no other validator covers: being disarmed,
 * per-ability cooldown and use limits, the authored `Ability.prerequisites`
 * block, and standing off the battle map.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/Combat/InPlaceCombatScene.tsx, hooks/combat/useActionExecutor.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from 'react';
import {
  CombatCharacter,
  Ability,
  BattleMapData,
  ActiveCondition,
} from '../../types/combat';
import { ActionValidator } from '../../systems/actions/ActionValidator';
import { getCharacterDistance } from '../../utils/combat';
import { getCombatDistanceFeet } from '../../utils/spatial/elevationGeometry';

// ============================================================================
// Result Contract
// ============================================================================
// The codes are distinct from ActionValidator's so a caller can tell a
// prerequisite refusal from a resource or targeting refusal. A delegated
// condition refusal keeps ActionValidator's own code and reason text.
// ============================================================================

export type AbilityPrerequisiteErrorCode =
  | 'DISARMED'
  | 'ON_COOLDOWN'
  | 'USES_DEPLETED'
  | 'NO_TARGET_IN_REACH'
  | 'NO_TARGET_IN_RANGE'
  | 'INSUFFICIENT_MOVEMENT_TAKEN'
  | 'PREREQUISITE_UNVERIFIABLE'
  | 'OFF_MAP';

export interface AbilityUsabilityResult {
  /** True when every prerequisite this hook can check is satisfied. */
  usable: boolean;
  /** Human-readable explanation of the first failed prerequisite. */
  reason?: string;
  /** Stable code for logs and tests. Condition refusals carry ActionValidator's code. */
  code?: AbilityPrerequisiteErrorCode | string;
}

/**
 * Optional facts the executing surface knows and the character record does not.
 * `abilityIdsUsedThisTurn` is the only way to verify the authored
 * `prerequisites.otherAbilityUsed` rule: no field on `CombatCharacter` records
 * which abilities were spent this turn.
 */
export interface AbilityUsabilityContext {
  abilityIdsUsedThisTurn?: string[];
}

const USABLE: AbilityUsabilityResult = { usable: true };

// ============================================================================
// Character State Readers
// ============================================================================

/** Collects active condition names from both the status and condition arrays. */
const getConditionNames = (character: CombatCharacter): Set<string> => {
  const names = new Set<string>();
  for (const status of character.statusEffects ?? []) {
    if (status?.name) names.add(status.name.toLowerCase());
  }
  for (const condition of character.conditions ?? []) {
    if (typeof condition === 'string') {
      names.add((condition as string).toLowerCase());
    } else if (condition && typeof (condition as ActiveCondition).name === 'string') {
      names.add((condition as ActiveCondition).name.toLowerCase());
    }
  }
  return names;
};

/**
 * True when the ability is swung with a held weapon. A spell, an unarmed
 * strike, and a pure utility button all stay usable with empty hands.
 */
const usesHeldWeapon = (ability: Ability): boolean => {
  if (ability.attackType === 'unarmed' || ability.attackType === 'spell') return false;
  if (ability.type === 'spell') return false;
  return ability.weapon !== undefined || ability.attackType === 'weapon' || ability.type === 'attack';
};

// ============================================================================
// Hook
// ============================================================================

export const useCombatValidation = (
  characters: CombatCharacter[],
  mapData: BattleMapData | null,
) => {
  /**
   * Runs every prerequisite in cost order: cheap character state first, then
   * per-ability availability, then the battlefield reads that need the roster.
   */
  const checkAbilityUsable = useCallback((
    caster: CombatCharacter,
    ability: Ability,
    context: AbilityUsabilityContext = {},
  ): AbilityUsabilityResult => {
    // 1. Conditions and incapacitation. ActionValidator owns these rules; the
    // spell's own component list decides whether silence matters.
    const conditionCheck = ActionValidator.validateConditionPrerequisites(caster, {
      actionName: ability.name,
      components: ability.spell?.components,
      actionCost: ability.cost,
    });
    if (!conditionCheck.isValid) {
      return { usable: false, reason: conditionCheck.reason, code: conditionCheck.code };
    }

    const conditions = getConditionNames(caster);

    // 2. Disarmed. A disarmed creature keeps its spells and its fists.
    if (conditions.has('disarmed') && usesHeldWeapon(ability)) {
      return {
        usable: false,
        code: 'DISARMED',
        reason: `${caster.name} is disarmed and cannot use ${ability.name} without a weapon in hand.`,
      };
    }

    // 3. Per-ability availability. The ability palette already greys these out;
    // enforcing them here closes the same rule for AI and scripted callers.
    if ((ability.currentCooldown ?? 0) > 0) {
      return {
        usable: false,
        code: 'ON_COOLDOWN',
        reason: `${ability.name} is on cooldown for ${ability.currentCooldown} more turn(s).`,
      };
    }
    if (ability.maxUses !== undefined && (ability.usesRemaining ?? ability.maxUses) <= 0) {
      return {
        usable: false,
        code: 'USES_DEPLETED',
        reason: `${caster.name} has no uses of ${ability.name} left.`,
      };
    }

    // 4. Standing off the battle map. A creature with no tile under it cannot be
    // measured for reach, cover, or line of sight, so no ability resolves from
    // there. This is reported, never silently treated as "anywhere is fine".
    if (mapData) {
      const tileKey = `${caster.position.x}-${caster.position.y}`;
      if (!mapData.tiles.has(tileKey)) {
        return {
          usable: false,
          code: 'OFF_MAP',
          reason: `${caster.name} is not standing on the battle map and cannot use ${ability.name}.`,
        };
      }
    }

    // 5. Authored prerequisites on the ability itself.
    const prerequisites = ability.prerequisites;
    if (!prerequisites) return USABLE;

    // 5a. Position. "adjacent" means a hostile must be within one tile;
    // "range" means a hostile must be inside the ability's own range. Both read
    // the live roster so a lone survivor cannot open with a reach-only button.
    if (prerequisites.position) {
      const reachTiles = prerequisites.position === 'adjacent' ? 1 : ability.range;
      // With a battle map the elevation-aware measure is authoritative; without
      // one the roster still carries flat tile positions, and that is the whole
      // truth available on a mapless surface.
      const tileDistance = (other: CombatCharacter): number => (mapData
        ? getCombatDistanceFeet(caster, other, mapData) / 5
        : getCharacterDistance(caster, other));
      const hasReachableFoe = characters.some(other =>
        other.id !== caster.id
        && other.team !== caster.team
        && other.currentHP > 0
        && tileDistance(other) <= reachTiles
      );
      if (!hasReachableFoe) {
        return prerequisites.position === 'adjacent'
          ? {
            usable: false,
            code: 'NO_TARGET_IN_REACH',
            reason: `${ability.name} needs an adjacent enemy, and none is within reach of ${caster.name}.`,
          }
          : {
            usable: false,
            code: 'NO_TARGET_IN_RANGE',
            reason: `${ability.name} needs an enemy within ${ability.range} tiles, and none is in range of ${caster.name}.`,
          };
      }
    }

    // 5b. Minimum movement. This is the charge rule: the ability requires the
    // creature to have already covered that much ground this turn. It reads
    // movement SPENT, which sits next to `movementType: "before"` on the same
    // ability record.
    if (prerequisites.minimumMovement !== undefined) {
      const movedFeet = caster.actionEconomy?.movement?.used ?? 0;
      if (movedFeet < prerequisites.minimumMovement) {
        return {
          usable: false,
          code: 'INSUFFICIENT_MOVEMENT_TAKEN',
          reason: `${ability.name} needs ${prerequisites.minimumMovement} ft of movement first; ${caster.name} has moved ${movedFeet} ft.`,
        };
      }
    }

    // 5c. Required earlier ability. No field on CombatCharacter records which
    // abilities were spent this turn, so this rule is only checkable when the
    // caller supplies the record. Without it the prerequisite is refused rather
    // than waved through: an unverifiable gate that passes is not a gate.
    if (prerequisites.otherAbilityUsed !== undefined) {
      if (!context.abilityIdsUsedThisTurn) {
        return {
          usable: false,
          code: 'PREREQUISITE_UNVERIFIABLE',
          reason: `${ability.name} requires ${prerequisites.otherAbilityUsed} first, and this caller did not report which abilities ${caster.name} has used this turn.`,
        };
      }
      if (!context.abilityIdsUsedThisTurn.includes(prerequisites.otherAbilityUsed)) {
        return {
          usable: false,
          code: 'PREREQUISITE_UNVERIFIABLE',
          reason: `${caster.name} must use ${prerequisites.otherAbilityUsed} before ${ability.name}.`,
        };
      }
    }

    return USABLE;
  }, [characters, mapData]);

  /** Boolean form for call sites that only branch on legality. */
  const isAbilityUsable = useCallback((
    caster: CombatCharacter,
    ability: Ability,
    context?: AbilityUsabilityContext,
  ): boolean => checkAbilityUsable(caster, ability, context).usable, [checkAbilityUsable]);

  return {
    checkAbilityUsable,
    isAbilityUsable,
  };
};
