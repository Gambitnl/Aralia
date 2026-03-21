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
    skinColor: number; // 1-5
    hairStyle: string; // "Hair1", "Hair2", etc.
    hairColor: string; // TBD if colorable or separate files
    clothing: string;  // "Clothing1", etc.
}

export class CharacterAssetService {
    private static instance: CharacterAssetService;
    private textureCache: Map<string, PIXI.Texture> = new Map();
    private imageCache: Map<string, HTMLImageElement> = new Map();

    private constructor() { }

    public static getInstance(): CharacterAssetService {
        if (!CharacterAssetService.instance) {
            CharacterAssetService.instance = new CharacterAssetService();
        }
        return CharacterAssetService.instance;
    }

    /**
     * Get the relative path to an asset from the src/assets/images/Character Asset Pack directory.
     */
    public getAssetPath(category: string, filename: string): string {
        // WHAT CHANGED: Switched to template literal with BASE_URL.
        // WHY IT CHANGED: To support relative-path deployments. Without 
        // this, asset links break when the site is hosted at 
        // username.github.io/repo-name/.
        const base = import.meta.env.BASE_URL || '/';
        return `${base}assets/images/Character Asset Pack/${category}/${filename}`;
    }

    /**
     * Resolves the skin asset path.
     */
    public getSkinPath(gender: CharacterGender, color: number): string {
        return this.getAssetPath('Character skin colors', `${gender} Skin${color}.png`);
    }

    /**
     * Resolves the hair asset path.
     */
    public getHairPath(gender: CharacterGender, style: string): string {
        // Filenames are like "Male Hair1.png"
        return this.getAssetPath(`${gender} Hair`, `${gender} ${style}.png`);
    }

    /**
     * Resolves the clothing asset path.
     */
    public getClothingPath(gender: CharacterGender, style: string): string {
        // style could be "Shirt", "Blue Shirt v2", etc.
        return this.getAssetPath(`${gender} Clothing`, `${style}.png`);
    }

    /**
     * Resolves the hand asset path (usually matches skin).
     */
    public getHandPath(gender: CharacterGender, _color: number): string {
        // WHAT CHANGED: Temporarily hardcoded to generic 'Sword.png'.
        // WHY IT CHANGED: The current asset pack lacks skin-tone-specific 
        // hand files. To avoid 404s in the Character Creator preview, 
        // we're overlaying a static item (sword) that covers the empty hand slot.
        return this.getAssetPath(`${gender} Hand`, `${gender} Sword.png`);
    }

    /**
     * Loads a texture for PixiJS.
     */
    public async getTexture(path: string): Promise<PIXI.Texture> {
        if (this.textureCache.has(path)) {
            return this.textureCache.get(path)!;
        }

        try {
            // PIXI.Assets.load is preferred in v7+
            const texture = await PIXI.Assets.load(path);
            this.textureCache.set(path, texture);
            return texture;
        } catch (error) {
            console.error(`Failed to load texture: ${path}`, error);
            // Fallback to empty texture if load fails
            return PIXI.Texture.EMPTY;
        }
    }

    /**
     * Loads an image for Canvas rendering.
     */
    public getImage(path: string): Promise<HTMLImageElement> {
        if (this.imageCache.has(path)) {
            return Promise.resolve(this.imageCache.get(path)!);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(path, img);
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`Failed to load image: ${path}`, err);
                reject(err);
            };
            img.src = path;
        });
    }

    /**
     * Helper to get all layers for a character configuration.
     */
    public getLayerPaths(config: CharacterVisualConfig): string[] {
        return [
            this.getSkinPath(config.gender, config.skinColor),
            this.getHandPath(config.gender, config.skinColor), // Hands are often separate layers
            this.getClothingPath(config.gender, config.clothing),
            this.getHairPath(config.gender, config.hairStyle),
        ];
    }
}

export const characterAssetService = CharacterAssetService.getInstance();
