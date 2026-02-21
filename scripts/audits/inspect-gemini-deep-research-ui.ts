#!/usr/bin/env tsx

/**
 * Tombstone for the old Gemini deep-research UI inspector location.
 *
 * The executable script moved into a workflow-specific debug folder.
 */

import { runMovedScriptTombstone } from "../moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/audits/inspect-gemini-deep-research-ui.ts",
  newPath: "scripts/workflows/gemini/research/debug/inspect-gemini-deep-research-ui.ts",
  reason: "Gemini research debug scripts were moved to scripts/workflows/gemini/research/debug.",
  followUp: "Update your script runner/flow to call the new path."
});

