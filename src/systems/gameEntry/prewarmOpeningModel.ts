/**
 * @file src/systems/gameEntry/prewarmOpeningModel.ts
 *
 * Start to load the opening-scene model while the player creates a character
 * (Remy, 2026-11-04). On this PC the models live on a slow disk, so the first
 * call spent about 80 s on the load alone, and the opening scene then failed
 * its 90 s request limit. A load that starts here is usually done when the
 * player finishes the character.
 *
 * - It writes no prose: `prepareForTask` sends Ollama an empty prompt.
 * - It does nothing when Groq is the text provider (`not-required`).
 * - A failure here is not shown to the player. `generateOpeningSituation`
 *   waits for the same shared load and reports a real failure there.
 */

import { getDefaultClient } from '../../services/ollama/client';

/** The page starts at most one preload; a remount of the creator reuses it. */
let started = false;

export function prewarmOpeningModel(): void {
    if (started) return;
    started = true;
    void getDefaultClient()
        .prepareForTask('opening_situation')
        .catch(() => {
            // prepareForTask returns its errors as a status. This catch only
            // keeps an unexpected throw (for example, no fetch) off the console.
        });
}

/** Test hook: let the next call start a new preload. */
export function resetOpeningModelPrewarmForTests(): void {
    started = false;
}
