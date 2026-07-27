/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/SceneService.ts
 * Client for the OPENING-SCENARIO VISUAL. Posts a scene-illustration prompt to
 * the local dev API (`/api/scenes/generate`, browser-image-backed) and returns a URL to
 * a locally served image.
 *
 * Mirrors PortraitService. NO FALLBACK: on any failure this throws and the
 * caller surfaces an honest "illustration unavailable" state — it never returns
 * a stock/placeholder image.
 */
export interface SceneGenerateRequest {
    /** The full image-generation prompt (see buildOpeningScenePrompt). */
    prompt: string;
}
export declare function generateSceneUrl(request: SceneGenerateRequest): Promise<string>;
