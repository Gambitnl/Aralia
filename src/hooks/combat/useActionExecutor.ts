// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:31:20
 * Dependents: components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx, hooks/combat/useTurnManager.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 */
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
  Ability
} from '../../types/combat';
import { Spell } from '../../types/spells';
import {
  generateId,
  getActionMessage,
  rollDice,
  rollD20,
  getOccupiedTiles,
  getCharacterSizeMultiplier,
  isRaging,
  FRENZY_ABILITY_ID
} from '../../utils/combat';
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

  const statusEffects = needsSentinelEffect
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
    statusEffects: statusEffects as any[],
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

    if (!alreadyDisengaged) {
      updatedCharacter = {
        ...updatedCharacter,
        statusEffects: [
          ...updatedCharacter.statusEffects,
          {
            id: 'disengage',
            name: 'Disengage',
            type: 'buff',
            duration: 1,
            effect: { type: 'condition' },
            icon: 'shield'
          }
        ]
      };
    }

    followUpLogs.push({
      id: generateId(),
      timestamp: Date.now(),
      type: 'status',
      message: `${updatedCharacter.name} will not provoke opportunity attacks this turn.`,
      characterId: updatedCharacter.id,
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

const buildLegacyAttackResult = (
  attacker: CombatCharacter,
  target: CombatCharacter,
  ability: Ability
): NonNullable<CombatAction['attackResults']>[number] => {
  // Older ability actions can still reach the action executor without a
  // command-side attack result. Armor of Agathys-style reactions need a real
  // hit/miss fact, so this fallback makes the legacy producer speak the same
  // attackResults contract instead of letting reactive damage infer a hit from
  // the mere existence of an attack-shaped action.
  const d20 = rollD20();
  const weaponType = ability.spell?.attackType === 'ranged' || ability.range > 5
    ? 'ranged'
    : 'melee';
  const attackType = ability.type === 'spell' || (ability.spell?.attackType !== undefined && ability.spell.attackType !== 'none')
    ? 'spell'
    : 'weapon';
  const abilityScore = weaponType === 'ranged'
    ? attacker.stats.dexterity
    : attacker.stats.strength;
  const statBonus = getAbilityModifierValue(abilityScore);
  const proficiencyBonus = ability.isProficient === false
    ? 0
    : Math.max(2, Math.ceil((attacker.level ?? 1) / 4) + 1);
  const attackBonus = ability.attackBonus ?? (statBonus + proficiencyBonus);
  const total = d20 + attackBonus;
  const targetAC = target.armorClass ?? (target.stats as any)?.armorClass ?? 10;

  return {
    targetId: target.id,
    isHit: d20 === 20 || total >= targetAC,
    isCritical: d20 === 20,
    attackType,
    weaponType,
    rollResult: d20,
    total
  };
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

  // Singleton AreaEffectTracker — created once per hook mount, zones updated each use.
  // Avoids allocating a new object on every movement action (previously `new AreaEffectTracker(spellZones)`).
  const areaEffectTrackerRef = useRef<AreaEffectTracker>(new AreaEffectTracker([]));

  // Movement action ids are stable event identities for the entire transaction.
  // Claiming before validation or an asynchronous reaction prompt makes replay
  // a complete no-op: it cannot pay movement again, prompt again, move again,
  // or publish duplicate attack and movement receipts.
  const processedMovementActionIdsRef = useRef<Set<string>>(new Set());

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
    ability: Ability,
    resolvedAttackResult?: NonNullable<CombatAction['attackResults']>[number]
  ): void => {
    const triggers = reactiveTriggers.filter(t =>
      t.targetId === targetId &&
      t.sourceEffect.trigger.type === 'on_target_attack'
    );

    for (const trigger of triggers) {
      const effect = trigger.sourceEffect;
      const attackFilter = (effect.trigger as any)?.attackFilter;
      const explicitAttackResult = resolvedAttackResult ?? action.attackResults?.find(result => result.targetId === targetId);

      // Armor of Agathys stores its "melee attack only" rule in the trigger's
      // attack filter. Prefer resolved attackResults because they describe the
      // roll that actually happened; keep the ability range fallback for older
      // producers that have not filled in attackResults yet.
      const resolvedWeaponType = explicitAttackResult?.weaponType;
      if (
        attackFilter?.weaponType === 'melee'
        && (resolvedWeaponType ? resolvedWeaponType !== 'melee' : ability.range > 2)
      ) continue;
      if (
        attackFilter?.weaponType === 'ranged'
        && (resolvedWeaponType ? resolvedWeaponType !== 'ranged' : ability.range <= 2)
      ) continue;

      // Spell data can also limit a reactive rider to weapon or spell attacks.
      // Opportunity attacks call this helper with an explicit weapon result;
      // command-backed attacks pass through the same payload after command
      // execution records hit/miss facts.
      const resolvedAttackType = explicitAttackResult?.attackType;
      const isSpellAttack = resolvedAttackType
        ? resolvedAttackType === 'spell'
        : ability.type === 'spell' || (ability.spell?.attackType !== undefined && ability.spell.attackType !== 'none');
      const isWeaponAttack = resolvedAttackType
        ? resolvedAttackType === 'weapon'
        : ability.type === 'attack';
      if (attackFilter?.attackType === 'weapon' && !isWeaponAttack) continue;
      if (attackFilter?.attackType === 'spell' && !isSpellAttack) continue;

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

      // Hit-only retaliation must not fire on explicit misses.
      if (explicitAttackResult && !explicitAttackResult.isHit) continue;

      if (effect.type === 'DAMAGE' && effect.damage) {
        const damage = rollDice(effect.damage.dice);
        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'damage',
          message: `${attackingCharacter.name} takes ${damage} damage from reactive effect (on_target_attack)!`,
          characterId: attackingCharacter.id,
          data: { damage, trigger: 'on_target_attack' }
        });
        const updatedReactiveDamageRecipient = handleDamage(attackingCharacter, damage, 'reactive effect', effect.damage.type, turnState.currentTurn);
        onCharacterUpdate(updatedReactiveDamageRecipient);
        addDamageNumber(damage, attackingCharacter.position, 'damage');
      }

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
  }, [characters, reactiveTriggers, handleDamage, onCharacterUpdate, onLogEntry, addDamageNumber, queueAnimation, turnState.currentTurn]);

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

      // Mark the attacker's reaction resource as used for this round of combat.
      onCharacterUpdate({
        ...attacker,
        actionEconomy: {
          ...attacker.actionEconomy,
          reaction: {
            ...attacker.actionEconomy.reaction,
            used: true,
            remaining: 0,
          }
        }
      });

      let hasAdvantage = false;
      let hasDisadvantage = false;
      attacker.modifiers?.advantage.forEach(adv => {
        if (adv.toLowerCase().includes('attack')) hasAdvantage = true;
      });
      attacker.modifiers?.disadvantage.forEach(dis => {
        if (dis.toLowerCase().includes('attack')) hasDisadvantage = true;
      });

      // Replay and scenario controllers can pin the rolled face while ordinary
      // combat keeps the normal advantage/disadvantage roller authoritative.
      const pinnedAttackRoll = suppliedDecision?.attackRoll;
      const d20 = Number.isInteger(pinnedAttackRoll)
        && Number(pinnedAttackRoll) >= 1
        && Number(pinnedAttackRoll) <= 20
        ? Number(pinnedAttackRoll)
        : rollD20({
            advantage: hasAdvantage && !hasDisadvantage,
            disadvantage: hasDisadvantage && !hasAdvantage
          });

      // Calculate which modifier to use: finesse weapons use the higher of Strength or Dexterity.
      // Other weapons use Strength, while ranged weapons default to Dexterity.
      let abilityScore = attacker.stats.strength;
      if (weaponAbility.weapon?.properties?.includes('finesse')) {
        abilityScore = Math.max(attacker.stats.strength, attacker.stats.dexterity);
      } else if (weaponAbility.weapon?.properties?.some(p => p.includes('range') || p === 'finesse')) {
        abilityScore = attacker.stats.dexterity;
      }

      const abilityMod = getAbilityModifierValue(abilityScore);
      const profBonus = weaponAbility.isProficient ? Math.ceil(attacker.level / 4) + 1 : 0;
      const attackBonus = abilityMod + profBonus;
      const targetAC = updatedCharacter.armorClass || updatedCharacter.baseAC || 10;
      const totalRoll = d20 + attackBonus;
      const isCrit = d20 === 20;
      const isHit = isCrit || (d20 !== 1 && totalRoll >= targetAC);
      const opportunityAttackResult = {
        targetId: updatedCharacter.id,
        isHit,
        isCritical: isCrit,
        attackType: 'weapon' as const,
        weaponType: 'melee' as const,
        rollResult: d20,
        total: totalRoll
      };

      if (isHit) {
        combatEvents.emit({
          type: 'unit_attack',
          attackerId: attacker.id,
          targetId: updatedCharacter.id,
          isHit: true,
          isCrit: isCrit,
          attackType: 'weapon',
          weaponType: 'melee'
        });

        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name} hits ${updatedCharacter.name} with Opportunity Attack using ${weaponAbility.name}! (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { isHit: true, isCrit, rollResult: d20 }
        });
        const damageFormula = getOpportunityAttackDamageFormula(weaponAbility);
        if (damageFormula) {
          const pinnedDamageRoll = suppliedDecision?.damageRoll;
          let damage = Number.isFinite(pinnedDamageRoll) && Number(pinnedDamageRoll) >= 0
            ? Math.floor(Number(pinnedDamageRoll))
            : rollDice(damageFormula);
          if (isCrit) damage += rollDice(damageFormula);
          updatedCharacter = handleDamage(
            updatedCharacter, damage, `${attacker.name} (Opportunity Attack)`,
            weaponAbility.effects.find(e => e.type === 'damage')?.damageType,
            turnState.currentTurn
          );
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
        }, attacker, updatedCharacter.id, weaponAbility, opportunityAttackResult);

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
        combatEvents.emit({
          type: 'unit_attack',
          attackerId: attacker.id,
          targetId: updatedCharacter.id,
          isHit: false,
          isCrit: false,
          attackType: 'weapon',
          weaponType: 'melee'
        });

        onLogEntry({
          id: generateId(), timestamp: Date.now(), type: 'action',
          message: `${attacker.name} misses Opportunity Attack against ${updatedCharacter.name} using ${weaponAbility.name}. (${d20}+${attackBonus}=${totalRoll} vs AC ${targetAC})`,
          characterId: attacker.id, targetIds: [updatedCharacter.id],
          data: { isHit: false, isCrit: false, rollResult: d20 }
        });
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
        }, attacker, updatedCharacter.id, weaponAbility, opportunityAttackResult);
        addDamageNumber(0, updatedCharacter.position, 'miss');
      }
    }

    return updatedCharacter;
  }, [characters, mapData, handleDamage, onLogEntry, onCharacterUpdate, addDamageNumber, requestReaction, executeReactionSpell, resolveOnTargetAttackReactiveEffects, turnState.currentTurn]);

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
    let updatedCharacter = {
      ...(resolvedMovementCharacter ?? character),
      position: { ...action.targetPosition },
    };

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
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);
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
                const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);
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

              if (appliedCondition && updatedCharacter.conditionImmunities?.includes(effect.statusName as any)) {
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
  // TODO: Check if ability has ritual tag or long casting time. If so, do not
  //   execute immediately. Instead, call startRitual() and assign the result to
  //   updatedCharacter.currentRitual. See src/systems/rituals/RitualManager.ts
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
        // Command-backed attack actions can now carry the actual hit/miss
        // result from the command layer. Publishing it here keeps all reactive
        // spell listeners on the same event contract instead of forcing Armor
        // of Agathys-style spells to infer hits from combat-log text.
        const target = characters.find(character => character.id === targetId);
        const resolvedAttackResult = action.attackResults?.find(result => result.targetId === targetId)
          ?? (target ? buildLegacyAttackResult(updatedCharacter, target, ability) : undefined);

        // Some legacy ability paths still announce an attack before a command
        // reports the roll result. When that happens, the fallback above makes
        // a small hit/miss payload so every on-target-attack listener sees the
        // same event shape.
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
        resolveOnTargetAttackReactiveEffects(action, updatedCharacter, targetId, ability, resolvedAttackResult);
      });
    }
  }, [characters, resolveOnTargetAttackReactiveEffects, queueAnimation]);

  // ============================================================================
  // Main Action Coordinator
  // ============================================================================
  // Validates, spends resources, applies immediate effects, then delegates to
  // the appropriate handler. Each handler is independently testable and carries
  // its own focused dependency set.
  // ============================================================================
  const executeAction = useCallback(async (action: CombatAction): Promise<boolean> => {
    if (action.type === 'end_turn') {
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
          data: { bloodCircle: 'movement_blocked' } as any
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

      // Trigger sustain effects (e.g., Witch Bolt damage)
      const sustainTriggers = reactiveTriggers.filter(t =>
        t.casterId === updatedCharacter.id &&
        t.sourceEffect.trigger.type === 'on_caster_action'
      );
      for (const trigger of sustainTriggers) {
        const effect = trigger.sourceEffect;
        if (effect.type === 'DAMAGE' && effect.damage && trigger.targetId) {
          const target = characters.find(c => c.id === trigger.targetId);
          if (target) {
            const damage = rollDice(effect.damage.dice);
            onCharacterUpdate(handleDamage(target, damage, 'sustained spell', effect.damage.type, turnState.currentTurn));
          }
        }
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
      data: resolvedAction as any
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
    onCharacterUpdate, onLogEntry, recordAction,
    handleDamage, processRepeatSaves, reactiveTriggers,
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
