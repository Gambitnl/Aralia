#!/usr/bin/env tsx

/**
 * Tombstone for the old interact_chat.ts location.
 *
 * The real script now lives under scripts/workflows/chat-debug.
 */

import { runMovedScriptTombstone } from "./moved-script-tombstone";

runMovedScriptTombstone({
  oldPath: "scripts/interact_chat.ts",
  newPath: "scripts/workflows/chat-debug/interact-chat.ts",
  reason: "Chat debug scripts were grouped into a workflow folder for maintainability.",
  followUp: "Update your script runner/flow to call the new path."
});

