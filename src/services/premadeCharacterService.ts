/**
 * This file manages "premade characters" — pre-built D&D characters stored as
 * JSON files in the repo's `public/premade-characters/` folder.
 *
 * Why it exists:
 * The Party Editor dev tool creates characters from basic templates (class + level),
 * which produces generic "Fighter 1" / "Monk 1" characters with flat stats and no
 * personality. Premade characters let developers (and eventually players) pick from
 * fully realized characters with custom names, races, ability scores, skills, feats,
 * and visual descriptions — all of which persist across server restarts because they
 * live as plain JSON files in the repo.
 *
 * How it works:
 * - LOADING: Reads a `manifest.json` from `/premade-characters/` that lists all
 *   available character files. Each file is a full PlayerCharacter serialized as JSON.
 * - SAVING (dev mode only): Exports a PlayerCharacter as a downloadable JSON file.
 *   The developer then drops it into `public/premade-characters/` and updates the manifest.
 *   A Vite plugin could automate this in the future, but download-and-place is simple and safe.
 *
 * Called by: PartyEditorModal.tsx (the "Load Premade" and "Save as Premade" buttons)
 * Depends on: PlayerCharacter type from types/character.ts
 */

import type { PlayerCharacter } from '../types';
import { FEATURES } from '../config/features';

// ============================================================================
// Types
// ============================================================================
// Describes a summary entry in the premade characters manifest file.
// This is the shape of each object in `manifest.json` — lightweight metadata
// so the UI can show a picker without loading every full character JSON.
// ============================================================================

export interface PremadeCharacterSummary {
    /** Filename of the character JSON (e.g., "thalren_deeproot.json") */
    filename: string;
    /** Display name shown in the picker */
    name: string;
    /** Race name for display (e.g., "Earth Genasi") */
    race: string;
    /** Class name for display (e.g., "Monk") */
    className: string;
    /** Character level */
    level: number;
    /** Short flavor description for the picker card */
    description: string;
}

export interface PremadeManifest {
    /** List of all available premade characters */
    characters: PremadeCharacterSummary[];
}

// ============================================================================
// Base URL Configuration
// ============================================================================
// Vite serves files from `public/` at the app's base path. We use import.meta
// to resolve the correct base URL so the paths work in both dev and production.
// ============================================================================

const BASE_URL = import.meta.env.BASE_URL || '/';
const PREMADE_DIR = `${BASE_URL}premade-characters`;

// ============================================================================
// Manifest Loading
// ============================================================================
// Fetches the manifest.json that lists all available premade characters.
// Returns an empty list if the manifest doesn't exist or can't be parsed,
// so the feature degrades gracefully if no premade characters are configured.
// ============================================================================

let cachedManifest: PremadeManifest | null = null;

export async function loadPremadeManifest(): Promise<PremadeManifest> {
    // Return cached manifest if we already loaded it this session
    if (cachedManifest) return cachedManifest;

    try {
        const response = await fetch(`${PREMADE_DIR}/manifest.json`);
        if (!response.ok) {
            console.warn('[PremadeCharacters] No manifest.json found — premade characters disabled.');
            return { characters: [] };
        }
        const manifest: PremadeManifest = await response.json();
        cachedManifest = manifest;
        return manifest;
    } catch (error) {
        console.warn('[PremadeCharacters] Failed to load manifest:', error);
        return { characters: [] };
    }
}

// ============================================================================
// Character Loading
// ============================================================================
// Fetches a single premade character JSON by filename.
// Returns a full PlayerCharacter object ready to drop into the game's party.
// ============================================================================

export async function loadPremadeCharacter(filename: string): Promise<PlayerCharacter | null> {
    try {
        const response = await fetch(`${PREMADE_DIR}/${filename}`);
        if (!response.ok) {
            console.error(`[PremadeCharacters] Failed to load character file: ${filename}`);
            return null;
        }
        const character: PlayerCharacter = await response.json();
        return character;
    } catch (error) {
        console.error(`[PremadeCharacters] Error parsing character file ${filename}:`, error);
        return null;
    }
}

// ============================================================================
// Character Saving (Dev Mode Only)
// ============================================================================
// Exports a PlayerCharacter as a downloadable .json file so the developer can
// drop it into `public/premade-characters/` and add it to the manifest.
//
// This is gated behind the ENABLE_DEV_TOOLS feature flag. In production builds,
// this function does nothing. This keeps the save mechanism out of player hands
// while giving developers a convenient way to capture characters they've built
// through the character creator.
// ============================================================================

export function savePremadeCharacter(character: PlayerCharacter): void {
    // Guard: only allow saving in dev mode
    if (!FEATURES.ENABLE_DEV_TOOLS) {
        console.warn('[PremadeCharacters] Saving premade characters is only available in dev mode.');
        return;
    }

    // Build a clean filename from the character's name
    const safeName = character.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')   // Replace non-alphanumeric with underscores
        .replace(/^_|_$/g, '');          // Trim leading/trailing underscores

    const filename = `${safeName || 'unnamed_character'}.json`;

    // Serialize the character to pretty-printed JSON for human readability
    const jsonContent = JSON.stringify(character, null, 2);

    // Create a download link and trigger the browser's save dialog.
    // This is the simplest cross-browser way to "save to disk" from a web app.
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Clean up the temporary elements
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`[PremadeCharacters] Character "${character.name}" exported as ${filename}`);
    console.log(`[PremadeCharacters] To make it available in-game, place it in public/premade-characters/ and add an entry to manifest.json`);
}

// ============================================================================
// Manifest Cache Management
// ============================================================================
// Allows refreshing the manifest cache if new characters are added at runtime.
// Mostly useful during development when you're iterating on character files.
// ============================================================================

export function clearManifestCache(): void {
    cachedManifest = null;
}

// ============================================================================
// Dev Mode Check Helper
// ============================================================================
// Re-exports the dev tools flag so UI components can check it without importing
// the config module directly. Keeps the premade character feature self-contained.
// ============================================================================

export function canSavePremadeCharacters(): boolean {
    return FEATURES.ENABLE_DEV_TOOLS;
}
