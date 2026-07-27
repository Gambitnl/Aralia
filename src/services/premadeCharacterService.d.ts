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
    /** Whether this is a test/simulator-only fixture (should not appear in standard UI) */
    isTestFixture?: boolean;
}
export interface PremadeManifest {
    /** List of all available premade characters */
    characters: PremadeCharacterSummary[];
}
export declare function loadPremadeManifest(includeTestFixtures?: boolean): Promise<PremadeManifest>;
export declare function loadPremadeCharacter(filename: string): Promise<PlayerCharacter | null>;
export declare function savePremadeCharacter(character: PlayerCharacter): void;
export declare function clearManifestCache(): void;
export declare function canSavePremadeCharacters(): boolean;
