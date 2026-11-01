/**
 * The ONE effect class slice 2 wires end to end: an explosion craters the
 * ground. These tests exist because the failure mode is silent in both
 * directions — a classifier that is too loose puts a hole under Magic Missile,
 * and one that is too tight leaves a Fireball scorch-free — and neither shows
 * up as an error, only as a board that is wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  groundImpactOfAbility,
  CRATER_OF_BLAST,
  MAX_CRATER_TILES,
  MIN_BLAST_FEET,
  CENTRE_BELOW_SURFACE,
} from '../groundImpact';
import fs from 'node:fs';
import path from 'node:path';
import { VoxelVolume, Material } from '@/systems/worldforge/terrain/voxelVolume';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import { createAbilityFromSpell } from '@/utils/character/spellAbilityFactory';
import { createMockPlayerCharacter } from '@/utils/core/factories';
import type { Spell } from '@/types/spells';

/**
 * A Fireball as a combat ability really carries it (GG-533, 2026-10-29): its
 * area in TILES (a 20 ft radius is 4) and its damage type in its effects. The
 * first fixture here used feet and a top-level `spell.damage`, a shape no real
 * ability has, so the tests passed while real Fireballs never cratered.
 */
const fireball = {
  type: 'spell',
  areaOfEffect: { shape: 'circle', size: 4 },
  effects: [{ type: 'damage', damageType: 'fire' }],
};

describe('which effects crater the ground', () => {
  it('an explosion does, scaled to its own blast', () => {
    const impact = groundImpactOfAbility(fireball);
    expect(impact).not.toBeNull();
    // 20 ft is 4 tiles of blast; the crater is a fraction of it.
    expect(impact!.radiusM).toBeCloseTo(4 * CRATER_OF_BLAST, 6);
    expect(impact!.depthM).toBeCloseTo(impact!.radiusM * CENTRE_BELOW_SURFACE, 6);
  });

  it('no single cast reshapes more of the board than the cap', () => {
    const huge = { ...fireball, areaOfEffect: { shape: 'circle', size: 60 } };
    expect(groundImpactOfAbility(huge)!.radiusM).toBe(MAX_CRATER_TILES);
  });

  it('a single-target spell does not, however much damage it deals', () => {
    expect(groundImpactOfAbility({ type: 'spell', effects: [{ type: 'damage', damageType: 'fire' }] })).toBeNull();
  });

  it('a cone or a line does not — the class is a POINT-CENTRED blast', () => {
    for (const shape of ['cone', 'line', 'cube', 'wall']) {
      expect(
        groundImpactOfAbility({ ...fireball, areaOfEffect: { shape, size: 6 } }),
      ).toBeNull();
    }
  });

  it('a large area of the wrong damage type does not', () => {
    for (const type of ['cold', 'poison', 'radiant', 'necrotic', 'psychic']) {
      expect(
        groundImpactOfAbility({ ...fireball, effects: [{ type: 'damage', damageType: type }] }),
      ).toBeNull();
    }
  });

  it('a blast too small to move earth does not', () => {
    expect(
      groundImpactOfAbility({ ...fireball, areaOfEffect: { shape: 'circle', size: MIN_BLAST_FEET / 5 - 1 } }),
    ).toBeNull();
    expect(
      groundImpactOfAbility({ ...fireball, areaOfEffect: { shape: 'circle', size: MIN_BLAST_FEET / 5 } }),
    ).not.toBeNull();
  });

  it('reads the flattened areaShape/areaSize shape too', () => {
    const flat = { type: 'spell', areaShape: 'circle', areaSize: 4, damage: { type: 'thunder' } };
    expect(groundImpactOfAbility(flat)).not.toBeNull();
  });

  it('reads the spell data\'s own area in feet when the ability carries none', () => {
    const data = { type: 'spell', spell: { targeting: { areaOfEffect: { shape: 'Sphere', size: 20 } }, effects: [{ damage: { type: 'Fire' } }] } };
    expect(groundImpactOfAbility(data)!.radiusM).toBeCloseTo(4 * CRATER_OF_BLAST, 6);
  });

  it('craters for the real Fireball ability the game builds from the spell data', () => {
    const file = path.resolve(__dirname, '../../../../public/data/spells/level-3/fireball.json');
    const spell = JSON.parse(fs.readFileSync(file, 'utf-8')) as Spell;
    const ability = createAbilityFromSpell(spell, createMockPlayerCharacter({ spellcastingAbility: 'intelligence' }));
    const impact = groundImpactOfAbility(ability);
    expect(impact).not.toBeNull();
    expect(impact!.radiusM).toBeCloseTo(4 * CRATER_OF_BLAST, 6);
  });

  it('nothing at all is not a crater', () => {
    expect(groundImpactOfAbility(null)).toBeNull();
    expect(groundImpactOfAbility(undefined)).toBeNull();
  });
});

describe('the crater the classifier asks for is the crater the brush digs', () => {
  /* A volume whose cells are NOT cubes, because that is what the arena ships:
   * 0.5 m across and 0.15 m down. The brush must still cut a SPHERE in the
   * world — a single cell-count radius would flatten it into an egg by exactly
   * the ratio between the two cell sizes. */
  const CELL_M = 0.5;
  const CELL_HM = 0.15;

  const solidVolume = (): VoxelVolume => {
    /* Tall enough on Y that a 1.8 m sphere fits inside it: 32 cells of 0.15 m
     * is 4.8 m, and the centre sits at 2.4. A shorter volume would let the
     * measurement below run off the roof and read the sky as a hole. */
    const v = new VoxelVolume(32, 32);
    for (let z = 0; z < 32; z++) {
      for (let x = 0; x < 32; x++) {
        for (let y = 0; y < 32; y++) v.set(x, y, z, Material.Subsoil);
      }
    }
    return v;
  };

  it('cuts a sphere in WORLD space, not in cell space', () => {
    const volume = solidVolume();
    const originM = [0, 0, 0] as const;
    const impact = groundImpactOfAbility(fireball)!;
    const centre = [8, 2.4, 8] as const;
    applyBrush({ volume, cellM: CELL_M, cellHM: CELL_HM, originM }, centre, {
      shape: 'sphere',
      mode: 'dig',
      radiusM: impact.radiusM,
    });

    // Walk out from the centre on each axis and find the last empty cell.
    const emptyRunM = (dx: number, dy: number, dz: number): number => {
      const cx = centre[0] / CELL_M;
      const cy = centre[1] / CELL_HM;
      const cz = centre[2] / CELL_M;
      let k = 0;
      for (; k < 200; k++) {
        const x = Math.round(cx + dx * k);
        const y = Math.round(cy + dy * k);
        const z = Math.round(cz + dz * k);
        if (volume.get(x, y, z) !== Material.Air) break;
      }
      return k * (dy !== 0 ? CELL_HM : CELL_M);
    };

    const across = emptyRunM(1, 0, 0);
    const up = emptyRunM(0, 1, 0);
    const along = emptyRunM(0, 0, 1);
    /* The hole reaches the same DISTANCE on every axis. The tolerance is a
     * cell and a half of the COARSE axis because the radius is rounded to whole
     * cells on each: 1.8 m becomes 4 cells of 0.5 (2.0 m) across and 12 cells
     * of 0.15 (1.8 m) up, so a half-cell of discretization on each end is the
     * floor of what any lattice can do. What is being ruled out is the failure
     * this test exists for — a single cell-count radius, which would make the
     * vertical reach 4 cells (0.6 m) and the crater an egg. */
    expect(Math.abs(across - up)).toBeLessThan(CELL_M * 1.5);
    expect(Math.abs(across - along)).toBeLessThan(CELL_M * 1.5);
    expect(across).toBeGreaterThan(impact.radiusM * 0.6);
  });

  it('changes cells, and reports the window it changed', () => {
    const volume = solidVolume();
    const res = applyBrush(
      { volume, cellM: CELL_M, cellHM: CELL_HM, originM: [0, 0, 0] },
      [8, 2.4, 8],
      { shape: 'sphere', mode: 'dig', radiusM: 1.8 },
    );
    expect(res.changed).toBeGreaterThan(0);
    expect(res.max[0]).toBeGreaterThanOrEqual(res.min[0]);
    // The window is inside the volume on Y, which is now shorter than X and Z.
    expect(res.max[1]).toBeLessThan(volume.cellsY);
  });
});
