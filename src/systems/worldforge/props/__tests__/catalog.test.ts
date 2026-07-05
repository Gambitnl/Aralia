import { describe, it, expect } from 'vitest';
import {
  WAVE1_PROPS,
  WAVE1_PROPS_BY_ID,
  EXPANDED_PROPS,
  PROP_CATALOG,
  PROPS_BY_ID,
  allPlacementTags,
} from '../catalog';
import { validatePropDefinition } from '../propSchema';
import type { MaterialType } from '../../../../types/materials';

const CANON_MATERIALS: MaterialType[] = [
  'wood', 'stone', 'dirt', 'metal', 'lead', 'glass', 'flesh', 'water', 'fabric', 'paper', 'force',
];

describe('WAVE-1 catalog', () => {
  it('has exactly the 14 WAVE-1 entries', () => {
    expect(WAVE1_PROPS).toHaveLength(14);
    const ids = WAVE1_PROPS.map((d) => d.id).sort();
    expect(ids).toEqual(
      [
        'barrel', 'boulder', 'bush', 'cart', 'crate', 'crate-stack', 'fallen-log',
        'fence-run', 'haystack', 'market-stall', 'sack', 'water-trough', 'well', 'woodpile',
      ].sort(),
    );
  });

  it('every entry passes schema validation', () => {
    for (const def of WAVE1_PROPS) {
      expect(validatePropDefinition(def), def.id).toEqual([]);
    }
  });

  it('every entry carries COMPLETE referee data in the canon vocabulary', () => {
    for (const def of PROP_CATALOG) {
      const r = def.referee;
      expect(['none', 'half', 'three-quarters', 'full'], def.id).toContain(r.cover);
      expect(typeof r.blocksLoS).toBe('boolean');
      expect(typeof r.blocksMovement).toBe('boolean');
      expect(typeof r.difficultTerrain).toBe('boolean');
      expect(CANON_MATERIALS, def.id).toContain(r.material);
      expect(r.thicknessInches, def.id).toBeGreaterThan(0);
      expect(typeof def.flammable).toBe('boolean');
      expect(typeof def.destructible).toBe('boolean');
    }
  });

  it('ids are unique and the lookup map matches', () => {
    expect(WAVE1_PROPS_BY_ID.size).toBe(WAVE1_PROPS.length);
    for (const def of WAVE1_PROPS) {
      expect(WAVE1_PROPS_BY_ID.get(def.id)).toBe(def);
    }
  });

  it('exposes the wilderness cover trio and the market-maker', () => {
    expect(WAVE1_PROPS_BY_ID.has('boulder')).toBe(true);
    expect(WAVE1_PROPS_BY_ID.has('fallen-log')).toBe(true);
    expect(WAVE1_PROPS_BY_ID.has('bush')).toBe(true);
    expect(WAVE1_PROPS_BY_ID.get('market-stall')!.placementTags).toContain('market');
  });

  it('collects placement tags including dock + forest', () => {
    const tags = allPlacementTags();
    expect(tags).toContain('docks');
    expect(tags).toContain('forest');
  });

  it('stone props are inert (non-flammable); wood/organic props are flammable', () => {
    expect(WAVE1_PROPS_BY_ID.get('boulder')!.flammable).toBe(false);
    expect(WAVE1_PROPS_BY_ID.get('well')!.flammable).toBe(false);
    expect(WAVE1_PROPS_BY_ID.get('woodpile')!.flammable).toBe(true);
    expect(WAVE1_PROPS_BY_ID.get('haystack')!.flammable).toBe(true);
  });
});

describe('FULL catalog (WAVE-1 + expanded strawman set)', () => {
  it('carries the full strawman: 14 WAVE-1 + 91 expanded = 105 defs', () => {
    expect(EXPANDED_PROPS).toHaveLength(91);
    expect(PROP_CATALOG).toHaveLength(105);
  });

  it('every def in the FULL catalog passes validatePropDefinition', () => {
    for (const def of PROP_CATALOG) {
      expect(validatePropDefinition(def), def.id).toEqual([]);
    }
  });

  it('ids are globally unique and the full lookup map matches', () => {
    expect(PROPS_BY_ID.size).toBe(PROP_CATALOG.length);
    for (const def of PROP_CATALOG) {
      expect(PROPS_BY_ID.get(def.id)).toBe(def);
    }
    // WAVE-1 backbone map stays intact for the GroundWorld bridge.
    expect(WAVE1_PROPS_BY_ID.size).toBe(14);
  });

  it('covers all 16 strawman context tags', () => {
    const tags = allPlacementTags();
    for (const t of [
      'market', 'docks', 'smithy', 'tavern', 'poor-quarter', 'wealthy-quarter',
      'farmstead', 'village-lane', 'gate', 'graveyard',
      'forest', 'rocky-hills', 'riverbank', 'road', 'ruin', 'defile',
    ]) {
      expect(tags, t).toContain(t);
    }
  });

  it('referee sanity: no def is both impassable and difficult; materials are canon', () => {
    for (const def of PROP_CATALOG) {
      expect(def.referee.blocksMovement && def.referee.difficultTerrain, def.id).toBe(false);
      expect(CANON_MATERIALS, def.id).toContain(def.referee.material);
    }
  });

  it('expanded highlights carry the strawman referee rows', () => {
    const gate = PROPS_BY_ID.get('wooden-gate')!;
    expect(gate.referee.cover).toBe('full');
    expect(gate.referee.material).toBe('wood');
    expect(gate.referee.thicknessInches).toBe(4);

    const scree = PROPS_BY_ID.get('scree-field')!;
    expect(scree.referee.difficultTerrain).toBe(true);
    expect(scree.referee.blocksMovement).toBe(false);

    const outcrop = PROPS_BY_ID.get('rock-outcrop')!;
    expect(outcrop.referee.cover).toBe('full');
    expect(outcrop.placementTags).toContain('defile'); // merged concealing crag

    const anvil = PROPS_BY_ID.get('anvil')!;
    expect(anvil.referee.material).toBe('metal');
    expect(anvil.flammable).toBe(false);
  });
});
