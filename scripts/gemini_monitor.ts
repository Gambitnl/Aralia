#!/usr/bin/env tsx

/**
 * Tombstone for the old gemini_monitor.ts location.
 *
 * This keeps old flow calls fail-fast with a migration message.
 */

import { runMovedScriptTombstone } from "./moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/gemini_monitor.ts",
  newPath: "scripts/workflows/chat-debug/gemini-monitor.ts",
  reason: "Chat debug scripts were grouped into a workflow folder for maintainability.",
  followUp: "Update your script runner/flow to call the new path."
});

