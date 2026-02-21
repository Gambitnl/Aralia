#!/usr/bin/env tsx

/**
 * Tombstone for the old click-gemini-start-research-locator.ts location.
 *
 * This wrapper prevents silent path drift in scripts that still call the old path.
 */

import { runMovedScriptTombstone } from "../moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/audits/click-gemini-start-research-locator.ts",
  newPath: "scripts/workflows/gemini/research/debug/click-gemini-start-research-locator.ts",
  reason: "Gemini research debug scripts were moved to scripts/workflows/gemini/research/debug.",
  followUp: "Update your script runner/flow to call the new path."
});

