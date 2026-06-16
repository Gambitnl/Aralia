import { useState, useEffect } from 'react';
import * as THREE from 'three';
import type { ForgeAssetService } from '../assets/forgeAssetService';

export type SurfaceKind = 'wall' | 'roof' | 'ground';

export interface SurfaceContext {
  role?: string;
  surface: SurfaceKind;
  biome?: string;
  era?: string;
}

/**
 * Pure mapping from a site/part context to a semantic asset key.
 * Deterministic vocabulary based on role, surface kind, and biome.
 */
export function getSemanticAssetKey({ role, surface, biome, era }: SurfaceContext): string {
  const b = biome || 'temperate';
  const r = role || 'default';
  
  if (surface === 'wall') {
    if (r === 'market') return `texture/wall/plaster/amber/${b}`;
    if (r === 'dungeon') return `texture/wall/stone/dark/${b}`;
    if (r === 'ruin') return `texture/wall/stone/cracked/${b}`;
    return `texture/wall/plaster/weathered/${b}`;
  }
  if (surface === 'roof') {
    if (r === 'market') return `texture/roof/tile/clay/${b}`;
    if (r === 'dungeon') return `texture/roof/stone/flat/${b}`;
    if (r === 'ruin') return `texture/roof/wood/rotten/${b}`;
    return `texture/roof/thatch/worn/${b}`;
  }
  if (surface === 'ground') {
    return `texture/ground/grass/wild/${b}`;
  }
  return `texture/unknown/default/${b}`;
}

/**
 * Hook to request and load a texture from the ForgeAssetService.
 * Returns the THREE.Texture if available in the cache (or once generated if async),
 * otherwise undefined. Correctly disposes of the texture when unmounted.
 */
export function useForgeTexture(
  assetKey: string | undefined,
  service: ForgeAssetService | undefined
): THREE.Texture | undefined {
  const [texture, setTexture] = useState<THREE.Texture | undefined>();

  useEffect(() => {
    if (!assetKey || !service) {
      setTexture(undefined);
      return;
    }

    let disposed = false;
    let loadedTexture: THREE.Texture | undefined;

    const applyImageUri = (imageUri: string) => {
      if (disposed) return;
      const loader = new THREE.TextureLoader();
      loader.load(imageUri, (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        setTexture(tex);
        loadedTexture = tex;
      });
    };

    // Use request() to get it if it's cached, or wait for generator.
    // If not cached and no generator, it rejects, which we catch.
    service.request(assetKey)
      .then((asset) => {
        if (asset && asset.imageUri) {
          applyImageUri(asset.imageUri);
        }
      })
      .catch(() => {
        // Cache miss and no generator; stays undefined.
        if (!disposed) {
          setTexture(undefined);
        }
      });

    return () => {
      disposed = true;
      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [assetKey, service]);

  return texture;
}
