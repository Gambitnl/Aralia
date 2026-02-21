#!/usr/bin/env tsx

/**
 * Tombstone for the old inspect_site.ts location.
 *
 * This file exists on purpose so outdated flows fail with a clear relocation message
 * instead of failing with "file not found".
 */

import { runMovedScriptTombstone } from "./moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/inspect_site.ts",
  newPath: "scripts/workflows/chat-debug/inspect-site.ts",
  reason: "Chat debug scripts were grouped into a workflow folder for maintainability.",
  followUp: "Update your script runner/flow to call the new path."
});

