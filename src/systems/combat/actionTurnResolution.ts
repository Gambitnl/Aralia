/**
 * @file actionTurnResolution.ts
 * Resolves immediate turn resources and statuses, including Dash and Rage.
 * Receives explicit state and receipt sources; does not prompt, publish React
 * state, claim actions or emit events. The hook keeps those timing boundaries.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:36:36
 * Dependents: hooks/combat/useActionExecutor.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatLogEntry, Ability } from "../../types/combat";
import { getStatusDiscriminator } from "../../types/combatMessages";
import { ActionExecutionReceiptSources } from "./actionExecutionReceipt";

export interface ImmediateAbilityEffectResult {
  character: CombatCharacter;
  followUpLogs: CombatLogEntry[];
}



// ============================================================================
// Immediate Turn-Resource Ability Effects
// ============================================================================
// This section handles ability effects that change the current turn itself.
// Dash and Disengage are not attacks and should not travel through the weapon
// attack command path; they update movement/reaction rules directly here while
// still using the same executeAction call that spends the action or bonus action.
// ============================================================================

export const isDisengageAbility = (ability: Ability): boolean => {
  return ability.id === 'disengage' || ability.tags?.includes('disengage') === true || ability.name.toLowerCase() === 'disengage';
};



export const resolveImmediateAbilityTurnEffects = (
  character: CombatCharacter,
  ability: Ability,
  currentTurn: number,
  receipts: ActionExecutionReceiptSources
): ImmediateAbilityEffectResult => {
  let updatedCharacter = character;
  const followUpLogs: CombatLogEntry[] = [];

  // Dash-style abilities add movement for the rest of the current turn. The
  // amount comes from the ability data when present, falling back to current
  // speed so class variants can reuse the same shape.
  const movementGain = ability.effects
    .filter(effect => effect.type === 'movement')
    .reduce((total, effect) => total + Math.max(0, effect.value ?? character.stats.speed), 0);

  if (movementGain > 0) {
    updatedCharacter = {
      ...updatedCharacter,
      actionEconomy: {
        ...updatedCharacter.actionEconomy,
        movement: {
          ...updatedCharacter.actionEconomy.movement,
          total: updatedCharacter.actionEconomy.movement.total + movementGain
        }
      }
    };

    followUpLogs.push({
      id: receipts.generateId(),
      timestamp: receipts.now(),
      type: 'action',
      message: `${updatedCharacter.name} gains ${movementGain} ft of movement from ${ability.name}.`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, movementGain }
    });
  }

  // Disengage is represented as a one-turn status marker because the existing
  // opportunity-attack detector already checks statusEffects for this flag.
  if (isDisengageAbility(ability)) {
    const alreadyDisengaged = updatedCharacter.statusEffects.some(effect => effect.id === 'disengage' || effect.name === 'Disengage');

    // Bound to a name so the log record below can read the kind it just applied.
    const disengageStatus = {
      id: 'disengage',
      name: 'Disengage',
      type: 'buff' as const,
      duration: 1,
      effect: { type: 'condition' as const },
      icon: 'shield'
    };
    if (!alreadyDisengaged) {
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [
          ...updatedCharacter.statusEffects,
          disengageStatus
        ]
      };
    }

    followUpLogs.push({
      id: receipts.generateId(),
      timestamp: receipts.now(),
      type: 'status',
      message: `${updatedCharacter.name} will not provoke opportunity attacks this turn.`,
      characterId: updatedCharacter.id,
      // agora-db71.10: the emitter knows which status it just applied, so it says so.
      // The adapter's live lookup can only classify a record whose named effect is still
      // on the character when the record is converted; a stamp survives that.
      eventClass: getStatusDiscriminator(disengageStatus.type)?.eventClass,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  // ------------------------------------------------------------------
  // Stand Up — Prone Condition Removal (2024 PHB)
  // ------------------------------------------------------------------
  // When a character uses the "Stand Up" ability, they spend half their
  // movement speed to right themselves from a prone position. This block
  // handles the immediate state change: removing the Prone condition and
  // its associated status effect from the character.
  //
  // Two parallel lists are cleaned:
  //   1. statusEffects — the older display-layer effects (name/id based)
  //   2. conditions — the newer ActiveCondition array used by combat logic
  //
  // The movement cost itself is handled by the ability's cost definition
  // in combatUtils.ts (type: 'movement-only', movementCost: speed / 2).
  // ------------------------------------------------------------------
  if (ability.id === 'stand_up' || ability.name === 'Stand Up') {
    updatedCharacter = {
      ...updatedCharacter,
      // Remove from the legacy status effects list (matches by name or id)
      statusEffects: updatedCharacter.statusEffects.filter(e => e.name !== 'Prone' && e.id !== 'prone' && e.id !== 'Prone'),
      // Remove from the conditions array used by the combat resolver
      // (the advantage/disadvantage logic in AbilityCommandFactory checks this)
      conditions: updatedCharacter.conditions?.filter(c => c.name !== 'Prone' && c.name !== 'prone') || []
    };

    // Log the stand-up action so the player sees confirmation in the combat log
    followUpLogs.push({
      id: receipts.generateId(),
      timestamp: receipts.now(),
      type: 'action',
      message: `${updatedCharacter.name} stands up, removing the Prone condition.`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  // ------------------------------------------------------------------
  // Rage (barbarian) — enter a battle rage
  // ------------------------------------------------------------------
  // Activating Rage applies a "Raging" status effect granting RESISTANCE to
  // physical damage — the iconic barbarian benefit (ResistanceCalculator reads
  // statusEffects[].modifiers.resistance, see resistanceUtils.ts) — plus
  // advantage on Strength saves and checks. Toggle: re-using Rage while already
  // raging is a no-op rather than stacking.
  if (ability.id === 'rage') {
    const alreadyRaging = updatedCharacter.statusEffects.some(e => e.id === 'raging');
    if (!alreadyRaging) {
      // Path of the Wild Heart "bear" boon (Rage of the Wilds, level 3): the Rage
      // ability is tagged 'wild_heart_bear' by the combat-character factory. When
      // present, the raging barbarian resists ALL damage types except psychic,
      // rather than only the base physical resistance.
      const isBearRage = ability.tags?.includes('wild_heart_bear') === true;
      const resistance = isBearRage
        ? ['physical', 'bludgeoning', 'piercing', 'slashing', 'acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'radiant', 'thunder']
        : ['physical', 'bludgeoning', 'piercing', 'slashing'];
      const ragingStatus = {
        id: 'raging',
        name: isBearRage ? 'Raging (Bear Spirit)' : 'Raging',
        type: 'buff' as const,
        duration: 10,
        source: 'Rage',
        icon: '🔥',
        modifiers: {
          resistance,
          advantage: ['save', 'check'] as ('attack' | 'save' | 'check')[],
        },
      };
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [...updatedCharacter.statusEffects, ragingStatus],
      };
      followUpLogs.push({
        id: receipts.generateId(),
        timestamp: receipts.now(),
        type: 'status',
        message: `${updatedCharacter.name} flies into a Rage — resistant to physical damage!`,
        characterId: updatedCharacter.id,
        eventClass: getStatusDiscriminator(ragingStatus.type)?.eventClass,
        data: { abilityName: ability.name, currentTurn }
      });
    }
  }

  // ------------------------------------------------------------------
  // Reckless Attack (barbarian level 2+) — advantage on your melee attacks this
  // turn, at the cost of granting attackers advantage against you (a 'Reckless'
  // condition the attack resolver checks) until your next turn.
  // ------------------------------------------------------------------
  if (ability.id === 'reckless_attack') {
    const already = updatedCharacter.statusEffects.some(e => e.id === 'reckless');
    if (!already) {
      const recklessStatus = {
        id: 'reckless',
        name: 'Reckless',
        type: 'buff' as const,
        duration: 1,
        source: 'Reckless Attack',
        icon: '⚔️',
        modifiers: { advantage: ['attack'] as ('attack' | 'save' | 'check')[] },
      };
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [...updatedCharacter.statusEffects, recklessStatus],
        conditions: [
          ...(updatedCharacter.conditions || []),
          { name: 'Reckless', duration: { type: 'rounds' as const, value: 1 }, appliedTurn: currentTurn, source: 'reckless_attack' },
        ],
      };
      followUpLogs.push({
        id: receipts.generateId(),
        timestamp: receipts.now(),
        type: 'status',
        message: `${updatedCharacter.name} attacks recklessly — advantage on attacks, but exposed!`,
        characterId: updatedCharacter.id,
        eventClass: getStatusDiscriminator(recklessStatus.type)?.eventClass,
        data: { abilityName: ability.name, currentTurn }
      });
    }
  }

  // ------------------------------------------------------------------
  // Steady Aim (rogue level 3+) — forgo movement for advantage on next attack.
  // ------------------------------------------------------------------
  if (ability.id === 'steady_aim') {
    const already = updatedCharacter.statusEffects.some(e => e.id === 'steady_aim');
    if (!already) {
      const aimStatus = {
        id: 'steady_aim',
        name: 'Steady Aim',
        type: 'buff' as const,
        duration: 1,
        source: 'Steady Aim',
        icon: '🎯',
        modifiers: { advantage: ['attack'] as ('attack' | 'save' | 'check')[] },
      };
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [...updatedCharacter.statusEffects, aimStatus],
        // Forgo the rest of this turn's movement (the cost of Steady Aim).
        actionEconomy: {
          ...updatedCharacter.actionEconomy,
          movement: { ...updatedCharacter.actionEconomy.movement, used: updatedCharacter.actionEconomy.movement.total },
        },
      };
      followUpLogs.push({
        id: receipts.generateId(),
        timestamp: receipts.now(),
        type: 'status',
        message: `${updatedCharacter.name} takes Steady Aim — advantage on the next attack.`,
        characterId: updatedCharacter.id,
        eventClass: getStatusDiscriminator(aimStatus.type)?.eventClass,
        data: { abilityName: ability.name, currentTurn }
      });
    }
  }

  // ------------------------------------------------------------------
  // Vow of Enmity (Oath of Vengeance paladin, level 3) — advantage on your
  // attack rolls against a sworn foe. Modeled as a self-buff granting attack
  // advantage (the same statusEffects[].modifiers.advantage mechanism Reckless
  // Attack and Steady Aim use, which WeaponAttackCommand reads). We do not model
  // the "single chosen target" restriction because combat advantage is applied
  // per attack roll; the mechanical benefit (advantage on attacks) is faithful.
  // ------------------------------------------------------------------
  if (ability.id === 'vow_of_enmity') {
    const already = updatedCharacter.statusEffects.some(e => e.id === 'vow_of_enmity');
    if (!already) {
      const vowStatus = {
        id: 'vow_of_enmity',
        name: 'Vow of Enmity',
        type: 'buff' as const,
        duration: 10,
        source: 'Vow of Enmity',
        icon: '👁️',
        modifiers: { advantage: ['attack'] as ('attack' | 'save' | 'check')[] },
      };
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [...updatedCharacter.statusEffects, vowStatus],
      };
      followUpLogs.push({
        id: receipts.generateId(),
        timestamp: receipts.now(),
        type: 'status',
        message: `${updatedCharacter.name} swears a Vow of Enmity — advantage on attacks against their foe!`,
        characterId: updatedCharacter.id,
        eventClass: getStatusDiscriminator(vowStatus.type)?.eventClass,
        data: { abilityName: ability.name, currentTurn }
      });
    }
  }

  // ------------------------------------------------------------------
  // Action Surge (fighter level 2+) — gain one additional action this turn.
  // ------------------------------------------------------------------
  if (ability.id === 'action_surge') {
    updatedCharacter = {
      ...updatedCharacter,
      actionEconomy: {
        ...updatedCharacter.actionEconomy,
        action: {
          ...updatedCharacter.actionEconomy.action,
          remaining: (updatedCharacter.actionEconomy.action.remaining ?? 0) + 1,
        },
      },
    };
    followUpLogs.push({
      id: receipts.generateId(),
      timestamp: receipts.now(),
      type: 'action',
      message: `${updatedCharacter.name} uses Action Surge — an extra action this turn!`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  return { character: updatedCharacter, followUpLogs };
};
