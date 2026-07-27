/**
 * @file RaceSpriteConfig.ts
 * Maps races to their visual sprite families for the character creator preview.
 *
 * ARCHITECTURE:
 * The character preview in Step 4 (Appearance) composites multiple sprite layers
 * to build a full character image. This config tells the system WHICH sprite
 * assets to load for each race.
 *
 * VISUAL FAMILIES:
 * Races are grouped into "visual families" — races that share the same body
 * proportions and can use the same base sprite. For example, all elven sub-races
 * share the "elf" visual family because they have the same body shape (just
 * different skin tones / lore).
 *
 * SPRITE TYPES:
 * 1. LAYERED races — humanoid-proportioned races where the existing clothing
 *    and hair sprite layers align correctly on top of a race-specific skin sprite.
 *    These races only need a custom "body" sprite; hair + clothing are overlaid.
 *
 * 2. COMPOSITE races — non-humanoid races (dragonborn, goblin, aarakocra, etc.)
 *    where body proportions differ so much that standard clothing/hair layers
 *    don't align. These get a single complete character sprite per gender.
 *
 * HOW TO ADD A NEW RACE'S SPRITES:
 *   1. Generate the sprite image(s) and save to public/assets/images/race-sprites/
 *   2. Add the race's visual family entry below
 *   3. Map the race ID to the family in RACE_TO_FAMILY
 *
 * Depends on: nothing (pure data config)
 * Used by: VisualsSelection.tsx
 */
/**
 * How the sprite is rendered in the preview:
 *   layered   = race-specific skin + standard clothing + standard hair
 *   composite = single complete character image (no layering)
 */
export type SpriteMode = 'layered' | 'composite';
export interface RaceVisualFamily {
    /** Unique family ID (e.g. 'elf', 'dragonborn', 'goblin') */
    id: string;
    /** Display label for this family */
    label: string;
    /** Whether this family uses layered or composite sprites */
    mode: SpriteMode;
    /**
     * For LAYERED mode: paths to race-specific skin sprites.
     * These replace the default human skin layer. The clothing/hair layers
     * still overlay on top.
     * Key format: "Male" | "Female" → skin variant number → path
     *
     * For COMPOSITE mode: paths to complete character sprites.
     * Key format: "Male" | "Female" → path
     * Skin/hair/clothing options are cosmetic only (stored in state but not
     * visually reflected).
     */
    sprites: {
        Male: string;
        Female: string;
    };
    /**
     * Optional: available skin tone variants for layered mode.
     * If provided, the skin tone selector cycles through these instead
     * of the default human tones. Each entry maps a tone index to a path.
     */
    skinVariants?: {
        Male: Record<number, string>;
        Female: Record<number, string>;
    };
}
export declare const VISUAL_FAMILIES: Record<string, RaceVisualFamily>;
export declare const RACE_TO_FAMILY: Record<string, string>;
/**
 * Gets the visual family config for a given race ID.
 * Falls back to 'human' if the race isn't mapped (safest default).
 */
export declare function getVisualFamily(raceId: string | null | undefined): RaceVisualFamily;
/**
 * Resolves the full URL to a race sprite image.
 * Prepends the Vite base URL for correct asset serving.
 */
export declare function resolveRaceSpritePath(relativePath: string): string;
