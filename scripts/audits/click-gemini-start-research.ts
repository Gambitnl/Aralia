#!/usr/bin/env tsx

/**
 * Tombstone for the old click-gemini-start-research.ts location.
 *
 * This old path is retained only to make stale references fail loudly with guidance.
 */

import { runMovedScriptTombstone } from "../moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/audits/click-gemini-start-research.ts",
  newPath: "scripts/workflows/gemini/research/debug/click-gemini-start-research.ts",
  reason: "Gemini research debug scripts were moved to scripts/workflows/gemini/research/debug.",
  followUp: "Update your script runner/flow to call the new path."
});

