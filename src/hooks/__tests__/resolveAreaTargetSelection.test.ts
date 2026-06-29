import { describe, expect, it } from 'vitest';

import { resolveAreaTargetSelection } from '../useAbilitySystem';
import { createMockCombatCharacter } from '../../utils/core/factories';
import type { BattleMapData, CombatCharacter, SelectedSpellTarget } from '../../types/combat';
import type { Spell } from '../../types/spells';
import swordBurst from '../../../public/data/spells/level-0/sword-burst.json';
import wordOfRadiance from '../../../public/data/spells/level-0/word-of-radiance.json';

/**
 * These tests pin the pure area-resolution bridge used by the ability hook.
 *
 * The hook itself still has UI validation and target-pick plumbing around it,
 * so the cleanest regression surface is the resolver that decides which
 * creatures actually survive the area-selection rules for Sword Burst and
 * Word of Radiance.
 */

const makeOpenMap = (): BattleMapData => ({
  dimensions: { width: 8, height: 8 },
  theme: 'dungeon',
  seed: 11,
  tiles: new Map(Array.from({ length: 8 }, (_, x) => x).flatMap(x =>
    Array.from({ length: 8 }, (_, y) => {
      const key = `${x}-${y}`;
      return [key, {
        id: key,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: []
      }];
    })
  ))
});

const makeCreature = (overrides: Partial<CombatCharacter>) =>
  createMockCombatCharacter({
    currentHP: 7,
    maxHP: 7,
    level: 5,
    ...overrides
  });

describe('resolveAreaTargetSelection', () => {
  it('keeps Sword Burst off the caster when resolving the self-centered burst', () => {
    const spell = swordBurst as unknown as Spell;
    const caster = makeCreature({
      id: 'sword-caster',
      name: 'Sword Caster',
      team: 'player',
      position: { x: 3, y: 3 }
    });
    const visibleAlly = makeCreature({
      id: 'sword-ally',
      name: 'Sword Ally',
      team: 'player',
      position: { x: 4, y: 3 }
    });
    const visibleEnemy = makeCreature({
      id: 'sword-enemy',
      name: 'Sword Enemy',
      team: 'enemy',
      position: { x: 3, y: 4 }
    });
    const neutralCreature = makeCreature({
      id: 'sword-neutral',
      name: 'Sword Neutral',
      team: 'neutral',
      position: { x: 2, y: 3 }
    });

    const result = resolveAreaTargetSelection({
      spell,
      caster,
      targetPosition: caster.position,
      characters: [caster, visibleAlly, visibleEnemy, neutralCreature],
      mapData: makeOpenMap()
    });

    expect(result.targetCharacterIds).toEqual(expect.arrayContaining([
      visibleAlly.id,
      visibleEnemy.id,
      neutralCreature.id
    ]));
    expect(result.targetCharacterIds).not.toContain(caster.id);
  });

  it('keeps Word of Radiance on the caster-chosen visible subset and drops hidden creatures', () => {
    const spell = wordOfRadiance as unknown as Spell;
    const caster = makeCreature({
      id: 'radiance-caster',
      name: 'Radiance Caster',
      team: 'player',
      position: { x: 3, y: 3 }
    });
    const visibleAlly = makeCreature({
      id: 'radiance-ally',
      name: 'Radiance Ally',
      team: 'player',
      position: { x: 4, y: 3 }
    });
    const visibleEnemy = makeCreature({
      id: 'radiance-enemy',
      name: 'Radiance Enemy',
      team: 'enemy',
      position: { x: 3, y: 4 }
    });
    const hiddenNeutral = makeCreature({
      id: 'radiance-hidden',
      name: 'Radiance Hidden',
      team: 'neutral',
      position: { x: 2, y: 3 },
      activeEffects: [{
        id: 'ethereal-phase',
        name: 'Ethereal Phase',
        mechanics: {
          planarPhase: 'ethereal'
        }
      } as never]
    });
    const unchosenVisible = makeCreature({
      id: 'radiance-unchosen',
      name: 'Radiance Unchosen',
      team: 'neutral',
      position: { x: 4, y: 4 }
    });
    const mapData = makeOpenMap();
    const hiddenTileKey = `${hiddenNeutral.position.x}-${hiddenNeutral.position.y}`;
    const hiddenTile = mapData.tiles.get(hiddenTileKey);

    if (!hiddenTile) {
      throw new Error(`Expected a tile at ${hiddenTileKey}`);
    }

    mapData.tiles.set(hiddenTileKey, {
      ...hiddenTile,
      blocksLoS: true
    });

    const chosenTargets = [
      { kind: 'creature', id: caster.id },
      { kind: 'creature', id: visibleAlly.id },
      { kind: 'creature', id: visibleEnemy.id },
      { kind: 'creature', id: hiddenNeutral.id }
    ] as SelectedSpellTarget[];

    const result = resolveAreaTargetSelection({
      spell,
      caster,
      targetPosition: caster.position,
      characters: [caster, visibleAlly, visibleEnemy, hiddenNeutral, unchosenVisible],
      mapData,
      selectedSpellTargets: chosenTargets
    });

    expect(result.targetCharacterIds).toEqual(expect.arrayContaining([
      caster.id,
      visibleAlly.id,
      visibleEnemy.id
    ]));
    expect(result.targetCharacterIds).not.toContain(hiddenNeutral.id);
    expect(result.targetCharacterIds).not.toContain(unchosenVisible.id);
  });
});
