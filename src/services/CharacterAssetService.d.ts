/**
 * ARCHITECTURAL CONTEXT:
 * This service is the 'Asset Resolver' for character visual components.
 * It maps high-level visual configurations (gender, skin color, clothing
 * style) to physical file paths in the public assets directory.
 *
 * Recent updates focus on 'Path Robustness'. By using `import.meta.env.BASE_URL`,
 * the service now correctly resolves asset paths regardless of whether
 * the app is running in a local dev server or a deployed sub-path (GitHub Pages).
 *
 * It also includes hardcoded overrides for missing assets (e.g. skin-matched
 * hands) by falling back to generic placeholder layers like 'Sword.png'.
 *
 * @file src/services/CharacterAssetService.ts
 */
import * as PIXI from 'pixi.js';
export type CharacterGender = 'Male' | 'Female';
export interface CharacterVisualConfig {
    gender: CharacterGender;
    skinColor: number;
    hairStyle: string;
    hairColor: string;
    clothing: string;
}
export declare class CharacterAssetService {
    private static instance;
    private textureCache;
    private imageCache;
    private constructor();
    static getInstance(): CharacterAssetService;
    /**
     * Get the relative path to an asset from the src/assets/images/Character Asset Pack directory.
     */
    getAssetPath(category: string, filename: string): string;
    /**
     * Resolves the skin asset path.
     */
    getSkinPath(gender: CharacterGender, color: number): string;
    /**
     * Resolves the hair asset path.
     */
    getHairPath(gender: CharacterGender, style: string): string;
    /**
     * Resolves the clothing asset path.
     */
    getClothingPath(gender: CharacterGender, style: string): string;
    /**
     * Resolves the hand asset path (usually matches skin).
     */
    getHandPath(gender: CharacterGender, _color: number): string;
    /**
     * Loads a texture for PixiJS.
     */
    getTexture(path: string): Promise<PIXI.Texture>;
    /**
     * Loads an image for Canvas rendering.
     */
    getImage(path: string): Promise<HTMLImageElement>;
    /**
     * Helper to get all layers for a character configuration.
     */
    getLayerPaths(config: CharacterVisualConfig): string[];
}
export declare const characterAssetService: CharacterAssetService;
