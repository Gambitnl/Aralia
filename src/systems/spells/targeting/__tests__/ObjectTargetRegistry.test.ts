import { describe, expect, it } from 'vitest';

import { collectObjectTargetCandidates, withObjectTargetCandidates } from '../ObjectTargetRegistry';
import { TargetResolver } from '../TargetResolver';
import type { BattleMapData, CombatCharacter, CombatState, TargetableMapObject } from '@/types/combat';
import type { Item } from '@/types/items';
import type { SpellTargeting } from '@/types/spells';

/**
 * This file protects the spell object-target registry adapter.
 *
 * The resolver already knows how to validate supplied object candidates. These
 * tests prove the spell targeting layer has a real, explicit candidate source
 * that does not confuse visual map decorations with targetable objects.
 *
 * Called by: focused Vitest runs for object-targeting registry work.
 * Depends on: ObjectTargetRegistry and TargetResolver.
 */

const caster = {
  id: 'caster',
  name: 'Caster',
  team: 'player',
  position: { x: 0, y: 0 }
} as CombatCharacter;

const emptyState = {
  characters: [caster],
  mapData: null
} as unknown as CombatState;

const makeMap = (): BattleMapData => ({
  dimensions: { width: 5, height: 5 },
  theme: 'dungeon',
  seed: 42,
  tiles: new Map([
    ['1-0', {
      id: '1-0',
      coordinates: { x: 1, y: 0 },
      terrain: 'floor',
      decoration: 'boulder',
      blocksMovement: true,
      blocksLoS: false,
      movementCost: 1,
      elevation: 0,
      effects: []
    }]
  ])
} as BattleMapData);

describe('collectObjectTargetCandidates', () => {
  it('accepts the typed battle-map targetableObjects slot as the live object source', () => {
    const mapObject: TargetableMapObject = {
      id: 'typed-crystal',
      name: 'Typed Crystal',
      position: { x: 2, y: 2 },
      size: 'Tiny',
      weightPounds: 1,
      isWornOrCarried: false,
      isMagical: true,
      isFixedToSurface: false
    };
    const mapData: BattleMapData = {
      ...makeMap(),
      targetableObjects: [mapObject]
    };

    expect(collectObjectTargetCandidates({ mapData })).toEqual([mapObject]);
  });


  it('uses explicit positioned map objects and ignores decoration-only tiles', () => {
    const mapData = {
      ...makeMap(),
      targetableObjects: [{
        id: 'loose-stone',
        name: 'Loose Stone',
        position: { x: 1, y: 0 },
        weightPounds: 2,
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: false
      }]
    };

    expect(collectObjectTargetCandidates({ mapData })).toEqual([
      expect.objectContaining({ id: 'loose-stone', name: 'Loose Stone', position: { x: 1, y: 0 } })
    ]);
  });

  it('deduplicates explicit and map-backed objects by id with explicit objects taking priority', () => {
    const mapData = {
      ...makeMap(),
      targetableObjects: [{
        id: 'loose-stone',
        name: 'Map Stone',
        position: { x: 1, y: 0 },
        weightPounds: 2
      }]
    };

    const candidates = collectObjectTargetCandidates({
      mapData,
      explicitObjects: [{
        id: 'loose-stone',
        name: 'Explicit Stone',
        position: { x: 2, y: 0 },
        weightPounds: 1
      }]
    });

    expect(candidates).toEqual([
      expect.objectContaining({ id: 'loose-stone', name: 'Explicit Stone', position: { x: 2, y: 0 } })
    ]);
  });


  it('converts positioned dungeon room features only when target facts are explicit', () => {
    const candidates = collectObjectTargetCandidates({
      roomFeatures: [
        {
          feature: {
            id: 'stone-altar',
            name: 'Stone Altar',
            description: 'A heavy altar carved with lunar script.',
            type: 'landmark',
            interaction: { canInteract: true }
          },
          position: { x: 2, y: 2 },
          targetFacts: {
            size: 'Medium',
            weightPounds: 400,
            isWornOrCarried: false,
            isMagical: false,
            isFixedToSurface: true
          }
        },
        {
          feature: {
            id: 'flavor-tapestry',
            name: 'Flavor Tapestry',
            description: 'A decorative tapestry with no object-targeting facts yet.',
            type: 'furniture',
            interaction: { canInteract: true }
          },
          position: { x: 3, y: 2 }
        }
      ]
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'stone-altar',
        name: 'Stone Altar',
        position: { x: 2, y: 2 },
        weightPounds: 400,
        isFixedToSurface: true
      })
    ]);
  });


  it('converts explicitly positioned loose items into movable object candidates', () => {
    const oilFlask: Item = {
      id: 'oil-flask',
      name: 'Oil Flask',
      description: 'A flask of oil that can be picked up or hurled.',
      type: 'consumable',
      weight: 1
    };

    const candidates = collectObjectTargetCandidates({
      looseItems: [{
        item: oilFlask,
        position: { x: 1, y: 0 },
        instanceId: 'drop-001',
        size: 'Tiny'
      }]
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'loose-item-drop-001',
        name: 'Oil Flask',
        position: { x: 1, y: 0 },
        size: 'Tiny',
        weightPounds: 1,
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: false
      })
    ]);
  });


  it('populates battle-map targetableObjects from registry inputs without mutating the original map', () => {
    const originalMap = makeMap();
    const populatedMap = withObjectTargetCandidates(originalMap, {
      explicitObjects: [{
        id: 'loose-stone',
        name: 'Loose Stone',
        position: { x: 1, y: 0 },
        weightPounds: 2,
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: false
      }],
      roomFeatures: [{
        feature: {
          id: 'stone-altar',
          name: 'Stone Altar',
          description: 'A fixed altar with explicit target facts.',
          type: 'landmark',
          interaction: { canInteract: true }
        },
        position: { x: 2, y: 2 },
        targetFacts: {
          size: 'Medium',
          weightPounds: 400,
          isWornOrCarried: false,
          isMagical: false,
          isFixedToSurface: true
        }
      }]
    });

    expect(originalMap.targetableObjects).toBeUndefined();
    expect(populatedMap).not.toBe(originalMap);
    expect(populatedMap.targetableObjects?.map(targetObject => targetObject.id)).toEqual([
      'loose-stone',
      'stone-altar'
    ]);
  });

  it('feeds registry-backed object candidates into object eligibility validation', () => {
    const targeting: SpellTargeting = {
      type: 'single',
      range: 60,
      validTargets: ['objects'],
      lineOfSight: false,
      filter: {
        objectEligibility: {
          wornOrCarried: 'excluded',
          magicalStatus: 'nonmagical',
          fixedToSurface: 'excluded',
          sizeLimit: { maxSize: 'Small' },
          weightLimit: { maxWeightPounds: 5 }
        }
      }
    };
    const candidates = collectObjectTargetCandidates({
      explicitObjects: [
        { id: 'loose-stone', name: 'Loose Stone', position: { x: 1, y: 0 }, weightPounds: 2, isWornOrCarried: false, isMagical: false, isFixedToSurface: false, size: 'Tiny' },
        { id: 'worn-amulet', name: 'Worn Amulet', position: { x: 1, y: 0 }, weightPounds: 1, isWornOrCarried: true, isMagical: false, isFixedToSurface: false, size: 'Tiny' }
      ]
    });

    const result = TargetResolver.getValidTargetCandidates(targeting, caster, emptyState, candidates);

    expect(result.creatures).toEqual([]);
    expect(result.objects.map(targetObject => targetObject.id)).toEqual(['loose-stone']);
  });

  it('does not treat missing prop mobility or weight as proof that a restrictive spell can move it', () => {
    const targeting: SpellTargeting = {
      type: 'single',
      range: 60,
      validTargets: ['objects'],
      lineOfSight: false,
      filter: {
        objectEligibility: {
          wornOrCarried: 'excluded',
          magicalStatus: 'nonmagical',
          fixedToSurface: 'excluded',
          maxWeightPounds: 5
        }
      }
    };
    const unknownProp = {
      id: 'worldforge-crate',
      name: 'Crate',
      position: { x: 1, y: 0 },
      size: 'Small',
      isWornOrCarried: false,
      isMagical: false
    };

    const rejection = TargetResolver.getObjectTargetRejectionReason(
      targeting,
      caster,
      unknownProp,
      emptyState
    );

    expect(rejection).toMatchObject({ code: 'object_attachment_unknown' });
    expect(TargetResolver.getValidTargetCandidates(targeting, caster, emptyState, [unknownProp]).objects)
      .toEqual([]);

    const looseButUnweighedProp = { ...unknownProp, isFixedToSurface: false };
    expect(TargetResolver.getObjectTargetRejectionReason(
      targeting,
      caster,
      looseButUnweighedProp,
      emptyState
    )).toMatchObject({ code: 'object_weight_unknown' });
  });
});
