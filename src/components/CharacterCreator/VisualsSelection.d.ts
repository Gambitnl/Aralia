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
import React from 'react';
import { CharacterVisualConfig } from '../../services/CharacterAssetService';
import { Race } from '../../types';
interface VisualsSelectionProps {
    visuals: CharacterVisualConfig;
    onVisualsChange: (visuals: Partial<CharacterVisualConfig>) => void;
    /** The race selected in Step 1. Drives which sprite family to display. */
    selectedRace: Race | null;
    onNext: () => void;
    onBack: () => void;
}
declare const VisualsSelection: React.FC<VisualsSelectionProps>;
export default VisualsSelection;
