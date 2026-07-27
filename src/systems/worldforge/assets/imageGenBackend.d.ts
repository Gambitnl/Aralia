/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/06/2026, 01:37:36
 * Dependents: systems/worldforge/assets/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { AssetGenerator } from './types';
export interface ImageGenBackendOptions {
    /** Optional custom fetch implementation to override the default global fetch. */
    fetch?: typeof globalThis.fetch;
    /** Gemini API key for image generation. Defaults to ENV.IMAGE_API_KEY. */
    apiKey?: string;
    /** The model to use. Defaults to "imagen-3.0-generate-002". */
    model?: string;
}
export declare function createImageGenBackend(options?: ImageGenBackendOptions): AssetGenerator;
