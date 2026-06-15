// @dependencies-start
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
// @dependencies-end

/**
 * @file imageGenBackend.ts
 *
 * This file implements the real-world image generation backend for the Worldforge asset pipeline.
 *
 * It connects to Google's Imagen model via direct HTTP REST requests to generate textures,
 * faces, and heraldry dynamically at runtime. It translates our semantic, slash-separated asset keys
 * (like "texture/wall/plaster/weathered") into rich, descriptive prompts that the AI model understands.
 * By using standard REST requests, it allows a custom fetch function to be injected, making it easy
 * to mock network traffic in tests and CI environments without making live calls.
 *
 * Called by: createForgeAssetService in forgeAssetService.ts (when there is a cache miss and generator is online).
 * Depends on: env.ts for the API key, assetKey.ts to parse keys, and types.ts for interface definitions.
 */

import { ENV } from '../../../config/env';
import { parseAssetKey, assetAddress } from './assetKey';
import type { AssetGenerator, ForgeAsset } from './types';

// ============================================================================
// Types & Configuration Options
// ============================================================================
// Defines the parameter options used to construct the image generation backend.
// Allows injecting a custom fetch function for testing, overriding the API key,
// and selecting a different model version.
// ============================================================================

export interface ImageGenBackendOptions {
  /** Optional custom fetch implementation to override the default global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Gemini API key for image generation. Defaults to ENV.IMAGE_API_KEY. */
  apiKey?: string;
  /** The model to use. Defaults to "imagen-3.0-generate-002". */
  model?: string;
}

// ============================================================================
// Asset Generator Implementation
// ============================================================================
// Creates a concrete asset generator that resolves semantic keys into images.
// If the request succeeds, it returns a ForgeAsset containing the base64-encoded
// image data URI. If the service produces nothing, it returns null.
// ============================================================================

export function createImageGenBackend(
  options: ImageGenBackendOptions = {},
): AssetGenerator {
  // Use the injected fetch function or fall back to the browser's/Node's global fetch.
  const fetchFn = options.fetch ?? globalThis.fetch;
  // Use the configured image API key or fall back to the environment configuration.
  const apiKey = options.apiKey ?? ENV.IMAGE_API_KEY;
  // Default to the stable Imagen 3 generation model if not specified.
  const model = options.model ?? 'imagen-3.0-generate-002';

  return {
    async generate(key: string): Promise<ForgeAsset | null> {
      // Parse the semantic key into its components (kind, subject, descriptors).
      // This will throw if the key doesn't have at least kind and subject.
      const { kind, subject, descriptors } = parseAssetKey(key);
      const address = assetAddress(key);

      // Construct a descriptive prompt for the AI model depending on the asset category.
      let promptText = '';
      if (kind === 'texture') {
        promptText = `A seamless high-quality PBR texture of ${subject}`;
      } else if (kind === 'face') {
        promptText = `A professional fantasy character portrait face of a ${subject}`;
      } else if (kind === 'heraldry') {
        promptText = `A clean high-quality heraldry design featuring ${subject}`;
      } else {
        promptText = `A high-quality fantasy RPG illustration of ${subject}`;
      }

      // Weave descriptors (e.g. weathered, template, mossy) into the prompt text to add style and atmosphere.
      if (descriptors.length > 0) {
        promptText += `, with style details: ${descriptors.join(', ')}`;
      }

      // Add strict guidelines to prevent bad outputs, text overlays, or user interface elements.
      promptText += '. Style: fantasy RPG illustration, digital art, high quality, neutral background, no text, no UI, no watermark.';

      // The API key is required to authenticate with the Google Gemini services.
      if (!apiKey) {
        throw new Error('No API key available for image generation backend.');
      }

      // Construct the REST API endpoint URL for prediction.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

      // Call the service using the injected/global fetch transport.
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: promptText,
            },
          ],
          parameters: {
            // We only need one image per cache slot.
            sampleCount: 1,
          },
        }),
      });

      // Handle transport/service errors by throwing. The caller handles this honestly (no fallbacks).
      if (!response.ok) {
        throw new Error(
          `Image generation backend request failed with status ${response.status} (${response.statusText}).`,
        );
      }

      // Parse the JSON response.
      const data = await response.json();

      // If the model produced nothing or was blocked, return null honestly per contract.
      if (
        !data ||
        !data.predictions ||
        !data.predictions[0] ||
        !data.predictions[0].bytesBase64Encoded
      ) {
        return null;
      }

      // Retrieve the base64 encoded image bytes.
      const base64Bytes = data.predictions[0].bytesBase64Encoded;
      // Convert the raw bytes into a usable data URI that browser image elements can consume directly.
      const imageUri = `data:image/png;base64,${base64Bytes}`;

      // Return the resolved asset with "generated" provenance.
      return {
        key,
        address,
        source: 'generated',
        imageUri,
      };
    },
  };
}
