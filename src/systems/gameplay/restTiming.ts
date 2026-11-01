/**
 * Shares the existing short-rest clock rules between the spend dialog and commit.
 * This preview never advances time or spends resources. A rest counts against its
 * finish day, while the two-hour spacing is measured from the previous finish.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 23:41:27
 * Dependents: components/ui/RestModal.tsx, hooks/actions/handleResourceActions.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ShortRestTracker } from '../../types';
import { formatDuration, getGameDay } from '../../utils/core/timeUtils';

export const SHORT_REST_DURATION_SECONDS = 3600;
export const SHORT_REST_COOLDOWN_SECONDS = 2 * 3600;
export const SHORT_REST_MAX_PER_DAY = 3;

export function getShortRestTiming(gameTime: Date, tracker?: ShortRestTracker) {
  const restStartMs = gameTime.getTime();
  const restEndMs = restStartMs + SHORT_REST_DURATION_SECONDS * 1000;
  const restEndDay = getGameDay(new Date(restEndMs));
  const restsTakenToday = tracker?.lastRestDay === restEndDay ? tracker.restsTakenToday : 0;
  let blockReason: string | null = null;
  if (restsTakenToday >= SHORT_REST_MAX_PER_DAY) {
    blockReason = `The party has already taken ${SHORT_REST_MAX_PER_DAY} short rests today.`;
  } else if (tracker && tracker.lastRestEndedAtMs !== null) {
    // Game dates precede the Unix epoch. Negative timestamps (and zero) remain
    // valid previous completions; truthiness must not grant a second rest.
    const elapsedSeconds = Math.floor((restStartMs - tracker.lastRestEndedAtMs) / 1000);
    if (elapsedSeconds < SHORT_REST_COOLDOWN_SECONDS) {
      blockReason = `The party needs ${formatDuration(SHORT_REST_COOLDOWN_SECONDS - elapsedSeconds)} before taking another short rest.`;
    }
  }
  return { restEndMs, restEndDay, restsTakenToday, blockReason };
}
