/**
 * @file forgeAssetService.test.ts — the request→cache→generate core.
 *
 * Spec: docs/projects/worldforge/SPEC.md §7. `request(assetKey) → cached |
 * generate`, content-addressed local cache. No procedural-synthesis fallback:
 * an unresolvable request rejects (async) or returns undefined (sync) and the
 * renderer keeps its own base material. The service must never block the
 * render path.
 */
import { describe, it, expect } from 'vitest';
import { createForgeAssetService } from '../forgeAssetService';
import type { AssetGenerator, ForgeAsset } from '../types';

/** A counting stub generator that returns a recognizable image-bearing asset. */
function stubGenerator(impl?: (key: string) => Promise<ForgeAsset | null>): AssetGenerator & { calls: number } {
  const gen = {
    calls: 0,
    async generate(key: string): Promise<ForgeAsset | null> {
      gen.calls++;
      if (impl) return impl(key);
      return {
        key,
        address: 'deadbeef',
        source: 'generated',
        imageUri: `data:fake/${key}`,
      };
    },
  };
  return gen;
}

describe('createForgeAssetService.request', () => {
  it('rejects when no generator is configured and the key is uncached', async () => {
    const service = createForgeAssetService();
    await expect(service.request('texture/wall/plaster')).rejects.toThrow();
  });

  it('returns and caches a generated asset when a generator is online', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: true });
    const asset = await service.request('texture/wall/plaster');
    expect(asset.source).toBe('generated');
    expect(asset.imageUri).toBe('data:fake/texture/wall/plaster');
    expect(gen.calls).toBe(1);
  });

  it('serves a second request from cache without calling the generator again', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: true });
    await service.request('texture/wall/plaster');
    const second = await service.request('texture/wall/plaster');
    expect(second.source).toBe('cache');
    expect(gen.calls).toBe(1);
  });

  it('dedupes the cache by content address (canonical key)', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: true });
    await service.request('Texture/Wall/Plaster');
    const second = await service.request('texture//wall/plaster/');
    expect(second.source).toBe('cache');
    expect(gen.calls).toBe(1);
  });

  it('propagates the failure (no fallback) when the generator throws', async () => {
    const gen = stubGenerator(async () => {
      throw new Error('image service down');
    });
    const service = createForgeAssetService({ generator: gen, online: true });
    await expect(service.request('texture/wall/plaster')).rejects.toThrow('image service down');
  });

  it('rejects when the generator returns null', async () => {
    const gen = stubGenerator(async () => null);
    const service = createForgeAssetService({ generator: gen, online: true });
    await expect(service.request('texture/wall/plaster')).rejects.toThrow();
  });

  it('does not call the generator while offline', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: false });
    await expect(service.request('texture/wall/plaster')).rejects.toThrow();
    expect(gen.calls).toBe(0);
  });
});

describe('createForgeAssetService.requestSync', () => {
  it('returns undefined for an uncached key (renderer keeps its base material)', () => {
    const service = createForgeAssetService();
    expect(service.requestSync('texture/wall/plaster')).toBeUndefined();
  });

  it('returns the cached asset once generation has warmed the cache', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: true });
    await service.request('texture/wall/plaster');
    expect(service.requestSync('texture/wall/plaster')?.source).toBe('cache');
  });

  it('schedules background generation so a later sync read upgrades to cache', async () => {
    const gen = stubGenerator();
    const service = createForgeAssetService({ generator: gen, online: true });
    // First sync read is undefined but kicks off generation.
    expect(service.requestSync('texture/wall/plaster')).toBeUndefined();
    await service.idle();
    expect(service.requestSync('texture/wall/plaster')?.source).toBe('cache');
    expect(gen.calls).toBe(1);
  });
});
