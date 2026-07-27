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
import * as THREE from 'three';
import type { ForgeAssetService } from '../assets/forgeAssetService';
import type { RoofCovering, WallMaterial } from '../interior/blueprintTypes';
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
/**
 * Pure mapping from a site/part context to a semantic asset key.
 * Deterministic vocabulary based on role, surface kind, and biome.
 */
export declare function getSemanticAssetKey({ role, surface, biome, wallMaterial, roofCovering, }: SurfaceContext): string;
/** Return one small tileable SVG that visually explains a semantic material key. */
export declare function forgeMaterialPreviewImageUri(assetKey: string | undefined): string | undefined;
/**
 * Hook to request and load a texture from the ForgeAssetService.
 * Returns the THREE.Texture if available in the cache (or once generated if async),
 * otherwise undefined. Correctly disposes of the texture when unmounted.
 */
export declare function useForgeTexture(assetKey: string | undefined, service: ForgeAssetService | undefined, previewImageUri?: string): THREE.Texture | undefined;
