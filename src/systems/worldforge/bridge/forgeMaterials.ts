// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:30:56
 * Dependents: components/DesignPreview/steps/PreviewBuilding3D.tsx, components/World3D/World3DScene.tsx, systems/world3d/buildingSceneModel.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file gives Worldforge surfaces stable texture names and loads those textures.
 *
 * Production buildings call the semantic-key resolver and the shared loader hook through
 * World3DScene. The Building Identity Lab calls the same two functions with an explicit,
 * deterministic preview image so reviewers can see resolved construction materials without
 * contacting the runtime image generator. A missing service still means "no texture" unless
 * that preview image is deliberately supplied, preserving the production fallback contract.
 *
 * Called by: World3DScene, buildingSceneModel, and PreviewBuilding3D
 * Depends on: the Forge asset service, resolved construction material names, and Three.js
 */

import { useState, useEffect } from 'react';
import * as THREE from 'three';
import type { ForgeAssetService } from '../assets/forgeAssetService';
import type { RoofCovering, WallMaterial } from '../interior/blueprintTypes';

// ============================================================================
// Semantic Surface Vocabulary
// ============================================================================
// Resolved construction names take precedence over the older role-based names.
// The role rules remain below as an exact compatibility tail for older buildings.
// ============================================================================

export type SurfaceKind = 'wall' | 'roof' | 'ground';

export interface SurfaceContext {
  role?: string;
  surface: SurfaceKind;
  biome?: string;
  era?: string;
  /** Exact wall assembly already chosen by the building generator. */
  wallMaterial?: WallMaterial;
  /** Exact roof covering already chosen by the building generator. */
  roofCovering?: RoofCovering;
}

/** Stable texture path segments for every resolved wall material. */
const WALL_MATERIAL_PATH: Readonly<Record<WallMaterial, string>> = {
  'rubble-stone': 'stone/rubble',
  'dressed-stone': 'stone/dressed',
  'limewashed-stone': 'stone/limewashed',
  weatherboard: 'wood/weatherboard',
  'tarred-board': 'wood/tarred-board',
  'timber-plaster': 'plaster/timber-frame',
  'brick-infill': 'brick/infill',
  'round-log': 'wood/round-log',
  'hewn-log': 'wood/hewn-log',
  'wattle-daub': 'daub/wattle',
};

/** Stable texture path segments for every resolved roof covering. */
const ROOF_COVERING_PATH: Readonly<Record<RoofCovering, string>> = {
  slate: 'slate/split',
  'stone-slab': 'stone/slab',
  'wood-shingle': 'wood/shingle',
  'reed-thatch': 'thatch/reed',
  'clay-tile': 'tile/clay',
  sod: 'sod/living',
};

/**
 * Pure mapping from a site/part context to a semantic asset key.
 * Deterministic vocabulary based on role, surface kind, and biome.
 */
export function getSemanticAssetKey({
  role,
  surface,
  biome,
  wallMaterial,
  roofCovering,
}: SurfaceContext): string {
  const b = biome || 'temperate';
  const r = role || 'default';

  // A resolved material is the generator's final construction decision. Use it
  // directly so two buildings with different kits cannot collapse to one role texture.
  if (surface === 'wall' && wallMaterial) {
    return `texture/wall/${WALL_MATERIAL_PATH[wallMaterial]}/${b}`;
  }
  if (surface === 'roof' && roofCovering) {
    return `texture/roof/${ROOF_COVERING_PATH[roofCovering]}/${b}`;
  }

  // Older chunks do not carry resolved construction. Their exact historical
  // role-and-biome keys stay unchanged so caches and production fallback agree.
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

// ============================================================================
// Explicit Building-Lab Preview Images
// ============================================================================
// The lab has no runtime image-generation service. These quiet neutral hatches
// make its semantic key visible while leaving production cache-miss behavior alone.
// The image is supplied explicitly to useForgeTexture; it is never an implicit fallback.
// ============================================================================

/** Return one small tileable SVG that visually explains a semantic material key. */
export function forgeMaterialPreviewImageUri(assetKey: string | undefined): string | undefined {
  if (!assetKey) return undefined;

  // The neutral ink is intentionally low contrast. Mesh color and toon lighting
  // remain responsible for palette and light bands; the image adds only material rhythm.
  const background = '#f2ece2';
  // Brick infill sits behind dense half-timber dressing in the fixed lab view,
  // so its mortar needs a firmer neutral line to remain legible at 1600x1000.
  // Other materials keep the quieter ink proven not to muddy toon light bands.
  const brickInfill = assetKey.includes('/brick/');
  const ink = brickInfill ? '#5d4938' : '#887d70';
  const inkOpacity = brickInfill ? 0.78 : 0.5;
  const strokeWidth = brickInfill ? 4 : 3;
  let marks: string;

  if (assetKey.includes('/brick/')) {
    marks = '<path d="M0 16H96M0 48H96M0 80H96M24 0V16M72 0V16M48 16V48M24 48V80M72 48V80M48 80V96"/>';
  } else if (assetKey.includes('/tile/clay/')) {
    marks = '<path d="M0 16Q12 32 24 16T48 16T72 16T96 16M-12 48Q0 64 12 48T36 48T60 48T84 48T108 48M0 80Q12 96 24 80T48 80T72 80T96 80"/>';
  } else if (assetKey.includes('/slate/') || assetKey.includes('/stone/slab/')) {
    marks = '<path d="M0 0V32H40V0M40 0V32H96M0 32V64H56V32M56 32V64H96M0 64V96H32V64M32 64V96H76V64M76 64V96"/>';
  } else if (assetKey.includes('/shingle/')) {
    marks = '<path d="M0 0V30H24V0M24 0V30H48V0M48 0V30H72V0M72 0V30H96M-12 30V62H12V30M12 30V62H36V30M36 30V62H60V30M60 30V62H84V30M84 30V62H108M0 62V94H24V62M24 62V94H48V62M48 62V94H72V62M72 62V94H96"/>';
  } else if (assetKey.includes('/thatch/')) {
    marks = '<path d="M8 -8L0 32M28 -8L16 40M48 -8L32 36M68 -8L52 42M88 -8L72 36M108 -8L88 40M12 40L0 88M36 36L20 96M60 40L44 100M84 36L68 96M108 40L92 100"/>';
  } else if (assetKey.includes('/sod/')) {
    marks = '<path d="M0 70Q16 42 32 70T64 70T96 70M8 72L0 96M28 68L22 96M52 70L48 96M76 68L72 96M92 70L88 96"/>';
  } else if (assetKey.includes('/round-log/') || assetKey.includes('/hewn-log/')) {
    marks = '<path d="M0 16H96M0 32H96M0 48H96M0 64H96M0 80H96M16 12Q24 16 16 20M64 44Q72 48 64 52M32 76Q40 80 32 84"/>';
  } else if (assetKey.includes('/weatherboard/') || assetKey.includes('/tarred-board/')) {
    marks = '<path d="M0 18H96M0 38H96M0 58H96M0 78H96M18 0V18M68 18V38M36 38V58M82 58V78M48 78V96"/>';
  } else if (assetKey.includes('/stone/')) {
    marks = '<path d="M0 20L18 12L38 22L58 10L78 20L96 12M0 52L24 42L46 54L70 40L96 50M0 84L16 72L42 86L64 70L88 84L96 78M18 12L24 42M58 10L46 54M78 20L70 40M16 72L24 42M64 70L70 40"/>';
  } else {
    marks = '<path d="M0 24L96 8M0 56L96 40M0 88L96 72M18 0L0 36M58 0L24 68M96 0L48 96M96 40L68 96"/>';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${background}"/><g fill="none" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${inkOpacity}">${marks}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// Shared Texture Loading Hook
// ============================================================================
// One hook call owns one texture object and disposes it when the semantic key
// changes or the consumer unmounts. Consumers share that object across meshes.
// ============================================================================

/**
 * Hook to request and load a texture from the ForgeAssetService.
 * Returns the THREE.Texture if available in the cache (or once generated if async),
 * otherwise undefined. Correctly disposes of the texture when unmounted.
 */
export function useForgeTexture(
  assetKey: string | undefined,
  service: ForgeAssetService | undefined,
  previewImageUri?: string,
): THREE.Texture | undefined {
  const [texture, setTexture] = useState<THREE.Texture | undefined>();

  useEffect(() => {
    if (!assetKey || (!service && !previewImageUri)) {
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

    // The lab deliberately supplies its neutral evidence tile. Production does
    // not pass this value and therefore keeps its established cache/generator path.
    if (previewImageUri) {
      applyImageUri(previewImageUri);
    } else {
      // Use request() to get it if cached, or wait for the configured generator.
      // A production cache miss with no generator remains an undefined texture.
      service!.request(assetKey)
        .then((asset) => {
          if (asset && asset.imageUri) {
            applyImageUri(asset.imageUri);
          }
        })
        .catch(() => {
          if (!disposed) {
            setTexture(undefined);
          }
        });
    }

    return () => {
      disposed = true;
      if (loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [assetKey, service, previewImageUri]);

  return texture;
}
