import { describe, expect, it } from 'vitest';
import { buildSpellMapArtifactMarkers } from '../spellMapArtifacts';

/**
 * Object-result records are combat state, but the map only knows how to draw
 * compact artifact markers. These tests keep object damage, repairs, access
 * changes, fire state, and transformation state visible through the same
 * marker contract as helpers and guardians.
 */
describe('buildSpellMapArtifactMarkers object results', () => {
  it('turns object impacts, repairs, access changes, and fire effects into map markers', () => {
    const markers = buildSpellMapArtifactMarkers({
      objectImpacts: [{
        id: 'impact-1',
        objectId: 'dry-crate',
        objectName: 'Dry Crate',
        position: { x: 2, y: 1 },
        sourceSpellId: 'fire-bolt',
        sourceSpellName: 'Fire Bolt',
        casterId: 'caster',
        damage: { dice: '1d10', type: 'fire' },
        createdTurn: 0
      }],
      objectRepairs: [{
        id: 'repair-1',
        objectId: 'cracked-vase',
        objectName: 'Cracked Vase',
        position: { x: 3, y: 1 },
        sourceSpellId: 'mending',
        sourceSpellName: 'Mending',
        casterId: 'caster',
        createdTurn: 0,
        outcome: 'repaired',
        repairState: {
          targetKind: 'object',
          repairLimit: 'single_break_or_tear',
          maxDamageDimensionFeet: 1,
          leavesNoTrace: true,
          canPhysicallyRepairMagicItem: true,
          restoresMagicToMagicItem: false
        }
      }],
      objectAccessChanges: [{
        id: 'access-1',
        objectId: 'locked-door',
        objectName: 'Locked Door',
        position: { x: 4, y: 1 },
        sourceSpellId: 'knock',
        sourceSpellName: 'Knock',
        casterId: 'caster',
        createdTurn: 0,
        outcome: 'suppressed_magical_lock',
        suppressesMagicalClosure: 'arcane-lock',
        targetOperableDuringSuppression: true
      }, {
        id: 'access-2',
        objectId: 'vault-door',
        objectName: 'Vault Door',
        position: { x: 5, y: 1 },
        sourceSpellId: 'arcane-lock',
        sourceSpellName: 'Arcane Lock',
        casterId: 'caster',
        createdTurn: 0,
        outcome: 'magically_locked',
        nonmagicalUnlockBlocked: true
      }],
      fireEffects: [{
        id: 'fire-1',
        spellId: 'fire-bolt',
        sourceName: 'Fire Bolt',
        casterId: 'caster',
        position: { x: 2, y: 1 },
        createdTurn: 0,
        kind: 'ignited_object',
        objectId: 'dry-crate',
        objectName: 'Dry Crate',
        damage: { dice: '1d10', type: 'fire' },
        ignitesTouchedObjects: true,
        excludesWornOrCarriedObjects: true
      }]
    });

    expect(markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: 'object-impact',
        label: 'BURN',
        position: { x: 2, y: 1 },
        title: expect.stringContaining('Fire Bolt hit Dry Crate')
      }),
      expect.objectContaining({
        family: 'object-repair',
        label: 'MEND',
        position: { x: 3, y: 1 },
        title: expect.stringContaining('Mending repaired: Cracked Vase')
      }),
      expect.objectContaining({
        family: 'object-access',
        label: 'SUPP',
        position: { x: 4, y: 1 },
        title: expect.stringContaining('Knock suppressed magical lock: Locked Door')
      }),
      expect.objectContaining({
        family: 'object-access',
        label: 'LOCK',
        position: { x: 5, y: 1 },
        title: expect.stringContaining('Arcane Lock magically locked: Vault Door')
      }),
      expect.objectContaining({
        family: 'fire-effect',
        label: 'FIRE',
        position: { x: 2, y: 1 },
        title: expect.stringContaining('Fire Bolt ignited object: Dry Crate')
      })
    ]));
  });

  it('turns True Polymorph object transformation state into map markers', () => {
    const markers = buildSpellMapArtifactMarkers({
      truePolymorphTransformations: [{
        id: 'tp-object-creature',
        mode: 'object_to_creature',
        spellId: 'true-polymorph',
        spellName: 'True Polymorph',
        casterId: 'caster',
        sourceObjectId: 'loose-boulder',
        sourceObjectName: 'Loose Boulder',
        sourceObjectPosition: { x: 4, y: 1 },
        transformedCreatureId: 'loose-boulder-creature',
        controlledUntilFullDuration: true,
        createdTurn: 0
      }, {
        id: 'tp-creature-object',
        mode: 'creature_to_object',
        spellId: 'true-polymorph',
        spellName: 'True Polymorph',
        casterId: 'caster',
        sourceCreatureId: 'target',
        sourceCreatureName: 'Fallen Knight',
        sourceCreaturePosition: { x: 5, y: 1 },
        transformedObjectName: 'Marble Statue',
        createdTurn: 0
      }]
    });

    expect(markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: 'transformation',
        label: 'OBJ>CR',
        position: { x: 4, y: 1 },
        title: expect.stringContaining('True Polymorph transformation: Loose Boulder into creature')
      }),
      expect.objectContaining({
        family: 'transformation',
        label: 'CR>OBJ',
        position: { x: 5, y: 1 },
        title: expect.stringContaining('True Polymorph transformation: Fallen Knight into Marble Statue')
      })
    ]));
  });
});
