import { describe, expect, it } from 'vitest';
import mindSliverData from '@/data/spells/level-0/mind-sliver.json';
import guidanceData from '@/data/spells/level-0/guidance.json';
import lightData from '@/data/spells/level-0/light.json';
import bladeWardData from '@/data/spells/level-0/blade-ward.json';
import blessData from '@/data/spells/level-1/bless.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  SelectedSpellTarget,
  TargetableMapObject,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/core';
import { validateSpellTargetSelection } from '../SpellTargetSelectionValidator';

/**
 * This file proves complete spell selections are rejected before payment.
 *
 * It uses committed spell JSON and live combat/map records to cover creature,
 * object, self, relation, willingness, range, sight, uniqueness, and cap rules.
 * The mounted ability hook calls this same validator before event claim or cost.
 *
 * Covers: SpellTargetSelectionValidator and canonical TargetResolver delegation.
 */

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// Every tile begins open. Individual expectations replace one tile with a wall
// or move one actor so only the fact under review changes.
// ============================================================================

const spells = {
  mindSliver: mindSliverData as unknown as Spell,
  guidance: guidanceData as unknown as Spell,
  light: lightData as unknown as Spell,
  bladeWard: bladeWardData as unknown as Spell,
  bless: blessData as unknown as Spell,
};

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        decoration: null,
        blocksMovement: false,
        blocksLoS: false,
        movementCost: 1,
        elevation: 0,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 16 };
}

function actor(
  id: string,
  team: 'player' | 'enemy',
  position: { x: number; y: number },
  isWilling = true,
): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: id,
    team,
    position,
    level: 5,
    creatureTypes: ['Humanoid'],
    stats: { creatureTypes: ['Humanoid'] },
    isWilling,
  } as Partial<CombatCharacter> & { isWilling: boolean });
}

function validate(
  spell: Spell,
  characters: CombatCharacter[],
  mapData: BattleMapData,
  selectedTargets: SelectedSpellTarget[],
) {
  return validateSpellTargetSelection({
    spell,
    caster: characters[0],
    characters,
    mapData,
    selectedTargets,
    castLevel: spell.level,
  });
}

describe('validateSpellTargetSelection', () => {
  it('accepts canonical hostile, willing ally, self, and loose-object targets', () => {
    const caster = actor('caster', 'player', { x: 1, y: 1 });
    const enemy = actor('enemy', 'enemy', { x: 3, y: 1 });
    const ally = actor('ally', 'player', { x: 2, y: 1 }, true);
    const mapData = createMap();
    const looseObject: TargetableMapObject = {
      id: 'lantern',
      name: 'Lantern',
      position: { x: 2, y: 1 },
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: false,
      size: 'Tiny',
      weightPounds: 1,
    };
    mapData.targetableObjects = [looseObject];
    const characters = [caster, enemy, ally];

    expect(validate(spells.mindSliver, characters, mapData, [{ kind: 'creature', id: enemy.id }])).toBeNull();
    expect(validate(spells.guidance, characters, mapData, [{ kind: 'creature', id: ally.id }])).toBeNull();
    expect(validate(spells.bladeWard, characters, mapData, [{ kind: 'creature', id: caster.id }])).toBeNull();
    expect(validate(spells.light, characters, mapData, [{
      kind: 'object',
      id: looseObject.id,
      name: looseObject.name,
      position: looseObject.position,
      object: looseObject,
    }])).toBeNull();
  });

  it('rejects relation, willingness, object eligibility, range, and Total Cover with reasons', () => {
    const caster = actor('caster', 'player', { x: 1, y: 1 });
    const ally = actor('ally', 'player', { x: 2, y: 1 }, false);
    const farEnemy = actor('far-enemy', 'enemy', { x: 15, y: 1 });
    const blockedEnemy = actor('blocked-enemy', 'enemy', { x: 4, y: 3 });
    const mapData = createMap();
    mapData.tiles.set('3-2', { ...mapData.tiles.get('3-2')!, terrain: 'wall', blocksMovement: true, blocksLoS: true, providesCover: true });
    const carriedObject: TargetableMapObject = {
      id: 'carried-lantern',
      name: 'Carried Lantern',
      position: { x: 2, y: 1 },
      isWornOrCarried: true,
    };
    mapData.targetableObjects = [carriedObject];
    const characters = [caster, ally, farEnemy, blockedEnemy];

    expect(validate(spells.mindSliver, characters, mapData, [{ kind: 'creature', id: ally.id }])?.code).toBe('requires_enemy');
    expect(validate(spells.guidance, characters, mapData, [{ kind: 'creature', id: ally.id }])?.code).toBe('target_filter_failed');
    expect(validate(spells.light, characters, mapData, [{ kind: 'object', id: carriedObject.id, position: carriedObject.position, object: carriedObject }])?.code).toBe('object_worn_or_carried');
    expect(validate(spells.bless, characters, mapData, [{ kind: 'creature', id: farEnemy.id }])?.code).toBe('out_of_range');
    expect(validate(spells.bless, characters, mapData, [{ kind: 'creature', id: blockedEnemy.id }])?.code).toBe('line_of_sight_blocked');
  });

  it('rejects duplicate and over-cap multi-target selections before actor lookup', () => {
    const caster = actor('caster', 'player', { x: 1, y: 1 });
    const ally = actor('ally', 'player', { x: 2, y: 1 });
    const enemy = actor('enemy', 'enemy', { x: 3, y: 1 });
    const characters = [caster, ally, enemy];
    const mapData = createMap();

    expect(validate(spells.bless, characters, mapData, [
      { kind: 'creature', id: caster.id },
      { kind: 'creature', id: ally.id },
      { kind: 'creature', id: ally.id },
    ])?.code).toBe('duplicate_target');
    expect(validate(spells.bless, characters, mapData, [
      { kind: 'creature', id: caster.id },
      { kind: 'creature', id: ally.id },
      { kind: 'creature', id: enemy.id },
      { kind: 'creature', id: 'fourth-target' },
    ])?.code).toBe('too_many_targets');
  });
});
