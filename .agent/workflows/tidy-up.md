---
description: Execute the full end-of-session tidy-up sequence to thoroughly verify, document, and log all session changes.
---

# /tidy-up Workflow

This workflow is a "meta-workflow" designed to be executed by an active AI agent at the end of a session. Because it is executed by the active agent (instead of a blind script), it retains full conversational context when extracting learnings and summarizing the session.

## Steps to Execute

1. **Verify Code Health**
   Run the `/test-ts` workflow to run type-checking (`npx tsc --noEmit`) and handle any newly introduced type errors according to the Preservationist Rules.

2. **Run the Session Ritual**
   Execute the `/session-ritual` workflow to perform the remaining cleanup tasks sequentially. 
   
   **Important Context Rules for the Ritual:**
   - **Step 1 (Sync Dependencies):** Run `git status --porcelain` to explicitly identify the files you modified, then run `npx tsx scripts/codebase-visualizer-server.ts --sync [file]` for each.
   - **Step 2 (Extract Terminal Learnings):** Do not rely on an external CLI command history. Look directly at our actual chat history to identify any tools we struggled with, environment oddities (like the PowerShell `{}` quoting issue), or problem-solving steps, and add them to the agent's environment learnings.
   - **Step 6 (Log Session):** Summarize the actual "why" and "how" of what we discussed during this session into the Development Chronicle, not just a list of changed files.

// TODO: Add a "Stale Branch/Asset Audit" step to identify and flag orphaned AI-generated scripts or unused icons that were abandoned during the session.
