/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/openingScenePrompt.ts
 *
 * Builds the image-generation prompt for the OPENING-SCENARIO VISUAL — a wide,
 * cinematic illustration of the freshly generated opening predicament. The
 * prompt is grounded in the same OpeningSituation the text/conversation uses, so
 * the picture and the words describe one scene.
 *
 * This is a pure function (no I/O) so it can be unit-tested and reused by both
 * the client SceneService and any tooling. The actual generation is done by the
 * local browser-image `/api/scenes/generate` endpoint (see sceneApiManager).
 *
 * NO FALLBACK: there is no templated/canned scene art. If generation fails the
 * UI shows an honest "illustration unavailable" state — it never substitutes a
 * stock image (mirrors the opening-situation D-NOFB promise).
 */

import type { OpeningSituation } from './types';

/**
 * Compose a scene-illustration prompt from a generated opening situation.
 *
 * Framed as a WIDE environmental shot (not a character portrait) so it reads as
 * the establishing image of the predicament. NPC *roles* (not names) are woven
 * in as figures in the scene; their names are meaningless to an image model.
 */
export function buildOpeningScenePrompt(situation: OpeningSituation): string {
  const { setting, predicament, npcs } = situation;

  const place = setting.place?.trim();
  const timeOfDay = setting.timeOfDay?.trim();
  const weather = setting.weather?.trim();

  // 1–3 figures, described by role so the model has something concrete to place.
  const figures = (npcs ?? [])
    .map((n) => n.role?.trim())
    .filter((role): role is string => !!role)
    .slice(0, 3);

  const settingLine = [place, timeOfDay, weather]
    .filter(Boolean)
    .join(' — ');

  return [
    'Wide cinematic fantasy scene illustration, painterly and atmospheric, environmental storytelling.',
    settingLine ? `Setting: ${settingLine}.` : '',
    predicament?.trim() ? `Happening now: ${predicament.trim()}` : '',
    figures.length ? `Figures present in the scene: ${figures.join(', ')}.` : '',
    'Establishing shot, dramatic lighting, sense of a moment already in motion.',
    'No text, no UI, no watermark, no character portrait, no close-up face.',
  ]
    .filter(Boolean)
    .join(' ');
}
