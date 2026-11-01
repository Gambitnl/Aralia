/**
 * The cloud resolve edge rule hooks into @takram/three-clouds shader text.
 * Headless CI cannot render the clouds, so this proves the part a library
 * upgrade could break silently: the anchors still exist in the shipped
 * shader, the rule lands in the full-resolution TAA path, and the resolve
 * shares the march's own depth and jitter uniform objects. The rendered proof
 * is the motion capture in docs/architecture/domains/world3d-lighting-and-sky.md.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BasicDepthPacking, DepthTexture, RGBADepthPacking } from 'three';
import { CloudsEffect } from '@takram/three-clouds';
import { applyCloudsSceneEdgeResolve, cloudsSceneEdgeRef } from '../cloudsSceneEdgeResolve';

function makeEffect(): CloudsEffect {
  const effect = new CloudsEffect();
  // The game path (VolumetricClouds) runs the full-resolution TAA resolve.
  effect.temporalUpscale = false;
  return effect;
}

describe('applyCloudsSceneEdgeResolve', () => {
  it('adds the scene-edge history reject to the TAA path of the shipped shader', () => {
    const effect = makeEffect();
    expect(applyCloudsSceneEdgeResolve(effect)).toBe(true);
    const src = effect.cloudsPass.resolveMaterial.fragmentShader;
    const taa = src.slice(src.indexOf('void temporalAntialiasing('));
    // The reject runs before the history fetch, inside the TAA function.
    expect(taa.indexOf('araliaTouchesScene(coord)')).toBeGreaterThan(0);
    expect(taa.indexOf('araliaTouchesScene(coord)')).toBeLessThan(taa.indexOf('colorHistoryBuffer'));
    // The helpers sit after neighborOffsets, which they read.
    expect(src.indexOf('bool araliaTouchesScene')).toBeGreaterThan(src.indexOf('neighborOffsets[9]'));
    expect(src.indexOf('bool araliaTouchesScene')).toBeLessThan(src.indexOf('vec4 getClosestFragment('));
  });

  it('shares the march uniform objects, so later depth and jitter writes reach the resolve', () => {
    const effect = makeEffect();
    applyCloudsSceneEdgeResolve(effect);
    const { currentMaterial, resolveMaterial } = effect.cloudsPass;
    const u = resolveMaterial.uniforms as Record<string, unknown>;
    expect(u.araliaSceneDepthBuffer).toBe(currentMaterial.uniforms.depthBuffer);
    expect(u.araliaTargetUvScale).toBe(currentMaterial.uniforms.targetUvScale);
    expect(u.araliaTemporalJitter).toBe(currentMaterial.uniforms.temporalJitter);

    const depth = new DepthTexture(4, 4);
    effect.setDepthTexture(depth, BasicDepthPacking);
    expect((u.araliaSceneDepthBuffer as { value: unknown }).value).toBe(depth);
  });

  it('follows the march depth packing at draw time', () => {
    const effect = makeEffect();
    applyCloudsSceneEdgeResolve(effect);
    const { resolveMaterial } = effect.cloudsPass;
    effect.setDepthTexture(new DepthTexture(4, 4), RGBADepthPacking);
    const version = resolveMaterial.version;
    // three calls material.onBeforeRender right before each draw.
    (resolveMaterial.onBeforeRender as (...a: unknown[]) => void)();
    expect(resolveMaterial.defines.ARALIA_DEPTH_PACKING).toBe(String(RGBADepthPacking));
    expect(resolveMaterial.version).toBeGreaterThan(version);
  });

  it('is idempotent', () => {
    const effect = makeEffect();
    applyCloudsSceneEdgeResolve(effect);
    const once = effect.cloudsPass.resolveMaterial.fragmentShader;
    applyCloudsSceneEdgeResolve(effect);
    expect(effect.cloudsPass.resolveMaterial.fragmentShader).toBe(once);
  });

  it('refuses the upscale path instead of guessing', () => {
    const effect = new CloudsEffect();
    effect.temporalUpscale = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(applyCloudsSceneEdgeResolve(effect)).toBe(false);
    expect(effect.cloudsPass.resolveMaterial.fragmentShader).not.toContain('araliaTouchesScene');
    err.mockRestore();
  });

  it('cloudsSceneEdgeRef patches the effect React hands it and ignores the unmount null', () => {
    const effect = makeEffect();
    cloudsSceneEdgeRef(effect);
    expect(effect.cloudsPass.resolveMaterial.fragmentShader).toContain('araliaTouchesScene(coord)');
    expect(() => cloudsSceneEdgeRef(null)).not.toThrow();
  });
});

// Every <Clouds> in src must carry the rule. Neither cloud setup can render in
// headless CI, so this reads the component source: each <Clouds> element must
// pass ref={cloudsSceneEdgeRef} and temporalUpscale={false} (the only path the
// rule covers). A new cloud setup without them also fails here.
describe('every <Clouds> setup carries the scene-edge rule', () => {
  const SRC = join(__dirname, '..', '..', '..', '..');

  function listTsx(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listTsx(path);
      return entry.name.endsWith('.tsx') ? [path] : [];
    });
  }

  // One entry per <Clouds> JSX element: its opening tag, from `<Clouds` to the
  // first line that closes the tag. Comments that only name <Clouds> do not
  // start a line with it, so they are not counted.
  const setups = listTsx(SRC)
    .filter((file) => readFileSync(file, 'utf8').includes('@takram/three-clouds/r3f'))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/^[ \t]*<Clouds(?=\s)[\s\S]*?^[ \t]*\/?>/gm)].map((m) => ({
        file: relative(SRC, file).replace(/\\/g, '/'),
        tag: m[0],
      }));
    });

  it('finds both known cloud setups', () => {
    const files = setups.map((s) => s.file).sort();
    expect(files).toEqual(['components/World3D/VolumetricClouds.tsx', 'components/World3D/sky/TakramSkySystem.tsx']);
  });

  it.each(setups.map((s) => [s.file, s.tag] as const))('%s passes the rule ref and the TAA path', (_file, tag) => {
    expect(tag).toContain('ref={cloudsSceneEdgeRef}');
    expect(tag).toContain('temporalUpscale={false}');
  });
});
