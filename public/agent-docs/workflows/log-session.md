# Workflow: Log Session to Chronicle

**Trigger:** User requests to "wrap up" or the session has reached a logical conclusion.

## Steps

1.  **Read History**: Scan the current conversation to identify:
    *   Key files created or modified.
    *   Specific tools fixed or configured.
    *   Unexpected errors that required debugging.

2.  **Fetch Existing Log**:
    *   Read `misc/chronicle_data.json` with the current agent's available file-reading tools.

3.  **Construct Entry**:
    *   **ID**: Generate a simple unique ID (e.g., `Date.now()`).
    *   **Date**: Current timestamp in `YYYY-MM-DD HH:mm` format.
    *   **Agent**: The active agent/runtime name, such as `Codex Desktop` or `Gemini`, based on observable session context.
    *   **Categories**: Select 1-3 tags based on the work done.
    *   **Summary**: 1 sentence.
    *   **Actions**: 2-5 bullet points.
    *   **Challenges**: 1-2 sentences.
    *   **Next Steps**: 1-2 sentences on what remains to be done.

4.  **Write Update**:
    *   Parse the existing JSON.
    *   `unshift` (prepend) the new entry so it appears first.
    *   Use the current agent's standard edit tool to write the updated JSON array without corrupting formatting.

5.  **Confirm**:
    *   Notify the user: "Session logged to Development Chronicle."
