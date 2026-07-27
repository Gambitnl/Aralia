/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/06/2026, 02:18:23
 * Dependents: components/puzzles/LockpickingModal.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/arcaneGlyphSystem.ts
 * Implements mechanics for magical traps (Glyphs), using Arcana for detection and disarming.
 */
import { PlayerCharacter } from '../../types/character';
import { Trap, TrapDetectionResult, TrapDisarmResult } from './types';
/**
 * Attempts to detect a magical glyph or ward.
 * Uses Intelligence (Arcana) or Intelligence (Investigation) if specifically looking for faint runes.
 * Magical traps are often invisible until detected.
 */
export declare function detectGlyph(character: PlayerCharacter, glyph: Trap): TrapDetectionResult;
/**
 * Attempts to disarm (abjure/suppress) a magical glyph.
 * Requires Intelligence (Arcana). Thieves' Tools are useless here.
 */
export declare function disarmGlyph(character: PlayerCharacter, glyph: Trap): TrapDisarmResult;
/**
 * Attempts to identify the nature of the glyph without triggering it.
 * Returns a hint about the effect (e.g., "It radiates evocation magic" -> Fire/Explosion).
 */
export declare function identifyGlyphSchool(character: PlayerCharacter, glyph: Trap): string | null;
