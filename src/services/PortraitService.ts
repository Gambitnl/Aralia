// @dependencies-start
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
// @dependencies-end

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

export async function generatePortraitUrl(request: PortraitGenerateRequest): Promise<string> {
  const response = await fetch('/api/portraits/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // ignore - handled below
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('AI Portrait generation is a local-only feature and is not available on the live web version. Please run the game locally to use this functionality.');
    }
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : `Portrait generation failed (${response.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Portrait generation returned no URL.');
  }

  return payload.url.trim();
}

