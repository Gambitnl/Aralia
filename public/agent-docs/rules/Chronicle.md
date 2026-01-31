# Development Chronicle Guidelines

## Mandate
At the conclusion of a significant development session (adding features, fixing bugs, refactoring), the agent MUST log a summary of their actions to the **Development Chronicle**.

## Procedure
1.  **Analyze the Session**: Review the tools used, files modified, and challenges encountered.
2.  **Read Data**: Read the current `misc/chronicle_data.json` file.
3.  **Generate Entry**: Create a new JSON object following the schema below.
4.  **Append & Save**: Add the new object to the array and write the file back.

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
