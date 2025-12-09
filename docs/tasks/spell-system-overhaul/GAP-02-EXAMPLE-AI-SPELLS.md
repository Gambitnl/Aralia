# Gap: Missing Example AI Spells

**Priority:** High
**Status:** Open
**Detected:** Dec 2025 (Agent Epsilon Review)

## Findings
The AI Arbitration engine is now functional, but there is no content to verify it.
- **Location:** `public/data/spells/` contains only legacy or mechanical spells.
- **Search:** No JSON files currently use `"arbitrationType": "ai_assisted"` or `"ai_dm"`.

## The Problem
"Proof of Life" is missing. Without example spells:
1. We cannot verify the end-to-end flow.
2. Future developers won't have a template to copy for creating complex spells.
3. The feature remains "theoretical" despite having working code.

## Proposed Solution
Create 2-3 "Golden Standard" JSON files to serve as test cases and examples.

### 1. `meld-into-stone.json` (Tier 2 - Context Validation)
- **Mechanic:** Requires a stone surface nearby.
- **Test Target:** `MaterialTagService` (Context Awareness).
- **JSON Snippet:**
```json
"arbitrationType": "ai_assisted",
"aiContext": {
  "prompt": "Analyze the context. Is the caster standing on or adjacent to natural stone or a stone wall? If yes, allow. If no, deny.",
  "playerInputRequired": false
}
```

### 2. `suggestion.json` (Tier 3 - DM Adjudication)
- **Mechanic:** User inputs a command; AI decides if it's reasonable.
- **Test Target:** `NarrativeCommand` + Input UI.
- **JSON Snippet:**
```json
"arbitrationType": "ai_dm",
"aiContext": {
  "prompt": "The player casts Suggestion with the command: '{playerInput}'. Is this a reasonable suggestion that doesn't cause self-harm? If valid, describe the target following the order.",
  "playerInputRequired": true
}
```

## Dependencies
- `GAP-01-AI-INPUT-UI.md` (Required for Suggestion to work).
