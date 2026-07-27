/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 07/05/2026, 00:03:45
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file PortraitService.ts
 * Service for handling AI character portrait generation.
 *
 * NOTE:
 * The recommended path is to call the local dev API (`/api/portraits/generate`), which
 * uses the local browser-based image generator and returns a URL to a locally served image.
 */
export interface PortraitGenerateRequest {
    description: string;
    race: string;
    className: string;
}
export declare function generatePortraitUrl(request: PortraitGenerateRequest): Promise<string>;
