/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx, hooks/combat/useTurnManager.ts
 * Imports: 24 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  CombatCharacter,
  CombatAction,
  CombatLogEntry,
  BattleMapData,
  TurnState,
  DamageNumber,
  Animation,
  AbilityCost,
  ReactiveTrigger,
  Ability,
  StatusEffect,
  CombatState
} from '../../types/combat';
import { Spell } from '../../types/spells';
import type { ConditionName, SavingThrowAbility } from '../../types/spells';
import type { CharacterStats } from '../../types/core';
import { rollDice, rollD20 } from '../../systems/dice/rollers';
import {
  generateId,
  getActionMessage,
  getOccupiedTiles,
  getCharacterSizeMultiplier,
  isRaging,
  FRENZY_ABILITY_ID,
  CUNNING_ACTION_ABILITY_PREFIX,
  PRIMAL_COMPANION_COMMAND_ABILITY_ID
} from '../../utils/combat';
// Subclass riders. Every rule stays inside these modules; this hook only hands
// them live combat state and publishes whatever they hand back (agora-db71.14).
import { resetPrimalBeastCommands, resolveBeastCommand } from '../../utils/combat/beastMasterUtils';
import { resolveCunningAction } from '../../utils/combat/thiefUtils';
// Horde Breaker, Giant Killer and Beast's Strike each grant a SECOND real
// attack roll. The rider modules own their rules; the swing itself is built as
// a WeaponAttackCommand by systems/combat/riderExtraStrikes, the same factory
// path the opportunity attack above uses (agora-db71.24).
import {
  resolveBeastsStrikeAttack,
  resolveGiantKillerStrike,
  resolveHordeBreakerStrike,
  selectHordeBreakerSecondaryTarget,
} from '../../systems/combat/riderExtraStrikes';
import type { ExtraStrikeOutcome } from '../../systems/combat/riderExtraStrikes';
import {
  getHunterPreyChoice,
  hasHuntersPrey,
  hasUsedHunterPreyThisTurn,
} from '../../utils/combat/hunterUtils';
// The opportunity attack is a real attack, so it is built and run as one
// (agora-f821.41). Colossus Slayer and Assassinate travel inside
// WeaponAttackCommand with every other attack rule.
import { AbilityCommandFactory, CommandExecutor } from '../../commands';
import { buildCommandGameState } from '../actionUtils';
import { getAbilityModifierValue } from '../../utils/character';
import { calculateSpellDC, rollSavingThrow } from '../../utils/character';
import { calculateMovementTotal } from '../../utils/combat/actionEconomyUtils';
import {
  ActiveSpellZone,
  MovementTriggerDebuff,
  processMovementTriggers,
  recenterConjureAnimalsZonesForPackMove
} from '../../systems/spells/effects';
import { AreaEffectTracker } from '../../systems/spells/effects/AreaEffectTracker';
import { combatEvents } from '../../systems/events/CombatEvents';
import { OpportunityAttackSystem } from '../../systems/combat/reactions/OpportunityAttackSystem';
import { applyRuntimeStatusCondition } from '../../utils/combat/statusConditionUtils';
import { validateTauntWillingMove } from '../../systems/combat/tauntConstraint';
import { groundImpactOfAbility, type ImpactAbilityLike } from '../../systems/combat/groundImpact';
import {
  resolveAerialMovement,
  type AerialMovementResolution,
} from '../../utils/combat/aerialMovementUtils';
import { resolveAerialLandingImpact } from '../../systems/combat/fallingGroundImpactResolution';
import { facingFromPositions } from '../../utils/spatial/geometry';
import { useOptionalGameState } from '../../state/GameContext';
import {
  startRitual,
  parseSpecialCastingTimeSeconds,
} from '../../systems/rituals/RitualManager';
import type { RitualState } from '../../types/rituals';
import { useCombatValidation } from './useCombatValidation';
import { getStatusDiscriminator } from '../../types/combatMessages';

export interface UseActionExecutorProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onCharacterRemove?: (characterId: string) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  endTurn: () => void | Promise<void>;

  // Economy
  canAfford: (c: CombatCharacter, cost: AbilityCost) => boolean;
  consumeAction: (c: CombatCharacter, cost: AbilityCost) => CombatCharacter;
  recordAction: (action: CombatAction) => void;

  // Visuals
  addDamageNumber: (val: number, pos: { x: number, y: number }, type: DamageNumber['type']) => void;
  queueAnimation: (anim: Animation) => void;

  // Engine Mechanics
  handleDamage: (c: CombatCharacter, amt: number, src: string, type?: string, currentTurnNumber?: number) => CombatCharacter;
  processRepeatSaves: (c: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', effectId?: string) => CombatCharacter;
  processTileEffects: (c: CombatCharacter, pos: { x: number, y: number }) => CombatCharacter;

  // Engine State
  spellZones: ActiveSpellZone[];
  setSpellZones?: Dispatch<SetStateAction<ActiveSpellZone[]>>;
  movementDebuffs: MovementTriggerDebuff[];
  reactiveTriggers: ReactiveTrigger[];
  setMovementDebuffs: React.Dispatch<React.SetStateAction<MovementTriggerDebuff[]>>;

  // Reaction Selection Helper
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: Array<Spell | Ability>,
    reactionWeapons?: Ability[]
  ) => Promise<string | null>;
  executeReactionSpell?: (
    attacker: CombatCharacter,
    target: CombatCharacter,
    spellAbility: Ability
  ) => Promise<void> | void;
}

interface ImmediateAbilityEffectResult {
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

const isDisengageAbility = (ability: Ability): boolean => {
  return ability.id === 'disengage' || ability.tags?.includes('disengage') === true || ability.name.toLowerCase() === 'disengage';
};

const SENTINEL_STOP_EFFECT_ID = 'sentinel_stop';
const SENTINEL_STOP_EFFECT_NAME = 'Sentinel Stop';

const hasFeat = (character: CombatCharacter, featName: string): boolean => {
  return character.feats?.some(feat => feat.toLowerCase() === featName.toLowerCase()) === true;
};

const hasSentinelFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'sentinel');
};

const hasWarCasterFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'war caster');
};

const isWarCasterEligibleSpell = (ability: Ability): boolean => {
  // War Caster only swaps in spells that still behave like a single-target
  // action-cast spell. Reaction-cast spells already consume the same resource
  // and should stay out of the OA substitution list.
  return ability.type === 'spell'
    && ability.cost.type === 'action'
    && ability.spell !== undefined
    && (ability.targeting === 'single_enemy' || ability.targeting === 'single_any');
};

const applySentinelStop = (character: CombatCharacter): CombatCharacter => {
  const movementTotal = calculateMovementTotal(character);
  const hasSentinelStop = character.statusEffects.some(effect =>
    effect.id === SENTINEL_STOP_EFFECT_ID || effect.name === SENTINEL_STOP_EFFECT_NAME
  );
  const movementAlreadyZero = character.actionEconomy.movement.used === 0 && character.actionEconomy.movement.total === 0;
  const needsSentinelEffect = !hasSentinelStop && movementTotal > 0;

  if (movementAlreadyZero && !needsSentinelEffect) {
    return character;
  }

  const statusEffects: StatusEffect[] = needsSentinelEffect
    ? [
      ...character.statusEffects,
      {
        id: SENTINEL_STOP_EFFECT_ID,
        name: SENTINEL_STOP_EFFECT_NAME,
        type: 'debuff',
        duration: 1,
        effect: {
          type: 'stat_modifier',
          stat: 'speed',
          value: -movementTotal
        },
        icon: 'shield'
      }
    ]
    : character.statusEffects;

  return {
    ...character,
    statusEffects: statusEffects,
    actionEconomy: {
      ...character.actionEconomy,
      movement: {
        ...character.actionEconomy.movement,
        used: 0,
        total: 0
      }
    }
  };
};

export const applyImmediateAbilityTurnEffects = (
  character: CombatCharacter,
  ability: Ability,
  currentTurn: number
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
      id: generateId(),
      timestamp: Date.now(),
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
      id: generateId(),
      timestamp: Date.now(),
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
      id: generateId(),
      timestamp: Date.now(),
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
        id: generateId(),
        timestamp: Date.now(),
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
        id: generateId(),
        timestamp: Date.now(),
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
        id: generateId(),
        timestamp: Date.now(),
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
        id: generateId(),
        timestamp: Date.now(),
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
      id: generateId(),
      timestamp: Date.now(),
      type: 'action',
      message: `${updatedCharacter.name} uses Action Surge — an extra action this turn!`,
      characterId: updatedCharacter.id,
      data: { abilityName: ability.name, currentTurn }
    });
  }

  return { character: updatedCharacter, followUpLogs };
};

// ============================================================================
// Opportunity Attack Damage Helpers
// ============================================================================
// Opportunity attacks use monster and weapon abilities from several data
// sources. Some store damage as dice and others store a flat value, so this
// helper normalizes both shapes before the attack rolls damage.
// ============================================================================

const getOpportunityAttackDamageFormula = (ability: Ability): string | null => {
  const damageEffect = ability.effects.find(effect => effect.type === 'damage');
  if (!damageEffect) return null;

  if (damageEffect.dice) return damageEffect.dice;

  if (typeof damageEffect.value === 'number' && Number.isFinite(damageEffect.value)) {
    return String(Math.max(0, damageEffect.value));
  }

  return null;
};

// ============================================================================
// Movement Legality Helpers
// ============================================================================
// Movement must not place two living combatants on the same tile. The player
// movement preview and AI planner try to avoid those spaces, but the executor
// is the final authority before state changes are committed.
// ============================================================================

const getOccupyingCombatant = (
  characters: CombatCharacter[],
  movingCharacterId: string,
  targetPosition: { x: number; y: number }
): CombatCharacter | undefined => {
  return characters.find(character => {
    if (character.id === movingCharacterId || character.currentHP <= 0) return false;
    const occupied = getOccupiedTiles(character);
    return occupied.some(tile => tile.x === targetPosition.x && tile.y === targetPosition.y);
  });
};

const getGridDistanceFeet = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): number => Math.hypot(to.x - from.x, to.y - from.y) * 5;

const getMapTileElevation = (
  mapData: BattleMapData,
  position: { x: number; y: number }
): number | undefined => {
  for (const tile of mapData.tiles.values()) {
    if (tile.coordinates.x === position.x && tile.coordinates.y === position.y) {
      return tile.elevation;
    }
  }

  return undefined;
};

const crossesTenserElevationBarrier = (
  mapData: BattleMapData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxChangeFeet: number
): boolean => {
  const startElevation = getMapTileElevation(mapData, from);
  const endElevation = getMapTileElevation(mapData, to);

  if (startElevation === undefined || endElevation === undefined) {
    return false;
  }

  return Math.abs(endElevation - startElevation) >= maxChangeFeet;
};

const getTenserFollowPosition = (
  diskPosition: { x: number; y: number },
  casterPosition: { x: number; y: number },
  followDistanceFeet: number
): { x: number; y: number } => {
  const followTiles = Math.max(0, Math.floor(followDistanceFeet / 5));
  const dx = casterPosition.x - diskPosition.x;
  const dy = casterPosition.y - diskPosition.y;
  const distanceTiles = Math.hypot(dx, dy);
  const tilesToMove = Math.max(0, distanceTiles - followTiles);

  if (distanceTiles === 0 || tilesToMove === 0) {
    return diskPosition;
  }

  return {
    x: diskPosition.x + Math.round((dx / distanceTiles) * tilesToMove),
    y: diskPosition.y + Math.round((dy / distanceTiles) * tilesToMove)
  };
};

// ============================================================================
// Ritual / long-cast classification
// ============================================================================
// A spell whose header asks for minutes or hours is a ceremony, not a swing of
// the arm. The combat executor cannot resolve it inside one turn, so it hands
// the spell to the ritual runtime instead of applying its effects immediately.
//
// A one-action cast stays a one-action cast, cantrips included. The app has no
// "cast this as a ritual" switch on a combat action yet, so a ritual-capable
// spell that still reads "1 action" keeps its ordinary instant cast; only the
// stated casting time promotes a cast into a ceremony.
// ============================================================================
function getCeremonySpell(ability: Ability | undefined): Spell | null {
  const spell = ability?.spell as Spell | undefined;
  if (!spell?.castingTime) return null;

  const unit = spell.castingTime.unit;
  if (unit === 'minute' || unit === 'hour') return spell;

  // "Special" keeps its real timing in prose on ritualData. Only a spell that
  // actually states a parseable duration there is a ceremony; one that states
  // none is left on its existing path rather than guessed at.
  if (unit === 'special' && parseSpecialCastingTimeSeconds(spell.ritualData?.castingTimeSpecial) !== null) {
    return spell;
  }

  return null;
}

export const useActionExecutor = ({
  characters,
  turnState,
  mapData,
  onCharacterUpdate,
  onCharacterRemove,
  onLogEntry,
  endTurn,
  canAfford,
  consumeAction,
  recordAction,
  addDamageNumber,
  queueAnimation,
  handleDamage,
  processRepeatSaves,
  processTileEffects,
  spellZones,
  setSpellZones,
  movementDebuffs,
  reactiveTriggers,
  setMovementDebuffs,
  requestReaction,
  executeReactionSpell
}: UseActionExecutorProps) => {

  // Ritual starts live in global game state (GameState.activeRitual), not in the
  // combat roster, so the executor reaches for the app dispatch. useOptionalGameState
  // is used because this hook also runs in previews and tests with no provider;
  // a missing dispatch is never silently ignored — the ritual gate below refuses
  // the cast and says so in the combat log.
  const dispatch = useOptionalGameState()?.dispatch;

  // Singleton AreaEffectTracker — created once per hook mount, zones updated each use.
  // Avoids allocating a new object on every movement action (previously `new AreaEffectTracker(spellZones)`).
  const areaEffectTrackerRef = useRef<AreaEffectTracker>(new AreaEffectTracker([]));

  // Movement action ids are stable event identities for the entire transaction.
  // Claiming before validation or an asynchronous reaction prompt makes replay
  // a complete no-op: it cannot pay movement again, prompt again, move again,
  // or publish duplicate attack and movement receipts.
  const processedMovementActionIdsRef = useRef<Set<string>>(new Set());

  // Ability prerequisite gate. This is the production wiring for
  // useCombatValidation: every ability action committed through this executor
  // passes its conditions, disarm state, cooldown, use limits, reach, and
  // authored prerequisites before a single resource is spent.
  const { checkAbilityUsable } = useCombatValidation(characters, mapData);

  // ============================================================================
  // Subclass Rider Bridge
  // ============================================================================
  // The Hunter, Beast Master, Thief and Assassin riders in
  // `utils/combat/{hunter,beastMaster,thief,assassin}Utils` are written against
  // `CombatState` and return a new one. This hook holds a character array, so
  // the two helpers below are the entire adapter: one builds the state a rider
  // reads, the other publishes back exactly the combatants a rider changed.
  // Not one subclass rule lives in this file.
  // ============================================================================
  const buildRiderState = useCallback((roster: CombatCharacter[]): CombatState => ({
    isActive: true,
    characters: roster,
    turnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers,
    activeLightSources: [],
  }), [turnState, reactiveTriggers]);

  /**
   * Publishes every combatant a rider replaced. Riders rebuild the roster with
   * `map`, so an untouched combatant is reference-equal and is not republished.
   */
  const publishRiderChanges = useCallback((
    before: CombatCharacter[],
    after: CombatCharacter[],
  ): void => {
    after.forEach((character, index) => {
      if (character !== before[index]) onCharacterUpdate(character);
    });
  }, [onCharacterUpdate]);

  // ============================================================================
  // Shared Reactive Trigger Processing
  // ============================================================================
  // Exactly two live sites read `reactiveTriggers`: the on-target-attack
  // retaliation resolver below and the sustain block inside `executeAction`.
  // The movement path no longer reads this array at all — it reads
  // `movementDebuffs` — so these two are the whole surface. Both now share one
  // selector and one damage applicator, so a change to trigger matching or to
  // reactive damage delivery lands on both sites instead of one.
  //
  // The two sites differ only in presentation: the attack site writes a combat
  // log line, a floating damage number, and a spell animation; the sustain site
  // is silent because the sustain action already logged itself. Those
  // differences stay at the call site as optional arguments rather than as a
  // second copy of the roll-and-apply code.
  // ============================================================================

  /**
   * Selects live reactive triggers of one trigger type, scoped to the owner who
   * fires them. `targetId` matches triggers protecting one character;
   * `casterId` matches triggers a caster owns. Omitting a field leaves it
   * unconstrained.
   */
  const selectReactiveTriggers = useCallback((selector: {
    triggerType: ReactiveTrigger['sourceEffect']['trigger']['type'];
    targetId?: string;
    casterId?: string;
  }): ReactiveTrigger[] => reactiveTriggers.filter(trigger =>
    trigger.sourceEffect.trigger.type === selector.triggerType
    && (selector.targetId === undefined || trigger.targetId === selector.targetId)
    && (selector.casterId === undefined || trigger.casterId === selector.casterId)
  ), [reactiveTriggers]);

  /**
   * Rolls and delivers one reactive trigger's damage. Returns the rolled amount,
   * or null when the trigger carries no damage effect so the caller can tell a
   * silent non-damage trigger from a zero roll.
   */
  const applyReactiveTriggerDamage = useCallback((options: {
    trigger: ReactiveTrigger;
    recipient: CombatCharacter;
    damageSource: string;
    /** Built after the roll so the log line can name the exact amount. */
    buildLogEntry?: (damage: number) => CombatLogEntry;
    /** Supplied when the site shows a floating number over the recipient. */
    damageNumberPosition?: { x: number; y: number };
  }): number | null => {
    const effect = options.trigger.sourceEffect;
    if (effect.type !== 'DAMAGE' || !effect.damage) return null;

    const damage = rollDice(effect.damage.dice);
    if (options.buildLogEntry) {
      onLogEntry(options.buildLogEntry(damage));
    }
    onCharacterUpdate(handleDamage(
      options.recipient,
      damage,
      options.damageSource,
      effect.damage.type,
      turnState.currentTurn
    ));
    if (options.damageNumberPosition) {
      addDamageNumber(damage, options.damageNumberPosition, 'damage');
    }
    return damage;
  }, [handleDamage, onCharacterUpdate, onLogEntry, addDamageNumber, turnState.currentTurn]);

  // ============================================================================
  // On-Target-Attack Reactive Resolver
  // ============================================================================
  // Reactive spells such as Armor of Agathys need one hit/miss-aware path that
  // both normal attacks and opportunity attacks can call. Keeping this helper
  // inside the hook preserves access to the current character roster and state
  // callbacks while avoiding combat-log parsing or duplicated trigger filters.
  // ============================================================================
  const resolveOnTargetAttackReactiveEffects = useCallback((
    action: CombatAction,
    attackingCharacter: CombatCharacter,
    targetId: string,
    resolvedAttackResult: NonNullable<CombatAction['attackResults']>[number] | undefined
  ): void => {
    const triggers = selectReactiveTriggers({ triggerType: 'on_target_attack', targetId });

    // The attack roll lives in the command layer. An Armor of Agathys-style
    // retaliation therefore needs the roll the command actually made, never an
    // inference from the shape of the action, so an action that arrives without
    // a resolved result for this target proves nothing and retaliates for
    // nothing.
    const attackResult = resolvedAttackResult
      ?? action.attackResults?.find(result => result.targetId === targetId);
    if (!attackResult?.isHit) return;

    for (const trigger of triggers) {
      const effect = trigger.sourceEffect;
      const effectTrigger = effect.trigger;
      const attackFilter = 'attackFilter' in effectTrigger ? effectTrigger.attackFilter : undefined;

      // Armor of Agathys stores its "melee attack only" rule in the trigger's
      // attack filter, and the resolved result describes the roll that actually
      // happened.
      if (attackFilter?.weaponType && attackResult.weaponType !== attackFilter.weaponType) continue;

      // Spell data can also limit a reactive rider to weapon or spell attacks.
      if (attackFilter?.attackType && attackResult.attackType !== attackFilter.attackType) continue;

      // Source-owned temporary HP gates keep Armor of Agathys-style triggers
      // from surviving after their own temp-HP pool is gone or replaced.
      const endsWhenOwnTempHpIsGone = effect.conditionalEndings?.some(ending =>
        ending.trigger === 'temporary_hit_points_depleted'
      ) === true;
      if (endsWhenOwnTempHpIsGone) {
        const protectedTarget = characters.find(c => c.id === targetId);
        const sourceMatchesCurrentTempHp = trigger.sourceSpellId !== undefined &&
          protectedTarget?.temporaryHitPointSource?.spellId === trigger.sourceSpellId;
        if (!protectedTarget?.tempHP || protectedTarget.tempHP <= 0 || !sourceMatchesCurrentTempHp) continue;
      }

      applyReactiveTriggerDamage({
        trigger,
        recipient: attackingCharacter,
        damageSource: 'reactive effect',
        buildLogEntry: (damage) => ({
          id: generateId(), timestamp: Date.now(), type: 'damage',
          message: `${attackingCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
          characterId: attackingCharacter.id,
          data: { damage, trigger: 'on_target_attack' }
        }),
        damageNumberPosition: attackingCharacter.position,
      });

      const targetPositions = action.targetCharacterIds
        ?.map(id => characters.find(c => c.id === id)?.position)
        .filter(Boolean) as { x: number; y: number }[];

      queueAnimation({
        id: generateId(),
        type: 'spell_effect',
        characterId: action.characterId,
        startPosition: attackingCharacter.position,
        endPosition: action.targetPosition,
        duration: 650,
        startTime: Date.now(),
        data: { targetPositions: targetPositions?.length ? targetPositions : action.targetPosition ? [action.targetPosition] : [] },
      });
    }
  }, [characters, selectReactiveTriggers, applyReactiveTriggerDamage, queueAnimation]);

  // ============================================================================
  // Opportunity Attack Resolution
  // ============================================================================
  // Isolated here so OA logic is readable on its own and not buried in the
  // movement executor. Returns the mover's character after absorbing any damage.
  // Weapon choice already exists here; War Caster now reuses the same prompt
  // for single-target action-cast spells and hands spell resolution back to
  // the spell executor so this hook stays focused on OA movement fallout.
  // ============================================================================
  const handleOpportunityAttacks = useCallback(async (
    movedCharacter: CombatCharacter,
    previousPosition: { x: number; y: number },
    targetPosition: { x: number; y: number },
    movementMode: CombatAction['movementMode'] | undefined,
    decisions: CombatAction['opportunityAttackDecisions'],
    surprisedCharacterIds: CombatAction['surprisedCharacterIds'],
  ): Promise<CombatCharacter> => {
    let updatedCharacter = movedCharacter;
    const oaSystem = new OpportunityAttackSystem();

    // Pass the movement mode through when the movement action knows it. This is
    // what lets a shared summon trait such as Summon Beast Air's Flyby mean
    // "while flying" instead of "any movement by this form."
    const oaResults = oaSystem.checkOpportunityAttacks(
      updatedCharacter,
      previousPosition,
      targetPosition,
      characters,
      mapData,
      {
        movementMode,
        movementKind: 'voluntary',
        turnOrder: turnState.turnOrder,
      },
    );

    for (const result of oaResults) {
      if (!result.canAttack) continue;
      const attacker = characters.find(c => c.id === result.attackerId);
      if (!attacker) continue;

      // Filter the attacker's abilities to find all equipped melee weapons (range 1 or 2).
      // If the attacker can strike with their fists, we include Unarmed Strike as an option.
      const meleeWeapons = attacker.abilities.filter(a =>
        a.type === 'attack' && a.weapon && (a.range <= 2)
      );
      const unarmedStrike = attacker.abilities.find(a => a.id === 'unarmed_strike');
      const warCasterSpells = hasWarCasterFeat(attacker) && executeReactionSpell
        ? attacker.abilities.filter(isWarCasterEligibleSpell)
        : [];

      // Create a list of available weapons/strikes for the reaction prompt.
      const reactionWeapons: Ability[] = [...meleeWeapons];
      if (unarmedStrike) {
        reactionWeapons.push(unarmedStrike);
      }

      // If no valid weapon ability is found, fall back to the first available ability as a default.
      if (reactionWeapons.length === 0 && attacker.abilities[0]) {
        reactionWeapons.push(attacker.abilities[0]);
      }

      let chosenWeaponId: string | null = null;
      const suppliedDecision = decisions?.[attacker.id];
      if (suppliedDecision) {
        // Deterministic controllers preserve the same explicit choice the
        // player prompt would return. Decline is represented by no selected
        // ability and therefore cannot spend the observer's Reaction.
        chosenWeaponId = suppliedDecision.decision === 'accept'
          ? suppliedDecision.abilityId ?? reactionWeapons[0]?.id ?? warCasterSpells[0]?.id ?? null
          : null;
      } else if (attacker.team === 'player' && requestReaction) {
        // Ask the player to choose between a weapon strike and any War Caster
        // spell that can legally replace the opportunity attack.
        chosenWeaponId = await requestReaction(
          attacker.id,
          updatedCharacter.id,
          'opportunity_attack',
          warCasterSpells,
          reactionWeapons
        );

      } else {
        // Enemies and auto-run characters automatically strike with their first valid melee attack.
        chosenWeaponId = reactionWeapons[0]?.id || null;
      }

      // Every controller reaches the same decline receipt. This keeps AI,
      // player prompt, replay fixture, and future network decisions aligned.
      if (!chosenWeaponId) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${attacker.name} declines the Opportunity Attack reaction.`,
          characterId: attacker.id,
          targetIds: [updatedCharacter.id]
        });
        continue;
      }

      const chosenSpell = warCasterSpells.find(a => a.id === chosenWeaponId);
      if (chosenSpell) {
        await executeReactionSpell?.(attacker, updatedCharacter, chosenSpell);
        continue;
      }

      const weaponAbility = reactionWeapons.find(a => a.id === chosenWeaponId) || reactionWeapons[0];
      if (!weaponAbility) continue;

      // The reaction is spent whatever the swing does. It is applied to the
      // roster the command runs against, a few lines below, so the command sees
      // an attacker who has already paid, and it is published from the command's
      // own result rather than twice from here.

      // ----------------------------------------------------------------
      // One attack-roll implementation
      // ----------------------------------------------------------------
      // The reaction prompt, the decline receipt, the reaction spend and the
      // Sentinel stop above and below are movement-reaction concerns and stay
      // here. The swing itself is an ordinary weapon attack, so it is built as
      // a WeaponAttackCommand and run through CommandExecutor. That is what
      // gives an opportunity attack cover, the G14 high-ground rule, attack
      // riders such as Hunter's Mark, the caster's critical threshold, the
      // defensive Shield reaction, Sneak Attack, Colossus Slayer and
      // Assassinate — every one of which the old inline roll skipped.
      // ----------------------------------------------------------------

      // Replay and scenario controllers pin the dice. A pin is expressed as a
      // die source rather than a pre-computed result, so the command keeps
      // owning the roll and still lands on the requested face.
      const pinnedAttackRoll = suppliedDecision?.attackRoll;
      const attackRollRng = Number.isInteger(pinnedAttackRoll)
        && Number(pinnedAttackRoll) >= 1
        && Number(pinnedAttackRoll) <= 20
        ? () => (Number(pinnedAttackRoll) - 0.5) / 20
        : undefined;

      // `damageRoll` pins the face every damage die of this attack comes up on.
      // A die source cannot know how many sides it is being asked for, so the
      // fraction is derived from this weapon's own damage die: rollDamage maps a
      // source value v to Math.floor(v * sides) + 1, and (face - 0.5) / sides
      // lands on `face`. A single-die weapon therefore still deals exactly the
      // pinned number, which is what every existing fixture pins.
      const pinnedDamageRoll = suppliedDecision?.damageRoll;
      const weaponDieSides = Number(
        /d(\d+)/i.exec(getOpportunityAttackDamageFormula(weaponAbility) ?? '')?.[1] ?? 0
      );
      const damageRng = Number.isFinite(pinnedDamageRoll)
        && Number(pinnedDamageRoll) >= 1
        && weaponDieSides > 0
        ? () => (Math.min(Number(pinnedDamageRoll), weaponDieSides) - 0.5) / weaponDieSides
        : undefined;

      const attackerAfterReaction: CombatCharacter = {
        ...attacker,
        actionEconomy: {
          ...attacker.actionEconomy,
          reaction: {
            ...attacker.actionEconomy.reaction,
            used: true,
            remaining: 0,
          }
        }
      };

      // The roster handed to the command carries every change this movement has
      // already produced: the mover's accumulated damage from an earlier
      // responder, and this responder's spent reaction.
      const commandCharacters = characters.map(character => {
        if (character.id === updatedCharacter.id) return updatedCharacter;
        if (character.id === attacker.id) return attackerAfterReaction;
        return character;
      });
      const commandState: CombatState = {
        ...buildRiderState(commandCharacters),
        mapData: mapData ?? undefined,
      };
      const moverBeforeAttack = updatedCharacter;

      const commands = AbilityCommandFactory.createCommands(
        weaponAbility,
        attackerAfterReaction,
        [updatedCharacter],
        buildCommandGameState(commandCharacters, mapData),
        undefined,
        undefined,
        { attackRollRng, damageRng },
        { surprisedTargetIds: surprisedCharacterIds },
      );

      // Bracket the run so the resolved hit or miss can be read back off the
      // event bus instead of being inferred from the log or the roster.
      const attackSequenceStart = combatEvents.createReplaySnapshot().nextSequence;
      const commandResult = await CommandExecutor.execute(commands, commandState);

      if (!commandResult.success) {
        // No second roll and no fallback. The attack did not resolve, and the
        // reaction the responder already spent is reported as spent.
        onCharacterUpdate(attackerAfterReaction);
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name}'s Opportunity Attack against ${updatedCharacter.name} could not resolve: ${commandResult.error?.message ?? 'unknown command failure'}`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { rejectedReason: 'opportunity_attack_command_failed' },
        });
        continue;
      }

      // Publish every combatant this responder's swing changed, measured
      // against the roster the hook still holds. That is what carries both the
      // spent reaction and the damage out to React.
      commandResult.finalState.characters.forEach(character => {
        if (character !== characters.find(candidate => candidate.id === character.id)) {
          onCharacterUpdate(character);
        }
      });
      updatedCharacter = commandResult.finalState.characters
        .find(character => character.id === updatedCharacter.id) ?? updatedCharacter;
      // `commandState` starts with an empty log, and commands push onto that
      // same array, so everything in the final log belongs to this one swing.
      commandResult.finalState.combatLog.forEach(entry => onLogEntry(entry));

      const [opportunityAttackResult] = combatEvents.getAttackResultsSince(attackSequenceStart, {
        attackerId: attacker.id,
        targetIds: [moverBeforeAttack.id],
      });

      if (!opportunityAttackResult) {
        // WeaponAttackCommand publishes one attack result per target. Its
        // absence means the swing never reached the roll, which is a bug to
        // report rather than a miss to invent.
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name}'s Opportunity Attack against ${updatedCharacter.name} produced no attack roll.`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { rejectedReason: 'opportunity_attack_no_roll' },
        });
        continue;
      }

      // The command narrates an ordinary attack roll, so without this receipt
      // the log would never say the attack was an Opportunity Attack, nor which
      // weapon the responder reached for. It carries the roll the command made,
      // so combat-message adapters read hit/miss from here rather than parsing
      // the roll line.
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${attacker.name} ${opportunityAttackResult.isHit ? 'hits' : 'misses'} ${updatedCharacter.name} with an Opportunity Attack using ${weaponAbility.name}.`,
        characterId: attacker.id, targetIds: [updatedCharacter.id],
        data: {
          abilityName: weaponAbility.name,
          isHit: opportunityAttackResult.isHit,
          isCrit: opportunityAttackResult.isCritical,
        },
      });

      if (opportunityAttackResult.isHit) {
        const damageDealt = Math.max(
          0,
          (moverBeforeAttack.currentHP - updatedCharacter.currentHP)
          + ((moverBeforeAttack.tempHP ?? 0) - (updatedCharacter.tempHP ?? 0))
        );
        if (damageDealt > 0) {
          addDamageNumber(damageDealt, updatedCharacter.position, 'damage');
        }

        resolveOnTargetAttackReactiveEffects({
          id: `${generateId()}-opportunity-attack-reactive`,
          characterId: attacker.id,
          type: 'ability',
          abilityId: weaponAbility.id,
          targetCharacterIds: [updatedCharacter.id],
          targetPosition: updatedCharacter.position,
          cost: { type: 'free' },
          timestamp: Date.now(),
          attackResults: [opportunityAttackResult],
          reactiveEventsOnly: true
        }, attacker, updatedCharacter.id, opportunityAttackResult);

        if (hasSentinelFeat(attacker)) {
          const sentinelStoppedCharacter = applySentinelStop(updatedCharacter);
          if (sentinelStoppedCharacter !== updatedCharacter) {
            updatedCharacter = sentinelStoppedCharacter;
            onLogEntry({
              id: generateId(),
              timestamp: Date.now(),
              type: 'status',
              message: `${attacker.name}'s Sentinel feat stops ${updatedCharacter.name} in place!`,
              characterId: attacker.id,
              targetIds: [updatedCharacter.id]
            });
          }
        }
      } else {
        resolveOnTargetAttackReactiveEffects({
          id: `${generateId()}-opportunity-attack-reactive`,
          characterId: attacker.id,
          type: 'ability',
          abilityId: weaponAbility.id,
          targetCharacterIds: [updatedCharacter.id],
          targetPosition: updatedCharacter.position,
          cost: { type: 'free' },
          timestamp: Date.now(),
          attackResults: [opportunityAttackResult],
          reactiveEventsOnly: true
        }, attacker, updatedCharacter.id, opportunityAttackResult);
        addDamageNumber(0, updatedCharacter.position, 'miss');
      }
    }

    return updatedCharacter;
  }, [characters, mapData, onLogEntry, onCharacterUpdate, addDamageNumber, requestReaction, executeReactionSpell, resolveOnTargetAttackReactiveEffects, buildRiderState]);

  // ============================================================================
  // Movement Execution
  // ============================================================================
  // Handles the full sequence for a single tile step: position commit, tile
  // effects, opportunity attacks, movement-debuff triggers, and spell-zone entry.
  // NOTE: D&D 5e OAs occur *before* the creature leaves the reach, but in this
  // synchronous engine we resolve damage retroactively after the move commits.
  // Sentinel now zeroes the mover's remaining movement after a hit so the
  // turn state and the next reset both see the stop.
  // ============================================================================
  const handleMoveExecution = useCallback(async (
    character: CombatCharacter,
    action: CombatAction,
    resolvedMovementCharacter?: CombatCharacter,
  ): Promise<CombatCharacter> => {
    if (action.type !== 'move' || !action.targetPosition) return character;

    const previousPosition = character.position;
    // Aerial movement reaches this handler only after the complete 3D route and
    // mode-specific budget have resolved atomically. Ground movement keeps the
    // historical endpoint projection used by every existing caller.
    // Resource payment and aerial validation return a new character without
    // committing the horizontal destination. Apply that destination here so
    // the final update cannot preserve the origin simply because a paid state
    // was supplied. Opportunity Attack damage is still resolved before this
    // completed mover state is published to React.
    // Keep the facing current on every move. Directional spells that carry no
    // target point, such as a cone zone cast from the caster square, read this
    // facing at zone creation. The last step of the path is the true facing,
    // thus a path that turns before it stops does not point at the start square.
    const lastStepStart = action.movementPath && action.movementPath.length >= 2
      ? action.movementPath[action.movementPath.length - 2]
      : previousPosition;
    const movedFacing = facingFromPositions(lastStepStart, action.targetPosition);

    let updatedCharacter: CombatCharacter = {
      ...(resolvedMovementCharacter ?? character),
      position: { ...action.targetPosition },
      facing: movedFacing ?? (resolvedMovementCharacter ?? character).facing,
    };

    // A published movement fact with no subscriber today. It is kept as the
    // movement feed other surfaces can read, but it is NOT complete: command-side
    // forced movement, pull and teleport do not emit it, so nothing may treat it
    // as the whole record of who moved (WF gap filed with agora-f821.45).
    combatEvents.emit({
      type: 'unit_move',
      unitId: character.id,
      from: previousPosition,
      to: action.targetPosition,
      cost: action.cost.movementCost || 0,
      isForced: false
    });

    updatedCharacter = processTileEffects(updatedCharacter, action.targetPosition);
    updatedCharacter = await handleOpportunityAttacks(
      updatedCharacter,
      previousPosition,
      action.targetPosition,
      action.movementMode,
      action.opportunityAttackDecisions,
      action.surprisedCharacterIds,
    );

    // Movement-debuff triggers (e.g., Entangle)
    const moveTriggerResults = processMovementTriggers(movementDebuffs, updatedCharacter, turnState.currentTurn, {
      previousPosition,
      movementType: 'willing'
    });
    for (const result of moveTriggerResults) {
      if (result.triggered) {
        setMovementDebuffs(prev => prev.map(d => d.id === result.sourceId ? { ...d, hasTriggered: true } : d));
        for (const effect of result.effects) {
          if (effect.type === 'damage' && effect.dice) {
            const damage = rollDice(effect.dice);
            updatedCharacter = handleDamage(updatedCharacter, damage, 'moving', effect.damageType, turnState.currentTurn);
          }
        }
      }
    }

    // A Conjure Animals pack owns the center of its proximity zone. Recenter
    // the live state before evaluating movement so a pack move can trigger the
    // authored radius at its new destination in the same action.
    const movementSpellZones = recenterConjureAnimalsZonesForPackMove(spellZones, updatedCharacter);
    if (movementSpellZones !== spellZones) {
      setSpellZones?.(currentZones => recenterConjureAnimalsZonesForPackMove(currentZones, updatedCharacter));
    }

    // Spell-zone area effects on movement
    areaEffectTrackerRef.current.setZones(movementSpellZones);
    const tracker = areaEffectTrackerRef.current;
    // Movement paths are optional so non-map callers can keep their endpoint
    // behavior, but map-driven movement can now preserve each walked tile for
    // Spike Growth-style effects that count travel through a zone.
    const areaTriggerResults = tracker.handleMovement(
      updatedCharacter, action.targetPosition, previousPosition, turnState.currentTurn, action.movementPath
    );

    for (const result of areaTriggerResults) {
      for (const effect of result.effects) {
        switch (effect.type) {
          case 'damage':
            if (effect.dice) {
              let damage = rollDice(effect.dice);
              let saveMessage = '';
              if (effect.requiresSave && effect.saveType) {
                // Area effects can trigger after the original cast. Prefer the
                // caster preserved on the processed trigger effect so saves use
                // the spell's source DC instead of the target's own spell DC.
                const sourceCaster = effect.sourceContext?.casterId
                  ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                  : undefined;
                const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as SavingThrowAbility, dc);
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                  characterId: updatedCharacter.id
                });
                if (saveResult.success) { damage = Math.floor(damage / 2); saveMessage = ' (save)'; }
              }
              updatedCharacter = handleDamage(updatedCharacter, damage, `zone effect${saveMessage}`, effect.damageType, turnState.currentTurn);
            }
            break;

          case 'heal':
            if (effect.dice) {
              const healing = rollDice(effect.dice);
              const newHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + healing);
              const actualHealing = newHP - updatedCharacter.currentHP;
              updatedCharacter = { ...updatedCharacter, currentHP: newHP };
              addDamageNumber(actualHealing, action.targetPosition, 'heal');
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'heal',
                message: `${updatedCharacter.name} heals ${actualHealing} HP from zone effect!`,
                characterId: updatedCharacter.id,
                data: { healing: actualHealing, trigger: result.triggerType || 'on_enter_area' }
              });
            }
            break;

          case 'status_condition':
            if (effect.statusName) {
              let appliedCondition = false;
              let saveMessage = '';

              if (effect.requiresSave && effect.saveType) {
                // Keep area-trigger status saves tied to the original caster
                // when the zone/debuff source context is available. This makes
                // delayed zone conditions behave like immediate spell commands.
                const sourceCaster = effect.sourceContext?.casterId
                  ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                  : undefined;
                const dc = effect.sourceContext?.saveDC ?? calculateSpellDC(sourceCaster || updatedCharacter);
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as SavingThrowAbility, dc);
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                  characterId: updatedCharacter.id
                });
                if (!saveResult.success) {
                  appliedCondition = true;
                } else {
                  // Area-triggered conditions often resolve after the player has
                  // moved into or through a zone. Show successful resistance on
                  // the map immediately so the visible board matches the log.
                  addDamageNumber(0, updatedCharacter.position, 'resist');
                  saveMessage = ' (resisted)';
                }
              } else {
                appliedCondition = true;
              }

              if (appliedCondition && updatedCharacter.conditionImmunities?.includes(effect.statusName as ConditionName)) {
                appliedCondition = false;
                // Immunity prevents the condition just like a successful save,
                // but it communicates a different rule. Use the explicit shared
                // IMMUNE label so the map does not make immunity look like a miss.
                addDamageNumber(0, updatedCharacter.position, 'immune');
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} is immune to ${effect.statusName}`,
                  characterId: updatedCharacter.id,
                  data: { trigger: result.triggerType || 'on_enter_area' }
                });
              }

              if (appliedCondition) {
                const durationRounds = 1;
                const statusEffect = {
                  id: generateId(), name: effect.statusName, type: 'debuff' as const,
                  duration: durationRounds, effect: { type: 'condition' as const }, icon: '💀'
                };
                const activeCondition = {
                  name: effect.statusName,
                  duration: { type: 'rounds' as const, value: durationRounds },
                  appliedTurn: turnState.currentTurn,
                  source: 'zone_effect'
                };
                const applied = applyRuntimeStatusCondition(updatedCharacter, statusEffect, activeCondition);
                updatedCharacter = applied.character;
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} is now ${effect.statusName} from zone effect!`,
                  characterId: updatedCharacter.id,
                  eventClass: getStatusDiscriminator(statusEffect.type)?.eventClass,
                  data: { statusId: applied.appliedStatus.id, condition: applied.appliedCondition, trigger: result.triggerType || 'on_enter_area' }
                });
              } else {
                onLogEntry({
                  id: generateId(), timestamp: Date.now(), type: 'status',
                  message: `${updatedCharacter.name} resists ${effect.statusName}${saveMessage}`,
                  characterId: updatedCharacter.id,
                  data: { trigger: result.triggerType || 'on_enter_area' }
                });
              }
            }
            break;
        }
      }
    }

    return updatedCharacter;
  }, [
    handleOpportunityAttacks, processTileEffects,
    movementDebuffs, setMovementDebuffs,
    spellZones, turnState,
    handleDamage, onLogEntry, addDamageNumber
  ]);

  const processTenserFloatingDiskFollow = useCallback((
    caster: CombatCharacter,
    casterDestination: { x: number; y: number }
  ): void => {
    const disks = characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === 'tensers-floating-disk' &&
      character.summonMetadata?.casterId === caster.id
    );

    for (const disk of disks) {
      const metadata = disk.summonMetadata;
      const travelDetails = metadata?.travelDetails || {};
      const maxLoadPounds = typeof travelDetails.maxLoadPounds === 'number' ? travelDetails.maxLoadPounds : 500;
      const carriedWeightPounds = metadata?.carriedWeightPounds ?? 0;

      if (carriedWeightPounds > maxLoadPounds) {
        onCharacterRemove?.(disk.id);
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${disk.name} disappears because it is overloaded.`,
          characterId: caster.id,
          targetIds: [disk.id],
          data: {
            spellId: metadata?.spellId,
            summonCondition: 'carried_weight_exceeds_limit',
            travelRule: 'maxLoadPounds',
            carriedWeightPounds,
            maxLoadPounds,
            removedSummonIds: [disk.id]
          }
        });
        continue;
      }

      const cannotCrossElevationChangeFeet = typeof travelDetails.cannotCrossElevationChangeFeet === 'number'
        ? travelDetails.cannotCrossElevationChangeFeet
        : 10;
      if (mapData && crossesTenserElevationBarrier(mapData, disk.position, casterDestination, cannotCrossElevationChangeFeet)) {
        onCharacterRemove?.(disk.id);
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${disk.name} cannot follow across the elevation change and disappears.`,
          characterId: caster.id,
          targetIds: [disk.id],
          data: {
            spellId: metadata?.spellId,
            summonCondition: 'cannot_cross_elevation_change',
            travelRule: 'cannotCrossElevationChangeFeet',
            cannotCrossElevationChangeFeet: Boolean(cannotCrossElevationChangeFeet),
            removedSummonIds: [disk.id]
          }
        });
        continue;
      }

      const followDistanceFeet = typeof travelDetails.followDistanceFeet === 'number'
        ? travelDetails.followDistanceFeet
        : metadata?.followDistance ?? 20;
      const immobileWithinFeet = typeof travelDetails.immobileWithinFeet === 'number'
        ? travelDetails.immobileWithinFeet
        : 20;
      const currentDistanceFeet = getGridDistanceFeet(disk.position, casterDestination);

      if (currentDistanceFeet <= immobileWithinFeet) {
        continue;
      }

      const nextPosition = getTenserFollowPosition(disk.position, casterDestination, followDistanceFeet);
      onCharacterUpdate({
        ...disk,
        position: nextPosition
      });
    }
  }, [characters, mapData, onCharacterRemove, onCharacterUpdate, onLogEntry]);

  // ============================================================================
  // Ability Event Emission (post-update side effects)
  // ============================================================================
  // Emits combat events and resolves reactive triggers (e.g., on_target_attack)
  // that fire after an ability is used. Kept separate from the resource-spending
  // path so reactive logic doesn't inflate the main coordinator.
  // ============================================================================
  const handleAbilityEvents = useCallback((
    action: CombatAction,
    updatedCharacter: CombatCharacter
  ): void => {
    if (action.type !== 'ability' || !action.abilityId) return;

    const ability = characters.find(c => c.id === action.characterId)?.abilities.find(a => a.id === action.abilityId);

    combatEvents.emit({
      type: 'unit_cast',
      casterId: updatedCharacter.id,
      spellId: action.abilityId,
      targets: action.targetCharacterIds || []
    });

    /* THE GROUND IMPACT. An explosion-class effect that lands on the 3D map
     * digs a real crater in the voxel arena, and this is where the world learns
     * that it happened: the ability is in hand here, so the classification is
     * made once and travels as a plain fact.
     *
     * It rides the existing spell_effect animation rather than a new channel,
     * because an animation is exactly what this is — a thing that happened at a
     * place at a time, which the renderer consumes and then forgets. The 2D map
     * ignores it (it has no ground to dig), and a cast with no target position
     * has no impact point and produces nothing. */
    if (action.targetPosition) {
      const impact = groundImpactOfAbility(ability as ImpactAbilityLike | undefined);
      if (impact) {
        queueAnimation({
          id: generateId(),
          type: 'spell_effect',
          characterId: action.characterId,
          startPosition: updatedCharacter.position,
          endPosition: action.targetPosition,
          duration: 650,
          startTime: Date.now(),
          data: {
            spellId: action.abilityId,
            areaOfEffect: ability?.areaOfEffect,
            groundImpact: impact,
            targetPositions: [action.targetPosition],
          },
        });
      }
    }

    if (ability && (ability.type === 'attack' || (ability.spell?.attackType && ability.spell.attackType !== 'none'))) {
      action.targetCharacterIds?.forEach(targetId => {
        // The only hit/miss fact is the one the command layer rolled. Both the
        // spell path and the ability path now set `suppressAbilityEvents` on the
        // first pass and replay a `reactiveEventsOnly` action carrying the real
        // `attackResults`, so this resolver never has to synthesize a roll.
        // A producer that reaches here with no attack result publishes an event
        // whose hit/miss is undefined rather than a fabricated one; the
        // hit-only reactive gate below then declines to fire.
        const resolvedAttackResult = action.attackResults?.find(result => result.targetId === targetId);

        combatEvents.emit({
          type: 'unit_attack',
          attackerId: updatedCharacter.id,
          targetId,
          isHit: resolvedAttackResult?.isHit,
          isCrit: resolvedAttackResult?.isCritical,
          attackType: resolvedAttackResult?.attackType
            ?? (ability.type === 'attack' ? 'weapon' : 'spell'),
          weaponType: resolvedAttackResult?.weaponType
            ?? ((ability.range || 0) <= 5 ? 'melee' : 'ranged')
        });

        // Hand the exact resolved result into the reactive resolver. Without
        // this, command-backed or synthesized misses can still fall back to
        // old ability-shape inference and make Armor of Agathys retaliate as
        // though every attack-like action had hit.
        resolveOnTargetAttackReactiveEffects(action, updatedCharacter, targetId, resolvedAttackResult);
      });
    }
  }, [characters, resolveOnTargetAttackReactiveEffects, queueAnimation]);

  // ============================================================================
  // Rider Extra Strikes (agora-db71.24)
  // ============================================================================
  // Three riders grant a second real attack roll. They are resolved here, on the
  // `reactiveEventsOnly` replay, because that envelope is the first moment the
  // executor holds the command-produced hit/miss facts for the attack that
  // triggered them. Not one rider rule lives in this file: the rider modules
  // validate and spend, and `riderExtraStrikes` builds the swing as a real
  // WeaponAttackCommand. Nothing here invents a hit, a miss, or damage.
  // ============================================================================

  /**
   * Publishes one resolved extra strike: the roster it changed, its own combat
   * log, a receipt naming the rider, and the floating damage number. Returns
   * nothing, because the extra strike cannot fail the action that triggered it.
   */
  const publishExtraStrike = useCallback((options: {
    outcome: ExtraStrikeOutcome;
    riderName: string;
    attacker: CombatCharacter;
    targetId: string;
    rosterBefore: CombatCharacter[];
    rejectedReason: string;
  }): void => {
    const { outcome, riderName, attacker, targetId, rosterBefore, rejectedReason } = options;
    // A rider that spent its ledger or reaction before the swing failed still
    // publishes that spend, so the cost is never silently refunded.
    publishRiderChanges(rosterBefore, outcome.state.characters);

    if (!outcome.resolved) {
      if (!outcome.failure && !('riderFailure' in outcome)) return;
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${attacker.name}'s ${riderName} did not resolve.`,
        characterId: attacker.id, targetIds: [targetId],
        data: {
          rejectedReason: `${rejectedReason}:${outcome.failure ?? 'rider_declined'}`,
          ...(outcome.error ? { commandError: outcome.error } : {}),
        },
      });
      return;
    }

    outcome.logEntries.forEach(entry => onLogEntry(entry));

    const targetBefore = rosterBefore.find(character => character.id === targetId);
    const targetAfter = outcome.state.characters.find(character => character.id === targetId);
    const attackResult = outcome.attackResult;

    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: `${attacker.name} ${attackResult?.isHit ? 'hits' : 'misses'} ${targetAfter?.name ?? targetBefore?.name ?? 'the target'} with ${riderName}.`,
      characterId: attacker.id, targetIds: [targetId],
      data: {
        abilityName: outcome.ability?.name,
        isHit: attackResult?.isHit,
        isCrit: attackResult?.isCritical,
      },
    });

    if (!targetBefore || !targetAfter) return;
    const damageDealt = Math.max(
      0,
      (targetBefore.currentHP - targetAfter.currentHP)
      + ((targetBefore.tempHP ?? 0) - (targetAfter.tempHP ?? 0))
    );
    if (attackResult?.isHit && damageDealt > 0) {
      addDamageNumber(damageDealt, targetAfter.position, 'damage');
    } else if (!attackResult?.isHit) {
      addDamageNumber(0, targetAfter.position, 'miss');
    }
  }, [publishRiderChanges, onLogEntry, addDamageNumber]);

  /**
   * Horde Breaker: once on the Hunter's turn, the Attack action carries a second
   * swing at another creature within 5 feet of the original target.
   *
   * The turn-owner gate is the rule, not a convenience: Horde Breaker rides the
   * Hunter's own Attack action, so the same replay envelope produced by an
   * opportunity attack on somebody else's turn must not trigger it.
   */
  const resolveHordeBreakerRider = useCallback(async (
    action: CombatAction,
    actor: CombatCharacter,
  ): Promise<void> => {
    if (turnState.currentCharacterId !== actor.id) return;
    if (!hasHuntersPrey(actor)) return;
    if (getHunterPreyChoice(actor) !== 'horde_breaker') return;
    if (hasUsedHunterPreyThisTurn(actor)) return;

    const originalTargetId = action.targetCharacterIds?.[0];
    if (!originalTargetId) return;

    const rosterBefore = characters;
    const riderState = buildRiderState(rosterBefore);
    const secondary = selectHordeBreakerSecondaryTarget(riderState, {
      rangerId: actor.id,
      originalTargetId,
    });
    // No second creature beside the original target is the ordinary case, not a
    // failure, so it is silent and the ledger stays unspent.
    if (!secondary) return;

    const outcome = await resolveHordeBreakerStrike(
      { ...riderState, mapData: mapData ?? undefined },
      {
        rangerId: actor.id,
        originalTargetId,
        secondaryTargetId: secondary.id,
        abilityId: action.abilityId,
        surprisedTargetIds: action.surprisedCharacterIds,
      },
    );

    publishExtraStrike({
      outcome,
      riderName: 'Horde Breaker',
      attacker: actor,
      targetId: secondary.id,
      rosterBefore,
      rejectedReason: 'horde_breaker',
    });
  }, [characters, turnState, mapData, buildRiderState, publishExtraStrike]);

  /**
   * Giant Killer: when a Large or larger creature misses the Hunter, the Hunter
   * spends a reaction to strike back. The miss is read off the resolved attack
   * results of the swing that just happened, never inferred.
   */
  const resolveGiantKillerRider = useCallback(async (
    action: CombatAction,
    attacker: CombatCharacter,
  ): Promise<void> => {
    const misses = (action.attackResults ?? []).filter(result => !result.isHit);
    for (const miss of misses) {
      const rosterBefore = characters;
      const defender = rosterBefore.find(character => character.id === miss.targetId);
      if (!defender) continue;
      if (!hasHuntersPrey(defender)) continue;
      if (getHunterPreyChoice(defender) !== 'giant_killer') continue;

      const outcome = await resolveGiantKillerStrike(
        { ...buildRiderState(rosterBefore), mapData: mapData ?? undefined },
        {
          rangerId: defender.id,
          targetId: attacker.id,
          targetMissedRangerThisTurn: true,
          surprisedTargetIds: action.surprisedCharacterIds,
        },
      );
      // Size, reach and reaction availability are the rider's call. A decline on
      // any of them is an ordinary non-event and stays silent.
      if (!outcome.resolved && outcome.riderFailure) continue;

      publishExtraStrike({
        outcome,
        riderName: 'Giant Killer',
        attacker: defender,
        targetId: attacker.id,
        rosterBefore,
        rejectedReason: 'giant_killer',
      });
    }
  }, [characters, mapData, buildRiderState, publishExtraStrike]);


  // ============================================================================
  // Main Action Coordinator
  // ============================================================================
  // Validates, spends resources, applies immediate effects, then delegates to
  // the appropriate handler. Each handler is independently testable and carries
  // its own focused dependency set.
  // ============================================================================
  const executeAction = useCallback(async (action: CombatAction): Promise<boolean> => {
    if (action.type === 'end_turn') {
      // Primal Companion commands are one per the ranger's turn. Clearing the
      // tally as the ranger's turn closes is what makes the beast answer once
      // per turn instead of once per combat; nothing else clears it.
      const beforeReset = characters;
      const afterReset = resetPrimalBeastCommands(buildRiderState(beforeReset), action.characterId);
      publishRiderChanges(beforeReset, afterReset.characters);

      await endTurn();
      return true;
    }

    const startCharacter = characters.find(c => c.id === action.characterId);
    if (!startCharacter) return false;
    let resolvedAction = action;
    let aerialMovement: AerialMovementResolution | null = null;

    // Post-command reactive replays use the same action envelope after attack
    // commands have emitted hit/miss facts. They should not spend resources,
    // move the actor, or record a second normal action; they only let reactive
    // effects read the resolved attackResults payload.
    if (action.reactiveEventsOnly) {
      handleAbilityEvents(action, startCharacter);
      // This replay is also where the executor first holds real hit/miss facts
      // for the attack that just resolved, which is exactly what the two Hunter
      // riders trigger on: Horde Breaker on the Hunter's own Attack action, and
      // Giant Killer on a Large+ attacker's miss.
      await resolveHordeBreakerRider(action, startCharacter);
      await resolveGiantKillerRider(action, startCharacter);
      return true;
    }

    // Turn-owned actions must be rejected before resource checks or any
    // mechanics execute. Reactions, legendary actions, and lair actions have
    // their own out-of-turn timing; the free reactive replay returned above is
    // also intentionally exempt. This closes the shared production boundary,
    // so direct ability callers cannot make an inactive actor attack.
    const ownsCurrentTurn = turnState.currentCharacterId === startCharacter.id;
    const isOutOfTurnCost = ['reaction', 'legendary', 'lair'].includes(action.cost.type);
    if (!ownsCurrentTurn && !isOutOfTurnCost) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot perform this action because it is not their turn.`,
        characterId: startCharacter.id,
        data: { rejectedReason: 'not_turn_owner' },
      });
      return false;
    }

    // A long cast is a ceremony, not an instant effect. It is intercepted here,
    // before any resource is spent or any effect is applied, and handed to the
    // ritual runtime; the action returns without touching the target.
    if (action.type === 'ability' && action.abilityId) {
      const castAbility = startCharacter.abilities.find(a => a.id === action.abilityId);
      const ceremonySpell = getCeremonySpell(castAbility);

      if (ceremonySpell) {
        if (!dispatch) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot begin the ritual of ${ceremonySpell.name}: no game state is available to hold it.`,
            characterId: startCharacter.id,
            data: { spellId: ceremonySpell.id, rejectedReason: 'ritual_state_unavailable' },
          });
          return false;
        }

        let ritual: RitualState;
        try {
          ritual = startRitual(startCharacter, ceremonySpell, turnState.currentTurn);
        } catch (error) {
          // RitualManager refuses a spell whose casting time it cannot model.
          // That refusal is reported, never swallowed into a normal cast.
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot begin the ritual of ${ceremonySpell.name}: ${error instanceof Error ? error.message : String(error)}`,
            characterId: startCharacter.id,
            data: { spellId: ceremonySpell.id, rejectedReason: 'ritual_start_failed' },
          });
          return false;
        }

        dispatch({ type: 'START_RITUAL', payload: ritual });
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} begins the ritual of ${ceremonySpell.name}.`,
          characterId: startCharacter.id,
          targetIds: action.targetCharacterIds || [],
          data: { spellId: ceremonySpell.id, spellName: ceremonySpell.name },
        });
        // The action was accepted, so this returns true — but "accepted" and
        // "resolved" are not the same outcome, and a caller that cannot tell
        // them apart casts the spell instantly on top of the ceremony it just
        // started (agora-f821.38; Remy, combat sheet q4, 2026-09-20 23:21Z:
        // "start the ceremony only"). The verdict rides back on the envelope
        // the caller handed in, so every caller that would go on to resolve
        // spell effects can stop here instead.
        action.ritualStarted = true;
        return true;
      }
    }

    // Claim the complete movement delivery before any resource, position, HP,
    // or log mutation. Invalid first delivery remains an atomic rejection, and
    // a simultaneous or later replay of the same stable id is a silent no-op.
    if (action.type === 'move') {
      if (processedMovementActionIdsRef.current.has(action.id)) {
        return true;
      }
      processedMovementActionIdsRef.current.add(action.id);
    }

    if (action.type === 'move' && action.targetPosition) {
      const protectedTiles = startCharacter.summonMetadata?.bloodCircle?.protectedTiles ?? [];
      const movementTiles = action.movementPath?.length
        ? action.movementPath
        : [startCharacter.position, action.targetPosition];
      const crossedBloodCircle = movementTiles.slice(1).some(position => protectedTiles.some(protectedTile =>
        protectedTile.x === position.x && protectedTile.y === position.y
      ));
      if (crossedBloodCircle) {
        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${startCharacter.name} cannot cross its protective blood circle.`,
          characterId: startCharacter.id,
          data: { bloodCircle: 'movement_blocked' }
        });
        return false;
      }
    }

    // Pre-move occupancy check (guard before resource spend)
    if (action.type === 'move' && action.targetPosition) {
      const tauntMove = validateTauntWillingMove(startCharacter, action.targetPosition, characters);
      if (!tauntMove.allowed) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot willingly move more than ${tauntMove.status?.taunt?.leashRangeFeet} feet from ${tauntMove.caster?.name}.`,
          characterId: startCharacter.id,
          targetIds: tauntMove.caster ? [tauntMove.caster.id] : [],
          data: { spellId: tauntMove.status?.sourceSpellId, tauntConstraint: 'willing_movement_leash' }
        });
        return false;
      }

      if (action.movementMode === 'fly') {
        if (
          !mapData
          || typeof action.targetAltitudeFeet !== 'number'
          || !startCharacter.aerialMovement?.isFlying
        ) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot fly because the Move action has no battle map or destination altitude.`,
            characterId: startCharacter.id,
          });
          return false;
        }

        aerialMovement = resolveAerialMovement({
          character: startCharacter,
          destination: action.targetPosition,
          destinationAltitudeFeet: action.targetAltitudeFeet,
          mapData,
          characters,
          route: action.movementPath?.map((position, index, path) => ({
            position,
            altitudeFeet: startCharacter.aerialMovement!.altitudeFeet
              + (action.targetAltitudeFeet! - startCharacter.aerialMovement!.altitudeFeet)
                * (path.length <= 1 ? 1 : index / (path.length - 1)),
          })),
        });
        if (!aerialMovement.allowed) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot complete the aerial Move: ${aerialMovement.reason}`,
            characterId: startCharacter.id,
          });
          return false;
        }

        // The resolver is authoritative for horizontal-plus-vertical cost.
        // Replacing a caller's preview cost prevents stale UI math from under-
        // charging the actual route or charging it a second time.
        resolvedAction = {
          ...action,
          cost: { ...action.cost, movementCost: aerialMovement.costFeet },
          movementPath: aerialMovement.route.map(waypoint => waypoint.position),
        };
      } else {
        const multiplier = getCharacterSizeMultiplier(startCharacter.stats.size);
        for (let dx = 0; dx < multiplier; dx++) {
          for (let dy = 0; dy < multiplier; dy++) {
            const checkPos = { x: action.targetPosition.x + dx, y: action.targetPosition.y + dy };
            const occupyingCombatant = getOccupyingCombatant(characters, action.characterId, checkPos);
            if (occupyingCombatant) {
              onLogEntry({
                id: generateId(), timestamp: Date.now(), type: 'action',
                message: `${startCharacter.name} cannot move there because ${occupyingCombatant.name} is in the way.`,
                characterId: startCharacter.id, targetIds: [occupyingCombatant.id]
              });
              return false;
            }
          }
        }
      }
    }

    // Frenzy (Path of the Berserker) is only legal while the barbarian is
    // actively raging. Gate it before resource payment so a bonus action is
    // never consumed for an attack the subclass does not currently permit.
    if (
      action.type === 'ability'
      && action.abilityId === FRENZY_ABILITY_ID
      && !isRaging(startCharacter)
    ) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot use Frenzy while not raging.`,
        characterId: startCharacter.id,
        data: { rejectedReason: 'frenzy_requires_rage' }
      });
      return false;
    }

    // Ability prerequisites: conditions, disarm, cooldown, use limits, reach,
    // and the authored `Ability.prerequisites` block. This runs before payment
    // for the same reason the Frenzy gate above does — an ability the character
    // may not use must never consume an action, a bonus action, or a use.
    if (action.type === 'ability' && action.abilityId) {
      const gatedAbility = startCharacter.abilities.find(a => a.id === action.abilityId);
      if (gatedAbility) {
        const usability = checkAbilityUsable(startCharacter, gatedAbility);
        if (!usability.usable) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: usability.reason
              ?? `${startCharacter.name} cannot use ${gatedAbility.name} right now.`,
            characterId: startCharacter.id,
            // The refusal carries a typed code of its own. `rejectedReason`
            // names the family of the refusal; `prerequisiteCode` names which
            // prerequisite failed, so no reader parses a string prefix.
            data: {
              rejectedReason: 'ability_prerequisite',
              prerequisiteCode: usability.code ?? 'unspecified',
            },
          });
          return false;
        }
      }
    }

    // --------------------------------------------------------------------
    // Subclass bonus-action riders (agora-db71.14)
    // --------------------------------------------------------------------
    // Cunning Action and the Beast Master command both PAY the bonus action
    // inside their own rider, so they are dispatched before the generic
    // payment below. Dispatching after it would charge the bonus action twice.
    // --------------------------------------------------------------------
    if (action.type === 'ability' && action.abilityId?.startsWith(CUNNING_ACTION_ABILITY_PREFIX)) {
      const optionId = action.abilityId.slice(CUNNING_ACTION_ABILITY_PREFIX.length);
      const beforeCunning = characters;
      const cunning = resolveCunningAction(
        buildRiderState(beforeCunning),
        { rogueId: startCharacter.id, actionType: optionId },
      );
      if (!cunning.resolved) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot take that Cunning Action right now.`,
          characterId: startCharacter.id,
          data: { rejectedReason: `cunning_action:${cunning.failure ?? 'unspecified'}` },
        });
        return false;
      }
      publishRiderChanges(beforeCunning, cunning.state.characters);
      recordAction(action);
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} uses Cunning Action: ${optionId.replace(/_/g, ' ')}.`,
        characterId: startCharacter.id,
        data: { action, actionType: 'bonus_action' },
      });
      return true;
    }

    if (action.type === 'ability' && action.abilityId === PRIMAL_COMPANION_COMMAND_ABILITY_ID) {
      const beastId = action.targetCharacterIds?.[0];
      if (!beastId) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot command a companion without naming one.`,
          characterId: startCharacter.id,
          data: { rejectedReason: 'primal_companion:no_target' },
        });
        return false;
      }
      const beforeCommand = characters;
      const command = resolveBeastCommand(
        buildRiderState(beforeCommand),
        { rangerId: startCharacter.id, beastId },
      );
      if (!command.resolved) {
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${startCharacter.name} cannot command their Primal Companion right now.`,
          characterId: startCharacter.id, targetIds: [beastId],
          data: { rejectedReason: `primal_companion:${command.failure ?? 'unspecified'}` },
        });
        return false;
      }
      publishRiderChanges(beforeCommand, command.state.characters);
      recordAction(action);
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} commands their Primal Companion.`,
        characterId: startCharacter.id, targetIds: [beastId],
        data: { action, actionType: 'bonus_action' },
      });

      // The command grants the beast its action. A second target id names the
      // creature the ranger commands it to strike; the strike is a real attack
      // command, so it rolls against AC and deals its own damage. Commanding
      // without naming a target is a legitimate command of its own and the
      // beast simply does not swing.
      const strikeTargetId = action.targetCharacterIds?.[1];
      if (strikeTargetId) {
        const rosterBeforeStrike = command.state.characters;
        const beast = rosterBeforeStrike.find(character => character.id === beastId);
        const strike = await resolveBeastsStrikeAttack(
          { ...buildRiderState(rosterBeforeStrike), mapData: mapData ?? undefined },
          { beastId, targetId: strikeTargetId },
        );
        if (beast) {
          publishExtraStrike({
            outcome: strike,
            riderName: "Beast's Strike",
            attacker: beast,
            targetId: strikeTargetId,
            rosterBefore: rosterBeforeStrike,
            rejectedReason: 'beasts_strike',
          });
        }
      }
      return true;
    }

    if (!aerialMovement && !canAfford(startCharacter, resolvedAction.cost)) {
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${startCharacter.name} cannot perform this action (not enough resources or action already used).`,
        characterId: startCharacter.id
      });
      return false;
    }

    let updatedCharacter = aerialMovement?.character
      ?? consumeAction(startCharacter, resolvedAction.cost);
    let followUpActionLogs: CombatLogEntry[] = [];

    // Immediate turn-resource effects (Dash, Disengage, Stand Up)
    if (action.type === 'ability' && action.abilityId) {
      const ability = updatedCharacter.abilities.find(a => a.id === action.abilityId);
      if (ability) {
        const result = applyImmediateAbilityTurnEffects(updatedCharacter, ability, turnState.currentTurn);
        updatedCharacter = result.character;
        followUpActionLogs = result.followUpLogs;
      }
    }

    // Sustain concentration
    if (action.type === 'sustain' && updatedCharacter.concentratingOn) {
      updatedCharacter.concentratingOn.sustainedThisTurn = true;
      combatEvents.emit({
        type: 'unit_sustain',
        casterId: updatedCharacter.id,
        spellId: updatedCharacter.concentratingOn.spellId,
        actionType: action.cost.type as 'action' | 'bonus_action' | 'reaction'
      });
      onLogEntry({
        id: generateId(), timestamp: Date.now(), type: 'action',
        message: `${updatedCharacter.name} sustains ${updatedCharacter.concentratingOn.spellName}`,
        characterId: updatedCharacter.id,
        data: { actionType: action.cost.type }
      });

      // Trigger sustain effects (e.g., Witch Bolt damage). This runs through the
      // same selector and damage applicator as the on-target-attack resolver;
      // the sustain action already wrote its own log line, so no extra log entry
      // or floating number is requested here.
      const sustainTriggers = selectReactiveTriggers({
        triggerType: 'on_caster_action',
        casterId: updatedCharacter.id,
      });
      for (const trigger of sustainTriggers) {
        if (!trigger.targetId) continue;
        const target = characters.find(c => c.id === trigger.targetId);
        if (!target) continue;
        applyReactiveTriggerDamage({
          trigger,
          recipient: target,
          damageSource: 'sustained spell',
        });
      }
    }

    // Break free from restraint/grapple
    if (action.type === 'break_free' && action.targetEffectId) {
      updatedCharacter = processRepeatSaves(updatedCharacter, 'on_action', action.targetEffectId);
    }

    // Movement: delegate to full movement handler
    if (action.type === 'move' && action.targetPosition) {
      // A controlled descent to the surface closes through CS32's canonical
      // landing transaction with zero falling distance. This preserves one
      // placement/receipt path without applying fall damage to paid descent.
      if (aerialMovement && !aerialMovement.character.aerialMovement?.isFlying && mapData) {
        const landing = resolveAerialLandingImpact({
          eventId: `${resolvedAction.id}-controlled-landing`,
          character: aerialMovement.character,
          landingPosition: resolvedAction.targetPosition!,
          mapData,
          characters,
          fallDistanceFeet: 0,
        });
        if (landing.status !== 'resolved' || !landing.faller) {
          onLogEntry({
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${startCharacter.name} cannot complete the landing: ${landing.reason}`,
            characterId: startCharacter.id,
          });
          return false;
        }
        updatedCharacter = landing.faller;
      }

      updatedCharacter = await handleMoveExecution(
        startCharacter,
        resolvedAction,
        updatedCharacter,
      );
      processTenserFloatingDiskFollow(updatedCharacter, resolvedAction.targetPosition!);
    }

    onCharacterUpdate(updatedCharacter);
    recordAction(resolvedAction);
    onLogEntry({
      id: generateId(), timestamp: Date.now(), type: 'action',
      message: getActionMessage(resolvedAction, updatedCharacter),
      characterId: updatedCharacter.id,
      // Preserve the full resolved action so history readers can replay or
      // inspect the transaction without re-deriving it from the message.
      data: { action: resolvedAction }
    });
    followUpActionLogs.forEach(entry => onLogEntry(entry));

    // Post-update ability side effects: event emission + reactive triggers.
    // Command-backed attacks can suppress this first pass because their hit or
    // miss is not known until commands execute. useAbilitySystem replays a
    // reactive-only action with the resolved attackResults afterward.
    if (!action.suppressAbilityEvents) {
      handleAbilityEvents(resolvedAction, updatedCharacter);
    }

    return true;
  }, [
    characters, turnState, mapData, endTurn, canAfford, consumeAction,
    onCharacterUpdate, onLogEntry, recordAction, dispatch,
    processRepeatSaves, selectReactiveTriggers, applyReactiveTriggerDamage,
    checkAbilityUsable, buildRiderState, publishRiderChanges, publishExtraStrike,
    resolveHordeBreakerRider, resolveGiantKillerRider,
    handleMoveExecution, handleAbilityEvents, processTenserFloatingDiskFollow
  ]);

  // Encounter initialization and Reset Board need a fresh delivery namespace.
  // Clearing only execution receipts preserves all combat state while allowing
  // the same deterministic fixture id to resolve once in the new encounter.
  const resetActionReceipts = useCallback(() => {
    processedMovementActionIdsRef.current.clear();
  }, []);

  return { executeAction, resetActionReceipts };
};
