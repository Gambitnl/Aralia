import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

/**
 * The sky dome is the only hand-written material in the battle-map scene, and
 * a hand-written material is the only one that can write the wrong colour
 * space. three's WebGLProgram puts the DEFINITIONS of the output conversion
 * into every non-raw fragment prefix and none of the CALLS; built-in materials
 * bring the calls in through their own chunks, and nothing warns you when a
 * custom one does not.
 *
 * Without the two includes the dome wrote working-space linear straight to the
 * sRGB canvas on the direct-render path, so `__bm3dCam.capture()` — the path
 * every headless proof of this board goes through — showed the desert sky at
 * (166, 142, 90) against a fogged apron at (205, 191, 160): a flat dark band
 * along the top of the frame where the far dunes ended (agora-db71.26,
 * 2026-09-20, poseTeam('enemy', 14, 70, 20)). After the fix the same pixels
 * read (218, 212, 192).
 *
 * This is a source-level gate on purpose. The defect is invisible to any
 * assertion about geometry, colour uniforms or draw calls — it lives entirely
 * in whether two lines are present and in which order — so the only thing
 * worth pinning is exactly that.
 */

vi.mock('@react-three/fiber', () => ({
  useThree: (select?: (s: unknown) => unknown) => {
    const state = { gl: { info: { render: {}, memory: {} } } };
    return select ? select(state) : state;
  },
  useFrame: vi.fn(),
  Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bloom: () => null,
  N8AO: () => null,
  ToneMapping: () => null,
  Vignette: () => null,
}));

vi.mock('postprocessing', () => ({
  BlendFunction: { NORMAL: 'normal' },
  ToneMappingMode: { ACES_FILMIC: 'aces-filmic' },
}));

import { createSkyDomeMaterial } from '../BattleMap3D';

/** The desert fog colour, which is also the dome's horizon band. */
const DESERT_FOG = 0xd8c8a0;

describe('sky dome material', () => {
  it('converts its own output, in the order three requires', () => {
    const material = createSkyDomeMaterial('desert', DESERT_FOG);
    const frag = material.fragmentShader;

    const write = frag.indexOf('gl_FragColor');
    const tone = frag.indexOf('#include <tonemapping_fragment>');
    const space = frag.indexOf('#include <colorspace_fragment>');

    expect(tone).toBeGreaterThan(-1);
    expect(space).toBeGreaterThan(-1);
    // Both conversions act on gl_FragColor, so both must follow the write.
    expect(tone).toBeGreaterThan(write);
    // Tone map in linear, THEN encode. Reversed, the encode is tone-mapped.
    expect(space).toBeGreaterThan(tone);

    material.dispose();
  });

  it('is a ShaderMaterial that still receives the conversion definitions', () => {
    const material = createSkyDomeMaterial('desert', DESERT_FOG);

    // A RawShaderMaterial gets neither the definitions nor the calls, so the
    // includes above would fail to compile rather than fix anything.
    expect((material as unknown as { isRawShaderMaterial?: boolean }).isRawShaderMaterial).toBeFalsy();
    expect(material.isShaderMaterial).toBe(true);
    // `toneMapped` is what makes the TONE_MAPPING define appear at all.
    expect(material.toneMapped).toBe(true);

    material.dispose();
  });

  it('takes its horizon band from the fog colour it is given', () => {
    const material = createSkyDomeMaterial('desert', DESERT_FOG);
    const horizon = material.uniforms.uHorizonColor.value as THREE.Color;

    expect(horizon.getHex()).toBe(DESERT_FOG);
    // Below the horizon the dome is the same colour taken down a stop — not a
    // fourth palette that can drift away from the fog the ground fades into.
    const bottom = material.uniforms.uBottomColor.value as THREE.Color;
    expect(bottom.r).toBeCloseTo(horizon.r * 0.62, 5);
    expect(bottom.g).toBeCloseTo(horizon.g * 0.62, 5);
    expect(bottom.b).toBeCloseTo(horizon.b * 0.62, 5);

    material.dispose();
  });

  it('gives every biome a zenith and never an undefined one', () => {
    for (const biome of ['forest', 'desert', 'swamp', 'cave', 'dungeon', 'nonsense']) {
      const material = createSkyDomeMaterial(biome, DESERT_FOG);
      const top = material.uniforms.uTopColor.value as THREE.Color;
      expect(Number.isFinite(top.r + top.g + top.b)).toBe(true);
      material.dispose();
    }
  });
});
