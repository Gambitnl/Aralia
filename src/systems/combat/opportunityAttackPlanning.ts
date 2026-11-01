/**
 * @file opportunityAttackPlanning.ts
 * Selects reaction candidates and computes Sentinel stops without prompting.
 * Receives explicit state and receipt sources; does not prompt, publish React
 * state, claim actions or emit events. The hook keeps those timing boundaries.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:43
 * Dependents: hooks/combat/actionExecutor/opportunityAttackFlow.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatAction, Ability, StatusEffect } from "../../types/combat";
import { calculateMovementTotal } from "../../utils/combat/actionEconomyUtils";

export const SENTINEL_STOP_EFFECT_ID = 'sentinel_stop';


export const SENTINEL_STOP_EFFECT_NAME = 'Sentinel Stop';



export const hasFeat = (character: CombatCharacter, featName: string): boolean => {
  return character.feats?.some(feat => feat.toLowerCase() === featName.toLowerCase()) === true;
};



export const hasSentinelFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'sentinel');
};



export const hasWarCasterFeat = (character: CombatCharacter): boolean => {
  return hasFeat(character, 'war caster');
};



export const isWarCasterEligibleSpell = (ability: Ability): boolean => {
  // War Caster only swaps in spells that still behave like a single-target
  // action-cast spell. Reaction-cast spells already consume the same resource
  // and should stay out of the OA substitution list.
  return ability.type === 'spell'
    && ability.cost.type === 'action'
    && ability.spell !== undefined
    && (ability.targeting === 'single_enemy' || ability.targeting === 'single_any');
};



export const applySentinelStop = (character: CombatCharacter): CombatCharacter => {
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



// ============================================================================
// Opportunity Attack Damage Helpers
// ============================================================================
// Opportunity attacks use monster and weapon abilities from several data
// sources. Some store damage as dice and others store a flat value, so this
// helper normalizes both shapes before the attack rolls damage.
// ============================================================================

export const getOpportunityAttackDamageFormula = (ability: Ability): string | null => {
  const damageEffect = ability.effects.find(effect => effect.type === 'damage');
  if (!damageEffect) return null;

  if (damageEffect.dice) return damageEffect.dice;

  if (typeof damageEffect.value === 'number' && Number.isFinite(damageEffect.value)) {
    return String(Math.max(0, damageEffect.value));
  }

  return null;
};

export function selectOpportunityAttackOptions(attacker: CombatCharacter, allowReactionSpell: boolean): { reactionWeapons: Ability[]; warCasterSpells: Ability[] } {


      // A movement reaction grants one melee strike, not the monster's full
      // Multiattack action. Natural attacks have no equipment reference, so
      // include their authored short-range attack leaves alongside weapons.
      const meleeWeapons = attacker.abilities.filter(a =>
        a.type === 'attack' && a.range > 0 && a.range <= 2
        && !a.multiattackCount && !a.subAttackIds?.length
        && a.id !== 'unarmed_strike'
      );
      const unarmedStrike = attacker.abilities.find(a => a.id === 'unarmed_strike');
      const warCasterSpells = hasWarCasterFeat(attacker) && allowReactionSpell
        ? attacker.abilities.filter(isWarCasterEligibleSpell)
        : [];

      // Create a list of available weapons/strikes for the reaction prompt.
      const reactionWeapons: Ability[] = [...meleeWeapons];
      if (unarmedStrike) {
        reactionWeapons.push(unarmedStrike);
      }

      // No eligible strike means no weapon reaction. Falling back to an
      // unrelated ability can turn a retreat into a spell or a full action.
  return { reactionWeapons, warCasterSpells };
}

// ---------------------------------------------------------------------------
// C2 (agora-9ed9.2): pure decisions lifted out of the effectful
// hooks/combat/actionExecutor/opportunityAttackFlow.ts. Each returns data; the
// flow still owns the prompt, the command run, the logs and the events.
// ---------------------------------------------------------------------------

type OpportunityAttackDecision = NonNullable<CombatAction['opportunityAttackDecisions']>[string];
type OpportunityAttackResult = NonNullable<CombatAction['attackResults']>[number];

/**
 * Die sources for a replay's pinned rolls. Replay and scenario controllers pin
 * the dice. A pin is expressed as a die source rather than a pre-computed
 * result, so the command keeps owning the roll and still lands on the requested
 * face.
 *
 * `damageRoll` pins the face every damage die of this attack comes up on.
 * A die source cannot know how many sides it is being asked for, so the
 * fraction is derived from this weapon's own damage die: rollDamage maps a
 * source value v to Math.floor(v * sides) + 1, and (face - 0.5) / sides
 * lands on `face`. A single-die weapon therefore still deals exactly the
 * pinned number, which is what every existing fixture pins.
 */
export function opportunityAttackRollSources(
  suppliedDecision: OpportunityAttackDecision | undefined,
  weaponAbility: Ability,
): { attackRollRng: (() => number) | undefined; damageRng: (() => number) | undefined } {
  const pinnedAttackRoll = suppliedDecision?.attackRoll;
  const attackRollRng = Number.isInteger(pinnedAttackRoll)
    && Number(pinnedAttackRoll) >= 1
    && Number(pinnedAttackRoll) <= 20
    ? () => (Number(pinnedAttackRoll) - 0.5) / 20
    : undefined;

  const pinnedDamageRoll = suppliedDecision?.damageRoll;
  const weaponDieSides = Number(
    /d(\d+)/i.exec(getOpportunityAttackDamageFormula(weaponAbility) ?? '')?.[1] ?? 0
  );
  const damageRng = Number.isFinite(pinnedDamageRoll)
    && Number(pinnedDamageRoll) >= 1
    && weaponDieSides > 0
    ? () => (Math.min(Number(pinnedDamageRoll), weaponDieSides) - 0.5) / weaponDieSides
    : undefined;

  return { attackRollRng, damageRng };
}

/** The responder after paying for the swing: the reaction is spent whatever the swing does. */
export function spendOpportunityAttackReaction(attacker: CombatCharacter): CombatCharacter {
  return {
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
}

/**
 * The reactive-events-only action an Opportunity Attack hands to the on-attack
 * reactive resolver, identical for a hit and a miss. The id and timestamp come
 * from the caller so its generateId-then-Date.now order stays unchanged.
 */
export function buildOpportunityAttackReactiveAction(
  attacker: CombatCharacter,
  weaponAbility: Ability,
  target: CombatCharacter,
  attackResult: OpportunityAttackResult,
  stamp: { id: string; timestamp: number },
): CombatAction {
  return {
    id: stamp.id,
    characterId: attacker.id,
    type: 'ability',
    abilityId: weaponAbility.id,
    targetCharacterIds: [target.id],
    targetPosition: target.position,
    cost: { type: 'free' },
    timestamp: stamp.timestamp,
    attackResults: [attackResult],
    reactiveEventsOnly: true
  };
}
