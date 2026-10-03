import { describe, it, expect } from 'vitest';
import {
  CUNNING_ACTION_ABILITY_PREFIX,
  PRIMAL_COMPANION_COMMAND_ABILITY_ID,
  createPlayerCombatCharacter,
  resolveCombatantTerrainMovementPolicy,
} from '../combatUtils';
import { calculatePathMovementCost } from '../movementUtils';
import { HUNTER_PREY_FEATURE_ID } from '../hunterUtils';
import { PRIMAL_COMPANION_FEATURE_ID } from '../beastMasterUtils';
import {
  CUNNING_ACTION_FEATURE_ID,
  FAST_HANDS_FEATURE_ID,
  SECOND_STORY_WORK_FEATURE_ID,
} from '../thiefUtils';
import { ASSASSINATE_FEATURE_ID, ASSASSINS_TOOLS_FEATURE_ID } from '../assassinUtils';
import { createMockPlayerCharacter } from '../../core/factories';
import type { BattleMapTerrain, BattleMapTile } from '../../../types/combat';
import type { Class, PlayerCharacter, Race } from '../../../types';

/**
 * Two bridge facts this file pins, both about `createPlayerCombatCharacter`:
 *
 * 1. GG-257 (agora-db71.15). The QUALIFIED terrain waiver crosses into combat.
 *    The flat `ignoreDifficultTerrain` boolean cannot say which squares a trait
 *    covers, so an Earth Genasi used to wade through difficult water for free.
 *
 * 2. agora-db71.14. The subclass feature abilities every rider module gates
 *    itself on are granted from the persistent `subclassId` and level. Nothing
 *    granted them before, so no rider could fire in play.
 */

const EARTH_WALK_TRAIT =
  'Earth Walk: You can move across Difficult Terrain without expending extra movement '
  + 'if you are walking on the ground or a floor.';

const earthGenasiRace: Race = {
  id: 'earth-genasi',
  name: 'Earth Genasi',
  description: 'A genasi of elemental earth.',
  traits: ['Size: Medium', EARTH_WALK_TRAIT],
};

const plainRace: Race = {
  id: 'plain-folk',
  name: 'Plain Folk',
  description: 'A race with no movement trait.',
  traits: ['Size: Medium'],
};

const classOf = (id: string, name: string): Class => ({
  id,
  name,
  description: `${name} test class.`,
  hitDie: 10,
  primaryAbility: ['Dexterity'],
  savingThrowProficiencies: [],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 0,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
} as unknown as Class);

const makeTile = (
  x: number,
  terrain: BattleMapTerrain,
  movementCost: number,
): BattleMapTile => ({
  id: `${x}-0`,
  coordinates: { x, y: 0 },
  terrain,
  elevation: 0,
  movementCost,
  blocksLoS: false,
  blocksMovement: false,
  decoration: null,
  effects: [],
});

/** A three-square corridor: the mover pays for entering squares 2 and 3. */
const corridor = (terrain: BattleMapTerrain): BattleMapTile[] => [
  makeTile(0, terrain, 10),
  makeTile(1, terrain, 10),
  makeTile(2, terrain, 10),
];

describe('createPlayerCombatCharacter terrain movement policy (GG-257)', () => {
  it('carries the Earth Walk policy id across the persistent-to-combat bridge', () => {
    const combatant = createPlayerCombatCharacter(createMockPlayerCharacter({ race: earthGenasiRace }));
    expect(combatant.terrainPolicyId).toBe('earth-walk');
  });

  it('leaves the id unset for a race whose prose waives nothing', () => {
    const combatant = createPlayerCombatCharacter(createMockPlayerCharacter({ race: plainRace }));
    expect(combatant.terrainPolicyId).toBeUndefined();
    expect(resolveCombatantTerrainMovementPolicy(combatant)).toBeNull();
  });

  it('makes an Earth Genasi pay full cost through difficult water and none over rough ground', () => {
    const combatant = createPlayerCombatCharacter(createMockPlayerCharacter({ race: earthGenasiRace }));
    const policy = resolveCombatantTerrainMovementPolicy(combatant);
    expect(policy?.id).toBe('earth-walk');

    // Rough ground is a floor: the surcharge is waived, so two ordinary steps.
    expect(calculatePathMovementCost(corridor('rock'), policy)).toBe(10);
    // Water is a wade, not a floor: the surcharge stands and both steps double.
    expect(calculatePathMovementCost(corridor('water'), policy)).toBe(20);
    // Without the policy both corridors cost the same, which is the old bug.
    expect(calculatePathMovementCost(corridor('rock'))).toBe(20);
  });

  it('still honors the unqualified flag for a combatant that never had race prose', () => {
    const monsterLike = { ignoreDifficultTerrain: true } as Parameters<
      typeof resolveCombatantTerrainMovementPolicy
    >[0];
    expect(resolveCombatantTerrainMovementPolicy(monsterLike)?.id).toBe('any-difficult-terrain');

    const viaModifiers = {
      modifiers: { advantage: [], disadvantage: [], bonuses: [], ignoreDifficultTerrain: true },
    } as Parameters<typeof resolveCombatantTerrainMovementPolicy>[0];
    expect(resolveCombatantTerrainMovementPolicy(viaModifiers)?.id).toBe('any-difficult-terrain');
  });
});

describe('createPlayerCombatCharacter subclass rider features (agora-db71.14)', () => {
  const abilityIds = (player: PlayerCharacter): string[] =>
    createPlayerCombatCharacter(player).abilities.map(ability => ability.id);

  it('grants Hunter’s Prey and the chosen option to a level-3 Hunter', () => {
    const player = createMockPlayerCharacter({
      class: classOf('ranger', 'Ranger'),
      subclassId: 'hunter',
      level: 3,
      hunterPreyChoice: 'colossus_slayer',
    });
    const combatant = createPlayerCombatCharacter(player);

    expect(combatant.abilities.map(a => a.id)).toContain(HUNTER_PREY_FEATURE_ID);
    expect(combatant.hunterPreyChoice).toBe('colossus_slayer');
  });

  it('grants nothing to a Hunter below level 3', () => {
    expect(abilityIds(createMockPlayerCharacter({
      class: classOf('ranger', 'Ranger'),
      subclassId: 'hunter',
      level: 2,
    }))).not.toContain(HUNTER_PREY_FEATURE_ID);
  });

  it('grants Primal Companion and its command button to a Beast Master', () => {
    const combatant = createPlayerCombatCharacter(createMockPlayerCharacter({
      class: classOf('ranger', 'Ranger'),
      subclassId: 'beast_master',
      level: 3,
      primalBeastForm: 'sky',
    }));

    const ids = combatant.abilities.map(a => a.id);
    expect(ids).toContain(PRIMAL_COMPANION_FEATURE_ID);
    expect(ids).toContain(PRIMAL_COMPANION_COMMAND_ABILITY_ID);
    expect(combatant.primalBeastForm).toBe('sky');
  });

  it('gives a level-2 rogue the three base Cunning Action buttons and no more', () => {
    const ids = abilityIds(createMockPlayerCharacter({
      class: classOf('rogue', 'Rogue'),
      level: 2,
    }));

    expect(ids).toContain(CUNNING_ACTION_FEATURE_ID);
    const cunning = ids.filter(id => id.startsWith(CUNNING_ACTION_ABILITY_PREFIX));
    expect(cunning.sort()).toEqual([
      `${CUNNING_ACTION_ABILITY_PREFIX}dash`,
      `${CUNNING_ACTION_ABILITY_PREFIX}disengage`,
      `${CUNNING_ACTION_ABILITY_PREFIX}hide`,
    ]);
  });

  it('widens the Cunning Action list for a Thief and grants Second-Story Work', () => {
    const ids = abilityIds(createMockPlayerCharacter({
      class: classOf('rogue', 'Rogue'),
      subclassId: 'thief',
      level: 3,
    }));

    expect(ids).toContain(FAST_HANDS_FEATURE_ID);
    expect(ids).toContain(SECOND_STORY_WORK_FEATURE_ID);
    expect(ids.filter(id => id.startsWith(CUNNING_ACTION_ABILITY_PREFIX))).toHaveLength(6);
    expect(ids).toContain(`${CUNNING_ACTION_ABILITY_PREFIX}use_thieves_tools`);
  });

  it('grants Assassinate and Assassin’s Tools to a level-3 Assassin', () => {
    const ids = abilityIds(createMockPlayerCharacter({
      class: classOf('rogue', 'Rogue'),
      subclassId: 'assassin',
      level: 3,
    }));

    expect(ids).toContain(ASSASSINATE_FEATURE_ID);
    expect(ids).toContain(ASSASSINS_TOOLS_FEATURE_ID);
  });

  it('grants no subclass feature to a character of another class', () => {
    const ids = abilityIds(createMockPlayerCharacter({
      class: classOf('fighter', 'Fighter'),
      subclassId: 'champion',
      level: 5,
    }));

    for (const featureId of [
      HUNTER_PREY_FEATURE_ID,
      PRIMAL_COMPANION_FEATURE_ID,
      CUNNING_ACTION_FEATURE_ID,
      ASSASSINATE_FEATURE_ID,
    ]) {
      expect(ids).not.toContain(featureId);
    }
  });
});
