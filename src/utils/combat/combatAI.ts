/**
 * This file acts as the artificial intelligence brain for combatants during tactical battles.
 *
 * Whenever an enemy, companion, or auto-controlled party member takes their turn, this system
 * evaluates the entire battlefield: it assesses enemy positions, detects downed or injured allies,
 * manages frontline threat positioning, budgets spell slots, and selects the best move or ability
 * to perform.
 *
 * Called by: useCombatAI.ts (turn execution loop) and useTurnManager.ts (legendary actions)
 * Depends on: lineOfSight for target visibility, TargetValidationUtils for taxonomy restrictions,
 * and combatUtils for AoE geometry and distances.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: hooks/combat/turnManager/useTurnLifecycle.ts, hooks/combat/useCombatAI.ts, utils/combat/index.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, CombatAction, BattleMapData, Ability, AbilityEffect, Position, BattleMapTile, SpellSlots } from '../../types/combat';
import { computeAoETiles, getDistance, generateId, resolveAreaDefinition, getOccupiedTiles, getCharacterDistance } from './combatUtils';
import { hasLineOfSight } from '../spatial/lineOfSight';
import { TargetValidationUtils } from '../../systems/spells/targeting/TargetValidationUtils';
import { logger } from '../core/logger';
import {
  deriveEncounterStance,
  PLAYER_ACTOR_ID,
  type EncounterStanceResult,
} from '../../systems/social/npcWitnessMemory';
import type { NpcMemory } from '../../types/world';

// ============================================================================
// Scoring Weights & Configuration
// ============================================================================
// Scoring weights used to prioritize AI actions.
// These constants act as "knobs" to tune the AI's behavior.
//
// - Positive values encourage behavior.
// - Negative values discourage behavior.
// - Higher magnitude means stronger preference.
// ============================================================================

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
  /** Massive bonus for triage healing to revive a downed ally (0 HP) back into combat. */
  TRIAGE_REVIVE_DOWNED: 180,
  /** High priority emergency healing for critically wounded allies (<30% HP). */
  TRIAGE_CRITICAL_HEAL: 65,
  /** Moderate priority healing for wounded allies (<50% HP). */
  TRIAGE_WOUNDED_HEAL: 25,
  /** Priority bonus for applying protective buffs (e.g. Bless, Shield of Faith) to party carries. */
  BUFF_PROTECT_CARRY: 45,
  /** Bonus for applying team buffs in early combat rounds when protection is most needed. */
  EARLY_COMBAT_BUFF_BONUS: 25,
  /** Penalty per spell slot level above 1 when using high-level spell slots on trivial foes. */
  SPELL_SLOT_OVERKILL_PENALTY: -35,
  /** Bonus for tanks/frontliners positioning to intercept melee hostiles before they reach backliners. */
  INTERCEPT_MELEE_THREAT_BONUS: 20,
  /** Peeling bonus when an ally attacks a melee enemy threatening a vulnerable backliner. */
  PEEL_THREAT_BONUS: 18,
  /** Value of putting one summoned combatant on the field: it buys a whole extra action each round. */
  SUMMON_BASE: 55,
  /** Value of each summoned body beyond the first in a single cast. */
  SUMMON_PER_EXTRA_CREATURE: 25,
  /** Bonus for a summon the spell data marks persistent, which survives the end of the spell. */
  SUMMON_PERSISTENT_BONUS: 10,
};

// ============================================================================
// Witness-Driven Encounter Stance (agora-f58b)
// ============================================================================
// `src/systems/social/npcWitnessMemory.ts` models what an NPC saw the player do
// and turns it into an `EncounterStance`: negotiate, surrender, flee,
// fight_to_death or stand_ground. That model shipped without a combat reader,
// so a bandit who watched the player butcher three surrendering prisoners still
// walked cheerfully into melee. This section is the reader.
//
// The division of labour is deliberate. `deriveEncounterStance` owns the belief
// maths and is deterministic by design — it takes no RNG and no battlefield. The
// one battlefield fact it needs, `cornered`, is exactly the thing only the
// planner can see, so the planner computes it here and hands it over.
// ============================================================================

/** Witness memory for one AI combatant, as stored in `GameState.npcMemory`. */
export interface EncounterStanceInput {
  /** The combatant's own memory record. */
  memory: NpcMemory;
  /** Current game day, so witness records decay correctly. */
  gameDay: number;
  /** Whose reputation the stance is about. Defaults to the player. */
  actorId?: string;
}

/** Optional per-turn context. Absent means the planner behaves exactly as before. */
export interface CombatTurnOptions {
  /** Supply to let witness memory override tactical scoring. */
  stance?: EncounterStanceInput;
}

/**
 * A creature needs somewhere to run before fleeing is a real option. A reachable
 * tile counts as an escape route only when it both increases the distance to the
 * nearest enemy and is not itself in an enemy's reach, because stepping from one
 * engaged square to another engaged square is not an escape.
 */
export const CORNERED_ENEMY_REACH = 1;

/** Fewer escape routes than this and there is nowhere worth running to. */
export const CORNERED_ESCAPE_ROUTE_MINIMUM = 2;

/**
 * Counts the reachable tiles that genuinely take this creature away from the
 * fight. Exported so combat diagnostics can show why a creature stood and died.
 */
export function countEscapeRoutes(
  character: CombatCharacter,
  enemies: CombatCharacter[],
  reachableTiles: Map<string, ReachableTilePlan>
): number {
  if (enemies.length === 0) return reachableTiles.size;

  const currentNearest = Math.min(
    ...enemies.map(enemy => getDistance(character.position, enemy.position))
  );

  let routes = 0;
  reachableTiles.forEach(({ tile }) => {
    const distances = enemies.map(enemy => getDistance(tile.coordinates, enemy.position));
    const nearest = Math.min(...distances);
    if (nearest > currentNearest && nearest > CORNERED_ENEMY_REACH) {
      routes += 1;
    }
  });
  return routes;
}

/**
 * Resolves the stance this combatant opens the turn with, feeding the witness
 * model the battlefield fact it cannot see for itself.
 */
export function resolveEncounterStance(
  character: CombatCharacter,
  enemies: CombatCharacter[],
  reachableTiles: Map<string, ReachableTilePlan>,
  input: EncounterStanceInput
): EncounterStanceResult {
  const cornered =
    countEscapeRoutes(character, enemies, reachableTiles) < CORNERED_ESCAPE_ROUTE_MINIMUM;
  return deriveEncounterStance(input.memory, input.gameDay, {
    cornered,
    actorId: input.actorId ?? PLAYER_ACTOR_ID,
  });
}

// ============================================================================
// Allied Companion & Tactical Role Helpers
// ============================================================================
// These helper functions identify tactical roles (tanks, vulnerable casters,
// party carries) and spell types (protective buffs, high-level slots) so that
// AI-controlled allies can make smart party decisions.
// ============================================================================

/**
 * Checks whether a combatant is on the player or neutral team (an ally/companion).
 */
export function isAlliedCombatant(character: CombatCharacter): boolean {
  return character.team === 'player' || character.team === 'neutral';
}

/**
 * Checks if a combatant is suited for frontline tanking / interposing.
 * Tanks have high armor, high health, or martial frontline classes (Fighter, Paladin, Barbarian).
 */
export function isTankOrFrontliner(character: CombatCharacter): boolean {
  const className = (character.class?.name || character.class?.id || '').toLowerCase();
  const isFrontlineClass = ['fighter', 'paladin', 'barbarian', 'cleric'].includes(className);
  const isHighHealthOrArmor = character.maxHP >= 24 || (character.armorClass !== undefined && character.armorClass >= 16);
  // Generated and JSON-authored stat blocks predate `AbilityType` and still ship
  // a literal 'melee' type, so the runtime check keeps both spellings. The cast
  // states that on purpose rather than letting the comparison read as a bug.
  const hasMeleeFocus = character.abilities.some(
    a => (a.type === 'attack' || (a.type as string) === 'melee') && a.range <= 2
  );
  return isFrontlineClass || (isHighHealthOrArmor && hasMeleeFocus);
}

/**
 * Checks if a combatant is a squishy backliner or concentrating caster that needs protection.
 * Vulnerable backliners include Wizards, Sorcerers, Warlocks, Bards, Druids, or characters currently concentrating.
 */
export function isVulnerableBackliner(character: CombatCharacter): boolean {
  const className = (character.class?.name || character.class?.id || '').toLowerCase();
  const isCasterClass = ['wizard', 'sorcerer', 'warlock', 'bard', 'druid'].includes(className);
  const isConcentrating = !!character.concentratingOn;
  const isRangedAttacker = character.abilities.some(a => a.range >= 4);
  const isLowArmorOrHp = (character.armorClass !== undefined && character.armorClass <= 14) || (character.currentHP / character.maxHP <= 0.4);
  return isConcentrating || isCasterClass || (isRangedAttacker && isLowArmorOrHp);
}

/**
 * Checks if an enemy relies primarily on melee attacks (range <= 2) to threaten targets.
 */
export function isMeleeHostile(character: CombatCharacter): boolean {
  const hasRanged = character.abilities.some(a => (a.type === 'attack' || a.type === 'spell') && a.range > 2);
  return !hasRanged || character.abilities.some(a => a.range <= 2);
}

/**
 * Checks if a combatant is a primary party damage carry or key asset to protect.
 */
export function isPartyCarry(character: CombatCharacter): boolean {
  const className = (character.class?.name || character.class?.id || '').toLowerCase();
  const isCarryClass = ['fighter', 'paladin', 'barbarian', 'rogue', 'sorcerer', 'warlock'].includes(className);
  const hasHighDamage = character.abilities.some(a => a.effects.some(e => e.type === 'damage' && (e.value || 0) >= 12));
  return isCarryClass || hasHighDamage || !!character.concentratingOn;
}

/**
 * Identifies if an ability is a protective or enhancement buff (e.g. Bless, Shield of Faith, Aid).
 */
export function isProtectiveBuffAbility(ability: Ability): boolean {
  const nameLower = ability.name.toLowerCase();
  const protectiveNames = [
    'bless',
    'shield of faith',
    'mage armor',
    'aid',
    'haste',
    'protection from evil and good',
    'stoneskin',
    'sanctuary',
    'heroism',
    'barkskin',
    'enhance ability',
  ];
  const matchesName = protectiveNames.some(p => nameLower.includes(p));
  const hasBuffStatus = ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  return matchesName || hasBuffStatus;
}

/**
 * Checks if a character already has a matching active buff to prevent wasteful re-casting.
 */
export function hasActiveBuff(target: CombatCharacter, ability: Ability): boolean {
  const abilityName = ability.name.toLowerCase();
  const statusNames = target.statusEffects.map(s => String(s.name).toLowerCase());
  const conditionNames = (target.conditions || []).map(c => String(c.name).toLowerCase());

  if (abilityName.includes('bless') && (statusNames.includes('blessed') || conditionNames.includes('blessed') || statusNames.includes('bless'))) {
    return true;
  }
  if (abilityName.includes('shield of faith') && (statusNames.includes('shield of faith') || conditionNames.includes('shield of faith'))) {
    return true;
  }
  return statusNames.some(s => s.includes(abilityName)) || conditionNames.some(c => c.includes(abilityName));
}

/**
 * Calculates spell slot budgeting penalty or bonus.
 * Avoids wasting high-level slots (level 2+) on trivial/dying foes when low-level options suffice,
 * while rewarding high-level slots against healthy, high-threat foes or multi-target groups.
 */
export function evaluateSpellSlotBudget(
  caster: CombatCharacter,
  target: CombatCharacter | null,
  ability: Ability,
  impactedEnemiesCount: number = 1
): number {
  const slotLevel = ability.cost?.spellSlotLevel ?? ability.spell?.level ?? 0;
  // Cantrips (level 0) or non-spell actions don't spend spell slots
  if (slotLevel <= 1) return 0;

  // AoE spells hitting 2+ enemies are considered a good investment of high-level slots
  if (impactedEnemiesCount >= 2) {
    return (impactedEnemiesCount - 1) * 10;
  }

  if (!target) return 0;

  // Check if target is trivial (dying, very low HP, or weak)
  const isTrivial = target.currentHP <= 10 || (target.currentHP <= target.maxHP * 0.25);

  if (isTrivial) {
    // Check if the caster has cantrips or basic attacks available that could deal with this foe
    const hasLowLevelOption = caster.abilities.some(a => {
      if (a.id === ability.id) return false;
      const aSlot = a.cost?.spellSlotLevel ?? a.spell?.level ?? 0;
      const isDamaging = a.effects.some(e => e.type === 'damage');
      return aSlot <= 1 && isDamaging;
    });

    if (hasLowLevelOption) {
      // Overkill penalty scales with slot level: wasting level 3 on 4 HP foe is penalized heavily
      return WEIGHTS.SPELL_SLOT_OVERKILL_PENALTY * (slotLevel - 1);
    }
  }

  // Against healthy, dangerous targets, using a high-level spell is valuable
  if (target.currentHP >= 25 || target.currentHP === target.maxHP) {
    return 10 * (slotLevel - 1);
  }

  return 0;
}

// ============================================================================
// Summon Scoring (agora-db71.28)
// ============================================================================
// `spellAbilityFactory` emits a 'summon_creature' AbilityEffect for all 22
// SUMMONING spell rows, so the 14 summon spells now carry one effect each.
// The planner below scored only 'damage', 'heal' and buff 'status' effects, so
// a summon read as an ability that does nothing and the AI never cast one.
// ============================================================================

/**
 * Combat value of each summoned entity kind, as a fraction of a full combatant.
 *
 * A Bestial Spirit fights and a floating disk carries luggage, so the planner
 * has to tell them apart or it spends its action summoning furniture. The
 * fractions follow the spell data the factory reads: kinds whose stat block
 * carries an attack action score 1, kinds the data marks as unable to attack
 * (familiar, object) score far lower.
 */
const SUMMON_ENTITY_COMBAT_VALUE: Record<NonNullable<AbilityEffect['summonEntityType']>, number> = {
  creature: 1,
  undead: 1,
  construct: 1,
  servant: 0.7,
  mount: 0.4,
  familiar: 0.3,
  object: 0.2,
};

/** Value used when the spell data names no entity kind at all. */
const SUMMON_UNKNOWN_ENTITY_COMBAT_VALUE = 0.6;

/**
 * Scores a 'summon_creature' ability: what is another body on the field worth?
 *
 * Reads the three riders the ability factory writes - `summonEntityType`,
 * `summonCount` and `summonPersistent` - and returns 0 for an ability that
 * carries no summon effect.
 *
 * Two cases score zero even though the effect is present:
 * - The caster already has this exact summon alive. The spell data says a
 *   second cast replaces the first, so the action buys nothing.
 * - The spell needs concentration and the caster is already concentrating.
 *   Trading a live concentration spell for a new body is a downgrade.
 *
 * @param caster - The combatant considering the cast.
 * @param ability - The ability to score.
 * @param allies - Living and downed allies, used to spot an existing summon.
 * @returns A score comparable to the planner's other ability scores.
 */
export function evaluateSummonAbility(
  caster: CombatCharacter,
  ability: Ability,
  allies: CombatCharacter[] = []
): number {
  const summonEffect = ability.effects.find(e => e.type === 'summon_creature');
  if (!summonEffect) return 0;

  const spellId = ability.spell?.id ?? ability.id;
  const alreadyOnField = allies.some(ally =>
    ally.currentHP > 0 &&
    ally.summonMetadata?.casterId === caster.id &&
    ally.summonMetadata?.spellId === spellId
  );
  if (alreadyOnField) return 0;

  const isConcentrationSpell = ability.tags?.includes('concentration') || ability.spell?.duration?.type === 'concentration';
  if (isConcentrationSpell && caster.concentratingOn) return 0;

  const entityValue = summonEffect.summonEntityType
    ? SUMMON_ENTITY_COMBAT_VALUE[summonEffect.summonEntityType]
    : SUMMON_UNKNOWN_ENTITY_COMBAT_VALUE;

  let score = WEIGHTS.SUMMON_BASE * entityValue;

  const count = summonEffect.summonCount ?? 1;
  if (count > 1) {
    score += (count - 1) * WEIGHTS.SUMMON_PER_EXTRA_CREATURE * entityValue;
  }

  if (summonEffect.summonPersistent) {
    score += WEIGHTS.SUMMON_PERSISTENT_BONUS;
  }

  return score;
}

// ============================================================================
// Target Filtering & Taxonomy Helpers
// ============================================================================
// Validates whether candidate targets match spell taxonomy restrictions
// (e.g. Humanoid-only) and respects magical summon protections like blood circles.
// ============================================================================

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

const isProtectedByBloodCircle = (caster: CombatCharacter, target: CombatCharacter): boolean => {
  const protectedTiles = caster.summonMetadata?.bloodCircle?.protectedTiles ?? [];
  if (protectedTiles.length === 0) return false;

  return getOccupiedTiles(target).some(targetTile => protectedTiles.some(protectedTile =>
    protectedTile.x === targetTile.x && protectedTile.y === targetTile.y
  ));
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
 * @param options - Optional per-turn context. Supplying `stance` lets witness
 *   memory (what this creature saw the player do) override tactical scoring:
 *   a creature that expects mercy stands down, one that expects a massacre runs,
 *   and one that is cornered by a butcher refuses to retreat.
 * @returns The chosen CombatAction to execute.
 */
export function evaluateCombatTurn(
  character: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData,
  options: CombatTurnOptions = {}
): CombatAction {
  // 2026-09-09 (was TODO #1307): this planner already runs for allied combatants —
  // triage healing, protective buffs and peeling for backliners all score here. What is
  // genuinely missing is the PLAYER-CONFIGURABLE half: the WEIGHTS table is a fixed
  // module constant with no per-character or player-set override, so a companion cannot
  // be told to hold spell slots or guard the back line. Tracked as GG-214.
  // A former pointer to a roadmap doc that no longer exists was removed here (GG-205).

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
  let allEnemies = [...activeEnemies, ...downedEnemies];

  // A protective circle is a target and movement boundary for its demon, not
  // merely descriptive summon metadata. Remove protected targets before the
  // planner scores attacks so AI execution cannot repeatedly choose an action
  // that the shared action/target validators must reject later.
  if (character.summonMetadata?.bloodCircle?.protectedTiles?.length) {
    activeEnemies = activeEnemies.filter(enemy => !isProtectedByBloodCircle(character, enemy));
    downedEnemies = downedEnemies.filter(enemy => !isProtectedByBloodCircle(character, enemy));
    allEnemies = [...activeEnemies, ...downedEnemies];
  }

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

  // Witness memory (agora-f58b). Read AFTER the Command directives, because a
  // magical compulsion overrides what a creature merely believes, and BEFORE
  // tactical scoring, because standing down or bolting is not a plan that
  // competes on score — it is a refusal to fight at all.
  const encounterStance = options.stance
    ? resolveEncounterStance(character, activeEnemies, reachableTiles, options.stance)
    : null;

  if (encounterStance) {
    logger.debug(`[AI] ${character.name} encounter stance: ${encounterStance.stance}`, {
      reason: encounterStance.reason,
      mercy: encounterStance.reputation.mercy,
      brutality: encounterStance.reputation.brutality,
      prowess: encounterStance.reputation.prowess,
    });

    if (encounterStance.stance === 'surrender' || encounterStance.stance === 'negotiate') {
      // There is no surrender action in the combat action vocabulary, so the
      // creature does the only thing it can do inside a turn: nothing. It stops
      // attacking and waits. The log line carries the reason so the encounter
      // layer above can turn a stood-down creature into parley or capture.
      logger.info(
        `[AI] ${character.name} will not fight (${encounterStance.stance}): ${encounterStance.reason}`
      );
      return createEndTurnAction(character);
    }

    if (encounterStance.stance === 'flee') {
      const routAction = planStanceFleeMovement(character, activeEnemies, reachableTiles);
      if (routAction) {
        logger.info(`[AI] ${character.name} routs: ${encounterStance.reason}`);
        return routAction;
      }
      // No tile takes them farther from the fight this turn. Fall through to
      // ordinary scoring rather than wasting the turn pretending to run.
    }
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

    // A summon is scored here, ahead of the targeting dispatch below. Every
    // summon spell the ability factory builds declares point targeting, which
    // `inferTargeting` reports as 'area', and the AoE evaluator scores by the
    // enemies a shape catches - a summon catches none, so it would read as a
    // no-op. Where the body lands stays SummoningCommand's job, so the plan
    // casts from the caster's own square the way a self ability does.
    if (ability.effects.some(e => e.type === 'summon_creature')) {
      possiblePlans.push({
        actionType: 'ability',
        abilityId: ability.id,
        targetPosition: character.position,
        targetCharacterIds: [character.id],
        score: evaluateSummonAbility(character, ability, allAllies),
        description: `Summon with ${ability.name}`,
      });
      continue;
    }

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
        const plan = evaluateAttackPlan(character, target, ability, mapData, reachableTiles, activeEnemies, allAllies);
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

  // Evaluate pure repositioning for survival when low HP. A creature holding a
  // `fight_to_death` stance has already concluded that running is worse than
  // dying, so the low-HP retreat is withheld from it rather than scored down —
  // a scored-down retreat would still win once the alternatives dried up.
  const safeRetreat =
    encounterStance?.stance === 'fight_to_death'
      ? null
      : evaluateRetreatPlan(character, activeEnemies, mapData, reachableTiles);
  if (safeRetreat) {
    possiblePlans.push(safeRetreat);
  }

  // Evaluate frontline interception to protect vulnerable backliners.
  const interceptPlan = evaluateInterceptionPlan(character, activeAllies, activeEnemies, mapData, reachableTiles);
  if (interceptPlan) {
    possiblePlans.push(interceptPlan);
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

  for (const plan of reachableTiles.values()) {
    const distanceFromCaster = getDistance(plan.tile.coordinates, commandCaster.position);
    if (distanceFromCaster > bestDistance) {
      bestDistance = distanceFromCaster;
      bestPlan = plan;
    }
  }

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

/**
 * Rout movement for a creature whose witness memory says the player takes no
 * prisoners (agora-f58b).
 *
 * Distinct from both neighbours on purpose. `planCommandFleeMovement` flees the
 * one caster the spell names; `evaluateRetreatPlan` is a scored tactical
 * reposition that only triggers below 35% HP and competes with attacks. This one
 * is unconditional on health, runs from the whole enemy line, and does not
 * compete: a routing creature is not choosing the best move, it is leaving.
 *
 * Returns null when no reachable tile increases the distance to the nearest
 * enemy, so the caller can fall through to ordinary scoring instead of burning
 * the turn on a step that goes nowhere.
 */
function planStanceFleeMovement(
  character: CombatCharacter,
  enemies: CombatCharacter[],
  reachableTiles: Map<string, ReachableTilePlan>
): CombatAction | null {
  if (enemies.length === 0) return null;

  const distanceToNearest = (position: Position): number =>
    Math.min(...enemies.map(enemy => getDistance(position, enemy.position)));

  let bestPlan: ReachableTilePlan | null = null;
  let bestDistance = distanceToNearest(character.position);

  for (const plan of reachableTiles.values()) {
    const distance = distanceToNearest(plan.tile.coordinates);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestPlan = plan;
    }
  }

  if (!bestPlan) return null;

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

  for (const plan of reachableTiles.values()) {
    const distanceToCaster = getDistance(plan.tile.coordinates, commandCaster.position);
    if (distanceToCaster < bestDistance && distanceToCaster >= 1) {
      bestDistance = distanceToCaster;
      bestPlan = plan;
    }
  }

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
 * Checks if a character can afford an ability based on available action economy and spell slots.
 * This is a "soft" check for planning purposes.
 *
 * @param character - The character attempting the action.
 * @param ability - The ability to check.
 * @returns True if the character has the required action type and spell slot available.
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

  // Check spell slot availability if character tracks spell slots
  const slotLevel = cost.spellSlotLevel ?? ability.spell?.level;
  if (slotLevel && slotLevel > 0 && character.spellSlots) {
    const slotKey = `level_${slotLevel}` as keyof SpellSlots;
    const slot = character.spellSlots[slotKey];
    if (slot && slot.current <= 0) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates the utility of casting a self-targeting ability (buffs, self-heals).
 *
 * Heuristics:
 * - Healing is valuable only when damaged (efficiency).
 * - Self-preservation (healing when critical) is heavily weighted.
 * - Protective buffs (Mage Armor, Shield of Faith) are prioritized early for carriers.
 */
function evaluateSelfAbility(caster: CombatCharacter, ability: Ability): number {
  let score = 0;
  // If low health and ability heals, prioritize emergency survival
  const isHeal = ability.effects.some(e => e.type === 'heal');
  if (isHeal) {
    const missingHP = caster.maxHP - caster.currentHP;
    const healAmount = ability.effects.find(e => e.type === 'heal')?.value || 0;
    // Only heal if we are missing health, score based on efficiency
    if (missingHP > 0) {
      score += Math.min(missingHP, healAmount) * WEIGHTS.HEAL;
      // Critical triage rescue bonus when falling below 30% HP
      if (caster.currentHP < caster.maxHP * 0.3) {
        score += WEIGHTS.TRIAGE_CRITICAL_HEAL;
      } else if (caster.currentHP < caster.maxHP * 0.5) {
        score += WEIGHTS.TRIAGE_WOUNDED_HEAL;
      }
    }
  }

  // Protective buffs on self (e.g. Mage Armor, self-buffs)
  const isBuff = isProtectiveBuffAbility(ability) || ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  if (isBuff) {
    if (hasActiveBuff(caster, ability)) {
      return 0; // Avoid duplicate buffs
    }
    const isConcentrationSpell = ability.tags?.includes('concentration') || ability.spell?.duration?.type === 'concentration';
    if (isConcentrationSpell && caster.concentratingOn) {
      return 0; // Avoid breaking active concentration
    }
    let buffScore = 12;
    if (isPartyCarry(caster)) {
      buffScore += WEIGHTS.BUFF_PROTECT_CARRY;
    }
    if (isAlliedCombatant(caster)) {
      buffScore += WEIGHTS.EARLY_COMBAT_BUFF_BONUS;
    }
    score += buffScore;
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
 * - Spell slot budgeting (avoiding overkill on trivial foes).
 * - Peeling support (prioritizing melee hostiles threatening vulnerable allies).
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
  activeEnemies: CombatCharacter[],
  allAllies: CombatCharacter[] = []
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
  // Downed targets are heavily penalized when active threats are present.
  if (target.currentHP === 0 && target.deathSaves) {
    if (activeEnemies.length > 0) {
      score -= 150; // Heavily penalize attacking downed targets while active threats exist
    } else {
      score += 10; // Moderate value to finish them off if no active enemies remain
    }
  }

  // Peeling bonus: If an allied attacker targets an enemy that is threatening a vulnerable backliner
  if (isAlliedCombatant(caster) && allAllies.length > 0) {
    const threatenedAlly = allAllies.find(ally =>
      ally.id !== caster.id &&
      ally.currentHP > 0 &&
      isVulnerableBackliner(ally) &&
      getDistance(ally.position, target.position) <= 1.5
    );
    if (threatenedAlly) {
      score += WEIGHTS.PEEL_THREAT_BONUS;
    }
  }

  // Spell slot budgeting: avoid expending high-level slots on trivial foes when low-level options suffice
  score += evaluateSpellSlotBudget(caster, target, ability, 1);

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
 * - Triage healing priority (highest urgency for downed allies at 0 HP, emergency for <30% HP).
 * - Healing efficiency (not overheating healthy allies).
 * - Protective buffs (Bless, Shield of Faith) prioritized for party carries early in combat.
 * - Avoiding duplicate buff application or accidental concentration drops.
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
  const dist = getDistance(caster.position, target.position);
  const moveRange = caster.actionEconomy.movement.total - caster.actionEconomy.movement.used;
  if (dist > ability.range + moveRange) return null;

  let score = 0;
  const isHeal = ability.effects.some(e => e.type === 'heal');
  if (isHeal) {
    const missingHP = target.maxHP - target.currentHP;
    const healAmount = ability.effects.find(e => e.type === 'heal')?.value || 0;

    // Triage Level 1: Reviving downed allies (0 HP with death saves) is supreme priority
    if (target.currentHP === 0 && target.deathSaves) {
      score += WEIGHTS.TRIAGE_REVIVE_DOWNED; // 180 points: top priority
    } else if (missingHP > 0) {
      score += Math.min(missingHP, healAmount) * WEIGHTS.HEAL;

      // Triage Level 2: Critically wounded allies (<30% HP) need immediate rescue
      if (target.currentHP < target.maxHP * 0.3) {
        score += WEIGHTS.TRIAGE_CRITICAL_HEAL; // 65 points: outscores standard cantrip attacks
      } else if (target.currentHP < target.maxHP * 0.5) {
        // Triage Level 3: Moderately wounded allies (<50% HP)
        score += WEIGHTS.TRIAGE_WOUNDED_HEAL; // 25 points
      }
    }
  }

  // Buffs keep allies safe and enhance party damage carries
  const isBuff = isProtectiveBuffAbility(ability) || ability.effects.some(e => e.type === 'status' && e.statusEffect?.type === 'buff');
  if (isBuff && target.currentHP > 0) {
    // Avoid duplicate buffing if target already has the buff
    if (hasActiveBuff(target, ability)) {
      return null;
    }

    // Avoid duplicate concentration buffing if caster is already concentrating on this spell or active spell
    const isConcentrationSpell = ability.tags?.includes('concentration') || ability.spell?.duration?.type === 'concentration';
    if (isConcentrationSpell && caster.concentratingOn) {
      return null; // Do not break existing active concentration
    }

    let buffScore = 12; // Base buff value

    // Bonus for protective buffs on party carries
    if (isPartyCarry(target)) {
      buffScore += WEIGHTS.BUFF_PROTECT_CARRY;
    }

    // Bonus for early combat application
    if (isAlliedCombatant(caster)) {
      buffScore += WEIGHTS.EARLY_COMBAT_BUFF_BONUS;
    }

    score += buffScore;
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
      description: target.currentHP === 0
        ? `Revive downed ${target.name} with ${ability.name}`
        : isBuff
          ? `Buff ${target.name} with ${ability.name}`
          : `Heal ${target.name} with ${ability.name}`,
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
  reachableTiles: Map<string, ReachableTilePlan>,
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

      // Spell slot budgeting for AoE: rewards hitting 2+ enemies, penalizes overkill on single weak enemy
      score += evaluateSpellSlotBudget(caster, null, ability, impactedActiveEnemies.length);

      // Penalize friendly fire ONLY IF the ability does damage.
      score += impactedActiveAllies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY;
      score += impactedDownedAllies.length * WEIGHTS.FRIENDLY_FIRE_PENALTY * 2.0; // Double penalty for hitting dying allies
    }

    if (healEffect) {
      const healValue = healEffect.value || 0;
      healableActiveAllies.forEach(ally => {
        const missing = ally.maxHP - ally.currentHP;
        score += Math.min(missing, healValue) * WEIGHTS.HEAL;
        if (ally.currentHP < ally.maxHP * 0.3) {
          score += WEIGHTS.TRIAGE_CRITICAL_HEAL;
        } else if (ally.currentHP < ally.maxHP * 0.5) {
          score += WEIGHTS.TRIAGE_WOUNDED_HEAL;
        }
      });

      // Massively boost score for healing downed allies (reviving them)
      healableDownedAllies.forEach(() => {
        score += WEIGHTS.TRIAGE_REVIVE_DOWNED;
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
        const isProtectedCircleTile = character.summonMetadata?.bloodCircle?.protectedTiles?.some(protectedTile =>
          protectedTile.x === neighbor?.coordinates.x && protectedTile.y === neighbor?.coordinates.y
        ) ?? false;
        if (neighbor && !neighbor.blocksMovement && !visited.has(neighborId) && !isOccupied && !isProtectedCircleTile) {
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

/**
 * Evaluates an interception move for tanks and frontliners to position themselves
 * between vulnerable casters/ranged allies and approaching melee hostiles.
 *
 * Threat Management:
 * - Identifies vulnerable allies (concentrating casters, low-armor backliners).
 * - Identifies approaching melee hostiles.
 * - Searches reachable tiles to find positions that screen/block the advance corridor.
 *
 * @param character - The tank or frontliner taking the turn.
 * @param activeAllies - All active allies in combat.
 * @param activeEnemies - All active enemies in combat.
 * @param mapData - The battle map.
 * @param reachableTiles - Pre-computed reachable tiles for movement.
 * @returns A movement plan (AIPlan) or null if no valid interception position is found.
 */
/**
 * Calculates perpendicular distance from a candidate tile coordinate to the line
 * connecting the protected ally and approaching enemy.
 */
function getPerpendicularDistanceToLine(point: Position, ally: Position, enemy: Position): number {
  const lineLength = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
  if (lineLength === 0) return getDistance(point, ally);
  const crossProduct = Math.abs((enemy.y - ally.y) * point.x - (enemy.x - ally.x) * point.y + enemy.x * ally.y - enemy.y * ally.x);
  return crossProduct / lineLength;
}

/**
 * Evaluates an interception move for tanks and frontliners to position themselves
 * between vulnerable casters/ranged allies and approaching melee hostiles.
 *
 * Threat Management:
 * - Identifies vulnerable allies (concentrating casters, low-armor backliners).
 * - Identifies approaching melee hostiles.
 * - Searches reachable tiles to find positions that screen/block the advance corridor.
 *
 * @param character - The tank or frontliner taking the turn.
 * @param activeAllies - All active allies in combat.
 * @param activeEnemies - All active enemies in combat.
 * @param mapData - The battle map.
 * @param reachableTiles - Pre-computed reachable tiles for movement.
 * @returns A movement plan (AIPlan) or null if no valid interception position is found.
 */
export function evaluateInterceptionPlan(
  character: CombatCharacter,
  activeAllies: CombatCharacter[],
  activeEnemies: CombatCharacter[],
  mapData: BattleMapData,
  reachableTiles: Map<string, ReachableTilePlan>
): AIPlan | null {
  if (!isAlliedCombatant(character) || !isTankOrFrontliner(character)) {
    return null;
  }

  // Identify vulnerable allies that need protection
  const vulnerableAllies = activeAllies.filter(a => a.id !== character.id && isVulnerableBackliner(a));
  if (vulnerableAllies.length === 0) return null;

  // Identify active melee threats
  const meleeEnemies = activeEnemies.filter(e => isMeleeHostile(e));
  if (meleeEnemies.length === 0) return null;

  let bestTile: BattleMapTile | null = null;
  let bestPlan: ReachableTilePlan | null = null;
  let bestScore = -Infinity;
  let protectedAllyName = '';
  let interceptedEnemyName = '';

  for (const vulnerableAlly of vulnerableAllies) {
    for (const meleeEnemy of meleeEnemies) {
      const directDist = getDistance(vulnerableAlly.position, meleeEnemy.position);
      // Only evaluate if enemy is approaching the backliner (distance 2 to 10 tiles)
      if (directDist < 2 || directDist > 10) continue;

      reachableTiles.forEach((plan) => {
        const { tile, cost } = plan;
        const distToAlly = getDistance(tile.coordinates, vulnerableAlly.position);
        const distToEnemy = getDistance(tile.coordinates, meleeEnemy.position);

        // Interception position: between the ally and the enemy
        // Standing at least 1 tile away from the ally, and closer to the enemy than the ally is
        if (distToAlly >= 1 && distToEnemy < directDist && distToAlly < directDist) {
          const perpDist = getPerpendicularDistanceToLine(tile.coordinates, vulnerableAlly.position, meleeEnemy.position);
          if (perpDist <= 1.5) {
            let score = WEIGHTS.INTERCEPT_MELEE_THREAT_BONUS - (perpDist * 8) + WEIGHTS.DISTANCE_PENALTY * cost;
            // Closer to the threat is better for a tank to absorb attention
            if (distToEnemy <= 2) score += 8;

            if (score > bestScore) {
              bestScore = score;
              bestTile = tile;
              bestPlan = plan;
              protectedAllyName = vulnerableAlly.name;
              interceptedEnemyName = meleeEnemy.name;
            }
          }
        }
      });
    }
  }

  if (bestTile && bestPlan && bestScore > 0) {
    // Both are assigned inside a `forEach` callback, which the control-flow
    // analyser does not track, so it still believes they are `null` here. Same
    // re-widening `evaluateRetreatPlan` already does for `safestTile`.
    const interceptTile = bestTile as BattleMapTile;
    const interceptMovePlan = bestPlan as ReachableTilePlan;
    return {
      actionType: 'move',
      targetPosition: interceptTile.coordinates,
      movementPath: interceptMovePlan.path,
      movementCost: interceptMovePlan.cost,
      score: bestScore,
      description: `Position frontliner to screen ${protectedAllyName} against ${interceptedEnemyName}`,
    };
  }

  return null;
}
