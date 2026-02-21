#!/usr/bin/env tsx

/**
 * Tombstone for the old open-gemini-profile.ts location.
 *
 * This script was moved into the Gemini image-gen workflow folder.
 */

import { runMovedScriptTombstone } from "./moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/open-gemini-profile.ts",
  newPath: "scripts/workflows/gemini/image-gen/open-gemini-profile.ts",
  reason: "Gemini setup scripts were consolidated under scripts/workflows/gemini/image-gen.",
  followUp: "Update your script runner/flow to call the new path."
});

