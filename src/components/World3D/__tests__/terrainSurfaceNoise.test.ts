/**
 * The whole effect hangs on two `String.replace` calls finding their three.js
 * include markers. A marker that is renamed upstream, or a chunk that is not
 * present in the compiled MeshStandardMaterial, makes `replace` a silent no-op:
 * the shader still compiles, the terrain still renders, and the noise term is
 * simply gone. That failure is invisible in review and only shows up as "the
 * seams came back", so it is asserted here rather than eyeballed.
 */
import { describe, it, expect } from 'vitest';
import {
  applyTerrainSurfaceNoise,
  TERRAIN_NOISE_BAND_M,
  TERRAIN_SURFACE_NOISE_CACHE_KEY,
} from '../terrain/terrainSurfaceNoise';

const stubShader = () => ({
  vertexShader: 'void main() {\n#include <begin_vertex>\n}\n',
  fragmentShader: 'void main() {\n#include <color_fragment>\n}\n',
});

describe('terrainSurfaceNoise', () => {
  it('injects into both stages and keeps the original include', () => {
    const s = stubShader();
    applyTerrainSurfaceNoise(s);

    expect(s.vertexShader).toContain('#include <begin_vertex>');
    expect(s.vertexShader).toContain('vAraliaTerrainXZ = (modelMatrix');
    expect(s.fragmentShader).toContain('#include <color_fragment>');
    expect(s.fragmentShader).toContain('araliaTerrainFbm(vAraliaTerrainXZ)');
    // The varying has to be declared in BOTH stages or the program fails to link.
    expect(s.vertexShader).toContain('varying vec2 vAraliaTerrainXZ;');
    expect(s.fragmentShader).toContain('varying vec2 vAraliaTerrainXZ;');
  });

  it('perturbs the colour after vColor is applied, not before', () => {
    const s = stubShader();
    applyTerrainSurfaceNoise(s);
    const include = s.fragmentShader.indexOf('#include <color_fragment>');
    const perturb = s.fragmentShader.indexOf('diffuseColor.rgb *= araliaTint');
    expect(include).toBeGreaterThan(-1);
    expect(perturb).toBeGreaterThan(include);
  });

  it('covers the 1-40 m band the detail map leaves empty', () => {
    // groundDetailTexture tiles every 3 m with its coarsest octave 4 cells
    // across, so it carries nothing above ~0.75 m. The per-vertex colour lattice
    // is 8 m. The term has to span that gap or neither fault moves.
    const [fine, coarse] = TERRAIN_NOISE_BAND_M;
    expect(fine).toBeGreaterThan(0.75);
    expect(coarse).toBeGreaterThan(8);
  });

  it('has a cache key that changes with the tuning', () => {
    expect(TERRAIN_SURFACE_NOISE_CACHE_KEY).toMatch(/^aralia-terrain-noise-/);
  });
});
