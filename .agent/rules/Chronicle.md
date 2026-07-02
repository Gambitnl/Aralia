# Development Chronicle Guidelines

## Mandate
At the conclusion of a significant development session (adding features, fixing bugs, refactoring), the agent MUST log a summary of their actions to the **Development Chronicle**.

## Procedure
1.  **Analyze the Session**: Review the tools used, files modified, and challenges encountered.
2.  **Generate Entry**: Create a JSON object following the schema below and write it to a temp file (e.g. the scratchpad), or an array of objects for a multi-part session.
3.  **Add via the helper** (do NOT hand-edit the JSON): run
    `node scripts/chronicle/add.mjs <entry.json>` (or `... -` to read JSON from stdin).

> **Storage:** the chronicle lives in a SQLite DB (`misc/chronicle/chronicle.db`, the source
> of truth); the helper inserts your entry in a transaction and re-dumps
> `misc/chronicle_data.json` for the static viewer. Because inserts are transactional, parallel
> agents can't clobber each other — which the old "read the whole JSON, append, write it back"
> procedure did. `id` and `date` are auto-filled if you omit them; re-using an `id` edits that
> entry. Query the DB directly for reports, e.g. entries tagged X in the last two weeks:
> `SELECT e.* FROM entries e, json_each(e.categories) j WHERE j.value='Spell System' AND e.date >= '2026-06-17'`.

## Schema
```json
{
  "id": "UUID or Timestamp",
  "date": "YYYY-MM-DD HH:mm",
  "agent": "Gemini", 
  "categories": ["System", "UI", "Refactor", "Docs"], // Max 3, be specific
  "summary": "High-level description of the main achievement (e.g., 'Implemented Character Inventory UI')",
  "actions": [
    "Created file X",
    "Refactored function Y in file Z",
    "Fixed bug in tool A"
  ],
  "challenges": "Brief description of any blockers, errors, or tricky logic encountered. If none, use 'None'.",
  "next_steps": "Actionable items for the next agent. What was left unfinished? What should be tested next?"
}
```

## Category Guidelines
**Philosophy: Feature-First.** 
Do not use generic tags like "UI" or "System" unless the work is truly global. Instead, tag the specific **Feature**, **Module**, or **Tool** being worked on.

*   **Good Tags:** `Character Creator`, `Spell System`, `Inventory`, `Dev Hub`, `Chrome DevTools MCP`, `Conductor`.
*   **Bad Tags:** `UI`, `Code`, `Refactor`, `Feature`, `Bug Fix`.

This ensures the sidebar becomes a navigable map of the project's components.

## Timing
Perform this logging step as the **final action** before telling the user the task is complete.
