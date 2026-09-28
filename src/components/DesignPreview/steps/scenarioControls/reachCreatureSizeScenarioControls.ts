// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 05:47:40
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic controls for Reach & Creature Size.
 *
 * The controls compare normal and extended melee reach through the shared
 * nearest-footprint distance, resolve a real attack only when that range check
 * succeeds, shrink the attacker to show how size changes the answer, and test a
 * Large placement against every square of its canonical footprint. Two movement
 * probes also call the production Opportunity Attack detector with Large
 * footprints, then pay an accepted Reaction through shared action economy. The
 * host renders the returned combatants in both map modes; no separate UI truth
 * is stored here.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: shared footprint distance, placement, attack, and HP mechanics.
 */

import type { Ability, CombatCharacter } from '../../../../types/combat';
import { ItemType } from '../../../../types';
import { OpportunityAttackSystem } from '../../../../systems/combat/reactions/OpportunityAttackSystem';
import { consumeActionCost } from '../../../../utils/combat/actionEconomyUtils';
import {
  getCharacterDistance,
  getCharacterSizeMultiplier,
  getDistance,
  resolveAttack,
  validateCharacterPlacement,
} from '../../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../../utils/combat/deathSaveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Board Facts
// ============================================================================
// The Large lancer begins with a 2-by-2 footprint. The target is two squares
// from the nearest occupied lancer square but three squares from its top-left
// anchor. A separate gate has one blocked square inside a proposed 2-by-2 space.
// ============================================================================

export const REACH_CREATURE_SIZE_ATTACKER_ID = 'reach_creature_size-tester';
export const REACH_CREATURE_SIZE_TARGET_ID = 'reach_creature_size-target';
export const REACH_CREATURE_SIZE_SCOUT_ID = 'reach_creature_size-scout';

export const REACH_CREATURE_SIZE_ATTACKER_START = { x: 6, y: 4 } as const;
export const REACH_CREATURE_SIZE_TARGET_START = { x: 9, y: 5 } as const;
export const REACH_CREATURE_SIZE_SCOUT_START = { x: 12, y: 8 } as const;
export const REACH_CREATURE_SIZE_BLOCKED_ANCHOR = { x: 13, y: 4 } as const;
export const REACH_CREATURE_SIZE_BLOCKED_TILE = { x: 14, y: 5 } as const;
export const REACH_CREATURE_SIZE_OA_FROM = { x: 8, y: 4 } as const;
export const REACH_CREATURE_SIZE_OA_EDGE = { x: 8, y: 5 } as const;
export const REACH_CREATURE_SIZE_OA_EXIT = { x: 9, y: 4 } as const;

export const REACH_CREATURE_SIZE_TARGET_AC = 15;
export const REACH_CREATURE_SIZE_TARGET_HP = 30;
export const REACH_CREATURE_SIZE_DAMAGE = 7;

const NORMAL_REACH_TILES = 1;
const EXTENDED_REACH_TILES = 2;
const FIXED_ATTACK_ROLL = 12;
const FIXED_ATTACK_BONUS = 6;

interface ReachActors {
  attacker: CombatCharacter;
  target: CombatCharacter;
  scout: CombatCharacter;
}

// ============================================================================
// Canonical Actor And Ability Setup
// ============================================================================
// Every action begins from the same board facts so controls remain independent.
// The ability's range is the production tile value consumed by target checks.
// ============================================================================

function createReachAbility(reachTiles: number): Ability {
  const reachFeet = reachTiles * 5;
  return {
    id: 'reach-creature-size-lance',
    name: `Lance (${reachFeet} ft Reach)`,
    description: `A deterministic melee strike with ${reachFeet}-foot reach.`,
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: reachTiles,
    weapon: {
      id: 'reach-creature-size-lance-weapon',
      name: 'Training Lance',
      description: 'A melee weapon whose current range is visible in the scenario.',
      type: ItemType.Weapon,
      properties: reachTiles > 1 ? ['reach'] : [],
    },
    attackBonus: FIXED_ATTACK_BONUS,
    attackType: 'weapon',
    effects: [{ type: 'damage', value: REACH_CREATURE_SIZE_DAMAGE, damageType: 'piercing' }],
    isProficient: true,
  };
}

// ============================================================================
// Opportunity Attack Footprint Transition
// ============================================================================
// Both actors occupy 2-by-2 spaces. Their anchors begin two squares apart, but
// their nearest occupied squares are adjacent. Moving along the edge stays at
// five feet; moving one square away crosses from five feet to ten feet and
// opens exactly one production Opportunity Attack reaction window.
// ============================================================================

function resolveOpportunityMovement(
  application: PreviewCombatScenarioControlApplication,
  destination: typeof REACH_CREATURE_SIZE_OA_EDGE | typeof REACH_CREATURE_SIZE_OA_EXIT,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  if (!found) {
    return { logMessage: 'Opportunity movement control skipped because an authored lancer, target, or scout is unavailable.' };
  }

  const prepared = prepareActors(found, 'Large', NORMAL_REACH_TILES);
  const attacker: CombatCharacter = {
    ...prepared.attacker,
    name: 'Large Lancer (5 ft Reach · Reaction ready)',
    actionEconomy: {
      ...prepared.attacker.actionEconomy,
      reaction: { ...prepared.attacker.actionEconomy.reaction, used: false, remaining: 1 },
    },
  };
  const moverBefore: CombatCharacter = {
    ...prepared.target,
    name: 'Large Reach Mover',
    position: { ...REACH_CREATURE_SIZE_OA_FROM },
    stats: { ...prepared.target.stats, size: 'Large' },
  };
  const moverAfter: CombatCharacter = { ...moverBefore, position: { ...destination } };
  const fromDistanceFeet = getCharacterDistance(attacker, moverBefore) * 5;
  const toDistanceFeet = getCharacterDistance(attacker, moverAfter) * 5;

  // Discovery uses the production detector. Reaction payment occurs only when
  // that detector reports a true voluntary reach exit, so an edge move cannot
  // spend the resource and an exit publishes one coherent state transition.
  const triggers = new OpportunityAttackSystem().checkOpportunityAttacks(
    moverBefore,
    REACH_CREATURE_SIZE_OA_FROM,
    destination,
    [attacker],
    application.snapshot.mapData,
    { movementKind: 'voluntary', movementMode: 'walk' },
  );
  const resolvedAttacker = triggers.length > 0
    ? consumeActionCost(attacker, { type: 'reaction' })
    : attacker;
  const labelledAttacker = {
    ...resolvedAttacker,
    name: `Large Lancer (5 ft Reach · Reaction ${resolvedAttacker.actionEconomy.reaction.used ? 'spent' : 'ready'})`,
  };

  return {
    characters: replaceActors(application.snapshot.characters, {
      attacker: labelledAttacker,
      target: moverAfter,
      scout: prepared.scout,
    }),
    logMessage: `Large vs Large voluntary step ${REACH_CREATURE_SIZE_OA_FROM.x},${REACH_CREATURE_SIZE_OA_FROM.y} → ${destination.x},${destination.y}: nearest footprint edge ${fromDistanceFeet} ft → ${toDistanceFeet} ft; Opportunity Attacks ${triggers.length}; Reaction ${resolvedAttacker.actionEconomy.reaction.used ? 'ready → spent' : 'remains ready'}.`,
  };
}

function requireActors(
  application: PreviewCombatScenarioControlApplication,
): ReachActors | null {
  const attacker = application.snapshot.characters.find(
    character => character.id === REACH_CREATURE_SIZE_ATTACKER_ID,
  );
  const target = application.snapshot.characters.find(
    character => character.id === REACH_CREATURE_SIZE_TARGET_ID,
  );
  const scout = application.snapshot.characters.find(
    character => character.id === REACH_CREATURE_SIZE_SCOUT_ID,
  );

  return attacker && target && scout ? { attacker, target, scout } : null;
}

function prepareActors(
  actors: ReachActors,
  size: NonNullable<CombatCharacter['stats']['size']>,
  reachTiles: number,
): ReachActors {
  const attacker: CombatCharacter = {
    ...actors.attacker,
    name: `${size} Lancer (${reachTiles * 5} ft Reach)`,
    position: { ...REACH_CREATURE_SIZE_ATTACKER_START },
    team: 'player',
    stats: { ...actors.attacker.stats, size, strength: 16 },
    abilities: [createReachAbility(reachTiles)],
  };
  const target: CombatCharacter = {
    ...actors.target,
    name: 'Reach Target (AC 15 · 30 HP)',
    position: { ...REACH_CREATURE_SIZE_TARGET_START },
    team: 'enemy',
    stats: { ...actors.target.stats, size: 'Medium' },
    currentHP: REACH_CREATURE_SIZE_TARGET_HP,
    maxHP: REACH_CREATURE_SIZE_TARGET_HP,
    armorClass: REACH_CREATURE_SIZE_TARGET_AC,
    baseAC: REACH_CREATURE_SIZE_TARGET_AC,
    abilities: [],
  };
  const scout: CombatCharacter = {
    ...actors.scout,
    name: 'Small Space Scout',
    position: { ...REACH_CREATURE_SIZE_SCOUT_START },
    team: 'neutral',
    stats: { ...actors.scout.stats, size: 'Small' },
    abilities: [],
  };

  return { attacker, target, scout };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: ReachActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.attacker.id, actors.attacker],
    [actors.target.id, actors.target],
    [actors.scout.id, actors.scout],
  ]);
  return characters.map(character => replacements.get(character.id) ?? character);
}

// ============================================================================
// Distance Explanation And Attack Validity
// ============================================================================
// The nearest occupied-square distance is authoritative. Center separation is
// reported only as an audit comparison, never used to decide target validity.
// ============================================================================

function getCenterDistanceFeet(first: CombatCharacter, second: CombatCharacter): number {
  const firstInset = (getCharacterSizeMultiplier(first.stats.size) - 1) / 2;
  const secondInset = (getCharacterSizeMultiplier(second.stats.size) - 1) / 2;
  return getDistance(
    { x: first.position.x + firstInset, y: first.position.y + firstInset },
    { x: second.position.x + secondInset, y: second.position.y + secondInset },
  ) * 5;
}

function formatDistance(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function resolveReachCheck(
  application: PreviewCombatScenarioControlApplication,
  size: NonNullable<CombatCharacter['stats']['size']>,
  reachTiles: number,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  if (!found) {
    return { logMessage: 'Reach control skipped because an authored lancer, target, or scout is unavailable.' };
  }

  const actors = prepareActors(found, size, reachTiles);
  const footprintDistanceTiles = getCharacterDistance(actors.attacker, actors.target);
  const footprintDistanceFeet = footprintDistanceTiles * 5;
  const centerDistanceFeet = getCenterDistanceFeet(actors.attacker, actors.target);
  const ability = actors.attacker.abilities[0];
  const inRange = footprintDistanceTiles <= ability.range;

  // Only a valid target proceeds into canonical d20 resolution and HP damage.
  // An invalid target retains its complete reset-state health pool.
  let target = actors.target;
  let attackClause = 'no attack roll or damage resolved';
  if (inRange) {
    const attack = resolveAttack(
      FIXED_ATTACK_ROLL,
      FIXED_ATTACK_BONUS,
      actors.target.armorClass ?? REACH_CREATURE_SIZE_TARGET_AC,
    );
    if (attack.isHit) {
      target = applyDamageAndCheckDowned(actors.target, REACH_CREATURE_SIZE_DAMAGE, attack.isCritical);
    }
    attackClause = `d20 ${FIXED_ATTACK_ROLL} + ${FIXED_ATTACK_BONUS} = ${attack.total} vs AC ${REACH_CREATURE_SIZE_TARGET_AC}, ${attack.isHit ? 'HIT' : 'MISS'}; HP ${actors.target.currentHP} → ${target.currentHP}`;
  }

  const resolvedActors = { ...actors, target };
  return {
    characters: replaceActors(application.snapshot.characters, resolvedActors),
    logMessage: `${size} footprint · ${ability.name}: target ${inRange ? 'VALID' : 'INVALID'}. Nearest footprint distance ${footprintDistanceFeet} ft; token-center distance ${formatDistance(centerDistanceFeet)} ft; reach ${ability.range * 5} ft; ${attackClause}.`,
  };
}

// ============================================================================
// Complete-Footprint Placement Boundary
// ============================================================================
// The proposed anchor is open, but the Large footprint extends onto a wall.
// Rejection comes from the shared placement primitive and leaves the actor put.
// ============================================================================

function resolveBlockedPlacement(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  if (!found || !application.snapshot.mapData) {
    return { logMessage: 'Placement control skipped because its authored actors or battle map are unavailable.' };
  }

  const actors = prepareActors(found, 'Large', NORMAL_REACH_TILES);
  const placement = validateCharacterPlacement(
    actors.attacker,
    REACH_CREATURE_SIZE_BLOCKED_ANCHOR,
    application.snapshot.mapData,
    application.snapshot.characters,
  );
  const attacker = placement.allowed
    ? { ...actors.attacker, position: { ...REACH_CREATURE_SIZE_BLOCKED_ANCHOR } }
    : actors.attacker;

  return {
    characters: replaceActors(application.snapshot.characters, { ...actors, attacker }),
    logMessage: `Large placement ${placement.allowed ? 'VALID' : 'BLOCKED'} at anchor ${REACH_CREATURE_SIZE_BLOCKED_ANCHOR.x},${REACH_CREATURE_SIZE_BLOCKED_ANCHOR.y}: ${placement.reason} Actor ${placement.allowed ? 'moved' : `remains at ${REACH_CREATURE_SIZE_ATTACKER_START.x},${REACH_CREATURE_SIZE_ATTACKER_START.y}`}.`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// The original four actions remain unchanged. Two additional actions isolate a
// Large-on-Large move along the five-foot edge and the true footprint exit.
// The normal-reach action still provides a clear local reset, while the host's
// Reset Board restores the complete authored scenario fixture.
// ============================================================================

function applyReachCreatureSizeControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Reach & Creature Size control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'normal-reach-reset') {
    return resolveReachCheck(application, 'Large', NORMAL_REACH_TILES);
  }
  if (application.controlId === 'extended-reach-strike') {
    return resolveReachCheck(application, 'Large', EXTENDED_REACH_TILES);
  }
  if (application.controlId === 'medium-footprint-check') {
    return resolveReachCheck(application, 'Medium', EXTENDED_REACH_TILES);
  }
  if (application.controlId === 'blocked-large-placement') {
    return resolveBlockedPlacement(application);
  }
  if (application.controlId === 'large-footprint-edge-step') {
    return resolveOpportunityMovement(application, REACH_CREATURE_SIZE_OA_EDGE);
  }
  if (application.controlId === 'large-footprint-exit') {
    return resolveOpportunityMovement(application, REACH_CREATURE_SIZE_OA_EXIT);
  }

  return { logMessage: `Unknown Reach & Creature Size control: ${application.controlId}.` };
}

const reachCreatureSizeScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'reach_creature_size',
  controls: [
    {
      id: 'normal-reach-reset',
      label: 'Reset to 5 ft reach',
      description: 'Restore the Large lancer and prove normal reach cannot target the enemy two footprint squares away.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'extended-reach-strike',
      label: 'Extend reach to 10 ft',
      description: 'Use the same Large footprint and target; extended reach makes the target valid and resolves a fixed attack.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'medium-footprint-check',
      label: 'Shrink to Medium',
      description: 'Keep 10-foot reach but reduce the footprint, moving the same target outside the valid range.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'blocked-large-placement',
      label: 'Test the Large gate',
      description: 'Try an open anchor whose 2-by-2 footprint crosses one blocked wall square; reject the complete placement.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'large-footprint-edge-step',
      label: 'Move along the reach edge',
      description: 'Move a Large target while its nearest occupied square stays five feet away; no Opportunity Attack or Reaction payment occurs.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'large-footprint-exit',
      label: 'Leave the footprint reach',
      description: 'Move the same Large target from a five-foot footprint edge to ten feet; open one Opportunity Attack and spend one Reaction.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyReachCreatureSizeControl,
};

export default reachCreatureSizeScenarioControls;
