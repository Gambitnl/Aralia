#!/usr/bin/env tsx

/**
 * Tombstone for the old deep_inspect.ts location.
 *
 * We keep this wrapper so stale calls provide an actionable migration message.
 */

import { runMovedScriptTombstone } from "./moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/deep_inspect.ts",
  newPath: "scripts/workflows/chat-debug/deep-inspect.ts",
  reason: "Chat debug scripts were grouped into a workflow folder for maintainability.",
  followUp: "Update your script runner/flow to call the new path."
});

