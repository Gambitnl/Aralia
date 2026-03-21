// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/03/2026, 20:48:26
 * Dependents: CharacterCreator.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/CharacterCreator/VisualsSelection.tsx
 * ARCHITECTURAL CONTEXT:
 * This component is the 'Appearance Customization' layer. It manages 
 * the visual identity of the character, handling gender, skin tone, 
 * hair style, and clothing.

 * Recent updates focus on 'Race-Driven Sprites' and 'Modular Previews'.
 * - Introduced `RaceSpritePreview`. The engine now tries to load a 
 *   high-quality, race-specific character sprite (mapped via 
 *   `RaceSpriteConfig`) instead of just a generic humanoid base.
 * - Implemented `SpriteFallbackPreview`. If a specific race sprite 
 *   is missing or fails to load, the system automatically falls back 
 *   to the legacy `Canvas` compositing system (Skin + Hair + Clothing 
 *   layers), ensuring the UI never shows a broken image.
 * - Centralized asset logic into `CharacterAssetService` and 
 *   `RaceSpriteConfig`, decoupling the UI controls from the raw 
 *   file paths and allowing for easier addition of new races.
 * - Added `handleRandomize` to quickly generate a complete visual 
 *   identity, improving the "fast-start" user experience.

 *
 * RACE-DRIVEN SPRITE PREVIEW SYSTEM:
 * The preview dynamically changes based on the selected race. Every race
 * is mapped to a "visual family" via RaceSpriteConfig. Each family has
 * generated pixel art sprites that accurately represent the race.
 *
 * TWO SPRITE MODES:
 *   1. COMPOSITE — Non-humanoid races (dragonborn, goblin, dwarf, etc.)
 *      get a single complete character sprite. Skin, hair, clothing
 *      controls still set state but the visual shows the race sprite.
 *
 *   2. LAYERED — Humanoid-proportioned races (elf, tiefling, human, etc.)
 *      use the race sprite as a body base with existing clothing/hair
 *      layers composited on top via Canvas.
 *
 * FALLBACK: If no race sprite exists yet, falls back to the original
 * humanoid sprite sheet system (generic skin + clothing + hair layers).
 *
 * Depends on:
 *   - CharacterAssetService (sprite path resolution for layered/fallback)
 *   - RaceSpriteConfig (race → visual family mapping)
 *   - Race type (from character state)
 *   - CreationStepLayout (step wrapper)
 *   - lucide-react icons (ChevronLeft, ChevronRight, Shuffle)
 * Called by: CharacterCreator.tsx (step 4 of the wizard)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CharacterVisualConfig, CharacterGender, characterAssetService } from '../../services/CharacterAssetService';
import { getVisualFamily, resolveRaceSpritePath } from '../../services/RaceSpriteConfig';
import { Race } from '../../types';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { Button } from '../ui/Button';

// ============================================================================
// Props
// ============================================================================

interface VisualsSelectionProps {
    visuals: CharacterVisualConfig;
    onVisualsChange: (visuals: Partial<CharacterVisualConfig>) => void;
    /** The race selected in Step 1. Drives which sprite family to display. */
    selectedRace: Race | null;
    onNext: () => void;
    onBack: () => void;
}

// ============================================================================
// Option Data
// ============================================================================

const SKIN_COLORS = [1, 2, 3, 4, 5];
const HAIR_STYLES = ['Hair1', 'Hair2', 'Hair3', 'Hair4', 'Hair5'];

const MALE_CLOTHING = [
    'Shirt', 'Blue Shirt v2', 'Green Shirt v2', 'Purple Shirt v2', 'orange Shirt v2'
];
const FEMALE_CLOTHING = [
    'Corset', 'Blue Corset', 'Green Corset', 'Orange Corset', 'Purple Corset'
];

// ============================================================================
// Sprite Fallback Config (used for layered mode & missing race sprites)
// ============================================================================
// The sprite sheets are 800×448 with irregularly spaced frames.
// We extract a 48×52 region covering the first front-facing idle sprite.
const EXTRACT_X = 24;
const EXTRACT_Y = 16;
const EXTRACT_W = 48;
const EXTRACT_H = 52;
const CANVAS_SCALE = 4;
const CANVAS_W = EXTRACT_W * CANVAS_SCALE;
const CANVAS_H = EXTRACT_H * CANVAS_SCALE;

// ============================================================================
// Skin Tone Swatches — visual indicators for the skin tone selector
// ============================================================================

const SKIN_HEX: Record<number, string> = {
    1: '#F9E4D4',
    2: '#E8B490',
    3: '#C68B63',
    4: '#865E42',
    5: '#4F3423',
};

// ============================================================================
// Race Sprite Preview Component
// ============================================================================
// Loads and displays the generated race-specific pixel art sprite.
// These are single-frame character images, not sprite sheets.
// The image is displayed at its natural resolution with pixelated rendering
// to preserve the pixel art aesthetic.
// ============================================================================

const RaceSpritePreview: React.FC<{
    spritePath: string;
    raceName: string;
    onFallback: () => void;
}> = ({ spritePath, raceName, onFallback }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    // Reset state when the sprite path changes (e.g. gender or race change)
    useEffect(() => {
        setLoaded(false);
        setError(false);
    }, [spritePath]);

    // If the race sprite fails to load, trigger fallback to the old system
    useEffect(() => {
        if (error) onFallback();
    }, [error, onFallback]);

    const fullPath = resolveRaceSpritePath(spritePath);

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Loading shimmer while image loads */}
            {!loaded && !error && (
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-gray-800 animate-pulse rounded-2xl" />
            )}
            <img
                src={fullPath}
                alt={`${raceName} character sprite`}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};

// ============================================================================
// Canvas Sprite Fallback Preview
// ============================================================================
// Uses the old sprite sheet system to extract a single frame. This is the
// default when no race-specific sprite exists. Composites skin + clothing +
// hair layers from the generic humanoid sprite sheets.
// ============================================================================

const SpriteFallbackPreview: React.FC<{ visuals: CharacterVisualConfig }> = ({ visuals }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasError, setHasError] = useState(false);

    // Build the layer paths from the generic humanoid sprite sheets
    const layerPaths = [
        characterAssetService.getSkinPath(visuals.gender, visuals.skinColor),
        characterAssetService.getClothingPath(visuals.gender, visuals.clothing),
        characterAssetService.getHairPath(visuals.gender, visuals.hairStyle),
    ];

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        let cancelled = false;

        const loadImage = (src: string): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed: ${src}`));
                img.src = src;
            });

        Promise.all(layerPaths.map(loadImage))
            .then((images) => {
                if (cancelled) return;
                setHasError(false);
                ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
                // Composite each layer by extracting the idle frame region
                for (const img of images) {
                    ctx.drawImage(img, EXTRACT_X, EXTRACT_Y, EXTRACT_W, EXTRACT_H, 0, 0, CANVAS_W, CANVAS_H);
                }
            })
            .catch(() => { if (!cancelled) setHasError(true); });

        return () => { cancelled = true; };
    }, [layerPaths.join('|')]);

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="block"
                style={{ imageRendering: 'pixelated' }}
            />
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center select-none">
                    <div className="text-amber-500/30 font-cinzel text-center">
                        <div className="text-3xl mb-2">Preview</div>
                        <div className="text-xs uppercase tracking-[0.2em]">Assets Missing</div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const VisualsSelection: React.FC<VisualsSelectionProps> = ({
    visuals,
    onVisualsChange,
    selectedRace,
    onNext,
    onBack,
}) => {
    const clothingOptions = visuals.gender === 'Male' ? MALE_CLOTHING : FEMALE_CLOTHING;

    // Look up the visual family for the selected race.
    // This tells us which sprite to load and whether to use layered or composite mode.
    const family = getVisualFamily(selectedRace?.id);
    const raceSpritePath = family.sprites[visuals.gender];

    // Track whether the race sprite loaded successfully.
    // If it fails (sprite doesn't exist yet), we fall back to the old system.
    const [useRaceSprite, setUseRaceSprite] = useState(true);
    const handleSpriteFallback = useCallback(() => setUseRaceSprite(false), []);

    // Reset the race sprite flag when the race or gender changes, so we try
    // loading the race sprite again for the new combination.
    useEffect(() => {
        setUseRaceSprite(true);
    }, [selectedRace?.id, visuals.gender]);

    // ========================================================================
    // Gender Change — resets defaults because sprite sets differ per gender
    // ========================================================================

    const handleGenderChange = (gender: CharacterGender) => {
        onVisualsChange({
            gender,
            hairStyle: 'Hair1',
            clothing: gender === 'Male' ? 'Shirt' : 'Corset',
        });
    };

    // ========================================================================
    // Cycling Selector — wraps around for continuous scrolling
    // ========================================================================

    const cyclingUpdate = <K extends keyof CharacterVisualConfig>(
        list: CharacterVisualConfig[K][],
        current: CharacterVisualConfig[K],
        key: K,
        delta: number
    ) => {
        const index = list.indexOf(current);
        const nextIndex = (index + delta + list.length) % list.length;
        onVisualsChange({ [key]: list[nextIndex] } as Partial<CharacterVisualConfig>);
    };

    // ========================================================================
    // Randomize — random gender, skin, hair, outfit in one click
    // ========================================================================

    const handleRandomize = useCallback(() => {
        const randomGender: CharacterGender = Math.random() < 0.5 ? 'Male' : 'Female';
        const randomSkin = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
        const randomHair = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)];
        const genderClothing = randomGender === 'Male' ? MALE_CLOTHING : FEMALE_CLOTHING;
        const randomClothing = genderClothing[Math.floor(Math.random() * genderClothing.length)];

        onVisualsChange({
            gender: randomGender,
            skinColor: randomSkin,
            hairStyle: randomHair,
            clothing: randomClothing,
        });
    }, [onVisualsChange]);

    // ========================================================================
    // Determine which preview to show
    // ========================================================================
    // Priority: race-specific sprite → layered sprite fallback → canvas fallback
    const showRaceSprite = useRaceSprite && raceSpritePath;

    // ========================================================================
    // Header Actions
    // ========================================================================

    const headerActions = (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleRandomize}
            className="text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 gap-1.5"
        >
            <Shuffle size={14} />
            Randomize
        </Button>
    );

    return (
        <CreationStepLayout
            title="Customize Appearance"
            onBack={onBack}
            onNext={onNext}
            headerActions={headerActions}
        >
            <div className="flex flex-col items-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-4">

                    {/* ============================================================ */}
                    {/* Controls Panel (left side)                                   */}
                    {/* ============================================================ */}
                    <div className="space-y-5 bg-black/40 p-5 rounded-2xl border border-gray-700 shadow-xl">

                        {/* ---- Gender Selection ---- */}
                        <div className="space-y-3">
                            <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Gender</p>
                            <div className="flex gap-4">
                                {(['Male', 'Female'] as CharacterGender[]).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => handleGenderChange(g)}
                                        className={`flex-1 py-3 px-6 rounded-xl border-2 transition-all font-bold ${visuals.gender === g
                                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                            : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ---- Skin Tone Selection ---- */}
                        <div className="space-y-3">
                            <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Skin Tone</p>
                            <div className="flex justify-between items-center gap-4">
                                <button onClick={() => cyclingUpdate(SKIN_COLORS, visuals.skinColor, 'skinColor', -1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-amber-500">
                                    <ChevronLeft />
                                </button>
                                <div className="flex gap-2 justify-center flex-1">
                                    {SKIN_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => onVisualsChange({ skinColor: c })}
                                            className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${visuals.skinColor === c ? 'border-amber-400 ring-2 ring-amber-500/50' : 'border-black'
                                                }`}
                                            style={{ backgroundColor: SKIN_HEX[c] || '#F9E4D4' }}
                                            aria-label={`Select skin tone ${c}`}
                                        />
                                    ))}
                                </div>
                                <button onClick={() => cyclingUpdate(SKIN_COLORS, visuals.skinColor, 'skinColor', 1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-amber-500">
                                    <ChevronRight />
                                </button>
                            </div>
                        </div>

                        {/* ---- Hair Style ---- */}
                        <div className="space-y-3">
                            <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Hair Style</p>
                            <div className="flex justify-between items-center bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3">
                                <button onClick={() => cyclingUpdate(HAIR_STYLES, visuals.hairStyle, 'hairStyle', -1)} className="p-1 hover:text-amber-500 transition-colors">
                                    <ChevronLeft />
                                </button>
                                <span className="font-bold text-gray-200 uppercase tracking-tighter">Style {visuals.hairStyle.replace('Hair', '')}</span>
                                <button onClick={() => cyclingUpdate(HAIR_STYLES, visuals.hairStyle, 'hairStyle', 1)} className="p-1 hover:text-amber-500 transition-colors">
                                    <ChevronRight />
                                </button>
                            </div>
                        </div>

                        {/* ---- Clothing / Outfit ---- */}
                        <div className="space-y-3">
                            <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Outfit</p>
                            <div className="flex justify-between items-center bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3">
                                <button onClick={() => cyclingUpdate(clothingOptions, visuals.clothing, 'clothing', -1)} className="p-1 hover:text-amber-500 transition-colors">
                                    <ChevronLeft />
                                </button>
                                <span className="font-bold text-gray-200 text-sm whitespace-nowrap overflow-hidden text-ellipsis px-2">
                                    {visuals.clothing}
                                </span>
                                <button onClick={() => cyclingUpdate(clothingOptions, visuals.clothing, 'clothing', 1)} className="p-1 hover:text-amber-500 transition-colors">
                                    <ChevronRight />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* Preview Panel (right side)                                   */}
                    {/* Shows the race-specific generated sprite when available.     */}
                    {/* Falls back to the layered humanoid sprite system when a      */}
                    {/* race's sprite hasn't been generated yet.                     */}
                    {/* ============================================================ */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative w-64 h-80 bg-gray-900 rounded-3xl border-4 border-amber-500/30 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-4">
                            {/* Subtle radial spotlight — draws attention to the sprite */}
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
                            {showRaceSprite ? (
                                <RaceSpritePreview
                                    spritePath={raceSpritePath}
                                    raceName={family.label}
                                    onFallback={handleSpriteFallback}
                                />
                            ) : (
                                <SpriteFallbackPreview visuals={visuals} />
                            )}
                        </div>

                        {/* Race label — shows the visual family name */}
                        <div className="text-center">
                            <span className="text-amber-400/80 font-cinzel text-sm tracking-widest uppercase">
                                {selectedRace?.name ?? 'Adventurer'}
                            </span>
                            {/* Show fallback indicator when using old sprite system */}
                            {!showRaceSprite && selectedRace && (
                                <div className="text-gray-600 text-[10px] mt-1 uppercase tracking-widest">
                                    Generic Preview
                                </div>
                            )}
                        </div>

                        {/* Flavor text */}
                        <div className="text-center italic text-gray-400 text-sm max-w-xs">
                            &quot;Your outward form reflects the spirit within. Choose wisely, traveler.&quot;
                        </div>
                    </div>
                </div>

            </div>
        </CreationStepLayout>
    );
};

export default VisualsSelection;
