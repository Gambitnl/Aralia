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

export async function generateSceneUrl(request: SceneGenerateRequest): Promise<string> {
  const response = await fetch('/api/scenes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  let payload: { url?: unknown; error?: unknown } | null = null;
  try {
    payload = await response.json();
  } catch {
    // handled below
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('AI scene illustration is a local-only feature and is not available on the live web version. Run the game locally to use it.');
    }
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : `Scene generation failed (${response.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Scene generation returned no URL.');
  }

  return payload.url.trim();
}
