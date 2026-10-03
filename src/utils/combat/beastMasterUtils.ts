/**
 * Beast Master (Ranger) Primal Companion binding, scaling, and command economy.
 *
 * The level-3 `primal_companion` grant needs a production binding — the ranger's
 * companion is not a generic spell summon. This file owns:
 *   - the three authored forms (Beast of the Land/Sea/Sky) and their scaling
 *     (HP 5 + 5×ranger level, AC 13 + proficiency bonus),
 *   - `bindPrimalBeast`, which binds a constructed beast to its ranger and marks
 *     the `summonMetadata` command economy (Bonus Action command, 1/turn),
 *   - `resolveBeastCommand`, which validates ownership and spends the ranger's
 *     bonus action to grant the beast its commanded action, and
 *   - `validateBeastsStrike`, the reach and form rules for the beast's melee
 *     attack. The attack itself is a command, not a transaction here.
 * All of it is gated on the `primal_companion` ability so a non-Beast-Master
 * ranger can never issue a Primal Beast command.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/10/2026, 00:42:29
 * Dependents: hooks/combat/useActionExecutor.ts, systems/combat/riderExtraStrikes.ts, utils/combat/combatUtils.ts, utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { AbilityEffect, CombatCharacter, CombatState } from '../../types/combat';
import { calculateProficiencyBonus } from '../character/savingThrowUtils';

export const PRIMAL_COMPANION_FEATURE_ID = 'primal_companion';
export const PRIMAL_BEAST_STRIKE_ABILITY_ID = 'primal_beast_strike';
export const BEAST_COMMAND_COST = 'bonus_action' as const;

export type PrimalBeastForm = NonNullable<CombatCharacter['primalBeastForm']>;

export interface PrimalBeastStatBlock {
  form: PrimalBeastForm;
  name: string;
  /** Base armor class before the ranger's proficiency bonus is added. */
  baseAc: number;
  /** Flat hit point floor before per-level scaling. */
  hpBase: number;
  /** Hit points gained per ranger level. */
  hpPerLevel: number;
  /** Walking speed in feet. */
  speedFeet: number;
  movementMode: 'walk' | 'swim' | 'fly';
  /**
   * Swim or fly speed in feet for a beast whose movement mode is not walking.
   * A Beast of the Sea walks 5 feet and swims; a Beast of the Sky walks 10 feet
   * and flies. Without this the engine would read the single walking speed and
   * the beast could never leave the ground or the shallows.
   */
  extraSpeedFeet?: number;
  strikeDice: string;
  strikeDamageType: NonNullable<AbilityEffect['damageType']>;
  /** Flat bonus on Beast's Strike damage beyond proficiency. */
  strikeModifier: number;
  reachFeet: number;
}

export const PRIMAL_BEAST_FORMS: Record<PrimalBeastForm, PrimalBeastStatBlock> = {
  land: {
    form: 'land',
    name: 'Beast of the Land',
    baseAc: 13,
    hpBase: 5,
    hpPerLevel: 5,
    speedFeet: 40,
    movementMode: 'walk',
    strikeDice: '1d8',
    strikeDamageType: 'piercing',
    strikeModifier: 2,
    reachFeet: 5,
  },
  sea: {
    form: 'sea',
    name: 'Beast of the Sea',
    baseAc: 13,
    hpBase: 5,
    hpPerLevel: 5,
    speedFeet: 5,
    movementMode: 'swim',
    extraSpeedFeet: 60,
    strikeDice: '1d8',
    strikeDamageType: 'piercing',
    strikeModifier: 2,
    reachFeet: 5,
  },
  sky: {
    form: 'sky',
    name: 'Beast of the Sky',
    baseAc: 13,
    hpBase: 4,
    hpPerLevel: 4,
    speedFeet: 10,
    movementMode: 'fly',
    extraSpeedFeet: 60,
    strikeDice: '1d6',
    strikeDamageType: 'piercing',
    strikeModifier: 2,
    reachFeet: 5,
  },
};

export function isPrimalBeastForm(id: string): id is PrimalBeastForm {
  return id in PRIMAL_BEAST_FORMS;
}

// ============================================================================
// Scaling
// ============================================================================

export function calculatePrimalBeastMaxHp(rangerLevel: number, form: PrimalBeastForm): number {
  const statBlock = PRIMAL_BEAST_FORMS[form];
  return statBlock.hpBase + statBlock.hpPerLevel * Math.max(1, Math.floor(rangerLevel));
}

export function calculatePrimalBeastAc(rangerLevel: number, form: PrimalBeastForm): number {
  return PRIMAL_BEAST_FORMS[form].baseAc + calculateProficiencyBonus(rangerLevel);
}

export function calculatePrimalBeastStrikeModifier(rangerLevel: number, form: PrimalBeastForm): number {
  return PRIMAL_BEAST_FORMS[form].strikeModifier + calculateProficiencyBonus(rangerLevel);
}

// ============================================================================
// Binding
// ============================================================================

export function hasPrimalCompanion(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === PRIMAL_COMPANION_FEATURE_ID);
}

/**
 * Binds a constructed beast token to its ranger. The caller supplies a base
 * `CombatCharacter` (from the summon pipeline); this marks ownership, scales HP,
 * AC, and speed to the ranger's level, records the chosen form, and attaches the
 * Beast's Strike ability.
 */
export function bindPrimalBeast(
  ranger: CombatCharacter,
  beast: CombatCharacter,
  form: PrimalBeastForm,
): CombatCharacter {
  const level = Math.max(1, Math.floor(ranger.level ?? 1));
  const statBlock = PRIMAL_BEAST_FORMS[form];
  const maxHP = calculatePrimalBeastMaxHp(level, form);
  const armorClass = calculatePrimalBeastAc(level, form);

  // A swimming or flying beast keeps its small walking speed and carries the
  // real movement speed as an extra speed, which is where the movement engine
  // reads fly and swim from.
  const extraMovementSpeeds = statBlock.movementMode === 'walk'
    ? beast.stats.extraMovementSpeeds
    : {
      ...(beast.stats.extraMovementSpeeds ?? {}),
      [statBlock.movementMode]: statBlock.extraSpeedFeet,
    };

  return {
    ...beast,
    name: beast.name || statBlock.name,
    level,
    maxHP,
    currentHP: maxHP,
    armorClass,
    baseAC: armorClass,
    isSummon: true,
    primalBeastForm: form,
    stats: {
      ...beast.stats,
      speed: statBlock.speedFeet,
      extraMovementSpeeds,
    },
    summonMetadata: {
      casterId: ranger.id,
      spellId: PRIMAL_COMPANION_FEATURE_ID,
      entityType: 'primal_beast',
      formName: statBlock.name,
      sourceName: 'Primal Companion',
      persistent: true,
      dismissAction: 'free',
      commandCost: BEAST_COMMAND_COST,
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'shared',
      actionPermissions: { canAttack: true, obeysCasterCommands: true },
    },
    abilities: [
      ...(beast.abilities ?? []),
      {
        id: PRIMAL_BEAST_STRIKE_ABILITY_ID,
        name: "Beast's Strike",
        description: 'Melee attack with the beast\'s natural weapons.',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: Math.max(1, Math.round(statBlock.reachFeet / 5)),
        // The strike carries its own damage, so the attack command layer can
        // resolve it as an ordinary weapon attack: roll against AC, then roll
        // this damage. An effect-less attack ability would hit for nothing.
        effects: [{
          type: 'damage',
          dice: `${statBlock.strikeDice}+${calculatePrimalBeastStrikeModifier(level, form)}`,
          damageType: statBlock.strikeDamageType,
        }],
        isProficient: true,
      },
    ],
  };
}

export function isBoundPrimalBeast(beast: CombatCharacter, rangerId: string): boolean {
  return beast.isSummon === true
    && beast.summonMetadata?.casterId === rangerId
    && beast.primalBeastForm !== undefined;
}

// ============================================================================
// Command Economy
// ============================================================================
// The 2024 Beast Master commands the companion as a Bonus Action, once per
// turn. Spending the ranger's bonus action increments the beast's per-turn
// command tally so a caller cannot command the same beast twice in one turn.
// ============================================================================

export type BeastCommandFailure =
  | 'ranger_missing'
  | 'beast_missing'
  | 'not_bound_to_ranger'
  | 'commands_exhausted'
  | 'no_bonus_action';

export interface BeastCommandResult {
  state: CombatState;
  resolved: boolean;
  failure?: BeastCommandFailure;
  commandsUsedThisTurn?: number;
}

export function resolveBeastCommand(
  state: CombatState,
  request: { rangerId: string; beastId: string },
): BeastCommandResult {
  const ranger = state.characters.find(character => character.id === request.rangerId);
  if (!ranger) return { state, resolved: false, failure: 'ranger_missing' };
  if (!hasPrimalCompanion(ranger)) return { state, resolved: false, failure: 'not_bound_to_ranger' };

  const beast = state.characters.find(character => character.id === request.beastId);
  if (!beast) return { state, resolved: false, failure: 'beast_missing' };
  if (!isBoundPrimalBeast(beast, ranger.id)) return { state, resolved: false, failure: 'not_bound_to_ranger' };

  const commandsPerTurn = beast.summonMetadata?.commandsPerTurn ?? 1;
  const commandsUsedThisTurn = beast.summonMetadata?.commandsUsedThisTurn ?? 0;
  if (commandsUsedThisTurn >= commandsPerTurn) {
    return { state, resolved: false, failure: 'commands_exhausted' };
  }

  if (ranger.actionEconomy.bonusAction.used || ranger.actionEconomy.bonusAction.remaining <= 0) {
    return { state, resolved: false, failure: 'no_bonus_action' };
  }

  const nextRanger: CombatCharacter = {
    ...ranger,
    actionEconomy: {
      ...ranger.actionEconomy,
      bonusAction: {
        used: true,
        remaining: ranger.actionEconomy.bonusAction.remaining - 1,
      },
    },
  };
  const nextBeast: CombatCharacter = {
    ...beast,
    summonMetadata: {
      ...(beast.summonMetadata ?? {}),
      casterId: beast.summonMetadata?.casterId ?? ranger.id,
      spellId: beast.summonMetadata?.spellId ?? PRIMAL_COMPANION_FEATURE_ID,
      commandCost: BEAST_COMMAND_COST,
      commandsPerTurn,
      commandsUsedThisTurn: commandsUsedThisTurn + 1,
    },
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => {
        if (character.id === ranger.id) return nextRanger;
        if (character.id === beast.id) return nextBeast;
        return character;
      }),
    },
    resolved: true,
    commandsUsedThisTurn: commandsUsedThisTurn + 1,
  };
}

// ============================================================================
// Beast's Strike
// ============================================================================

export type BeastsStrikeFailure =
  | 'beast_missing'
  | 'not_a_primal_beast'
  | 'target_missing'
  | 'target_out_of_reach';

export interface BeastsStrikeValidation {
  resolved: boolean;
  failure?: BeastsStrikeFailure;
}

/**
 * Beast's Strike rules, and only the rules: the striker must be a bound Primal
 * Beast and the target must stand inside the form's reach.
 *
 * This deliberately rolls nothing and applies nothing. Beast's Strike is an
 * attack, so its roll, its AC check, and its damage belong to the attack
 * command layer, which resolves the beast's own `primal_beast_strike` ability.
 * `systems/combat/riderExtraStrikes.resolveBeastsStrikeAttack` is the wired
 * path that pairs this validation with that command.
 */
export function validateBeastsStrike(
  state: CombatState,
  request: { beastId: string; targetId: string },
): BeastsStrikeValidation {
  const beast = state.characters.find(character => character.id === request.beastId);
  if (!beast) return { resolved: false, failure: 'beast_missing' };
  if (beast.primalBeastForm === undefined) return { resolved: false, failure: 'not_a_primal_beast' };

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { resolved: false, failure: 'target_missing' };

  const statBlock = PRIMAL_BEAST_FORMS[beast.primalBeastForm];
  const reachTiles = Math.max(1, Math.round(statBlock.reachFeet / 5));
  const dx = target.position.x - beast.position.x;
  const dy = target.position.y - beast.position.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > reachTiles) {
    return { resolved: false, failure: 'target_out_of_reach' };
  }

  return { resolved: true };
}

// ============================================================================
// Turn Reset
// ============================================================================
// `commandsUsedThisTurn` is a per-turn tally, so something has to clear it. The
// turn manager calls this when the ranger's turn begins; without it the beast
// answers exactly one command per combat instead of one per turn.
// ============================================================================

/** Clears the per-turn command tally on every Primal Beast bound to this ranger. */
export function resetPrimalBeastCommands(state: CombatState, rangerId: string): CombatState {
  const ranger = state.characters.find(character => character.id === rangerId);
  if (!ranger) return state;

  let changed = false;
  const characters: CombatCharacter[] = state.characters.map(character => {
    if (!isBoundPrimalBeast(character, rangerId)) return character;
    if ((character.summonMetadata?.commandsUsedThisTurn ?? 0) === 0) return character;
    changed = true;
    const reset: CombatCharacter = {
      ...character,
      summonMetadata: {
        ...(character.summonMetadata ?? {}),
        casterId: character.summonMetadata?.casterId ?? rangerId,
        spellId: character.summonMetadata?.spellId ?? PRIMAL_COMPANION_FEATURE_ID,
        commandsUsedThisTurn: 0,
      },
    };
    return reset;
  });

  return changed ? { ...state, characters } : state;
}
