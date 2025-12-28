# Worklog - Dialogist

## 2025-10-26 - NPC Knowledge & Willingness Enforcement
**Learning:** Adding a strict knowledge check (`canNPCDiscuss`) allows us to decouple "Topic Existence" (Global Registry) from "Topic Availability" (Local NPC). This prevents every NPC from knowing every secret just because the player unlocked the prerequisites.
**Action:** Always check `canNPCDiscuss` before displaying a topic. Use `knowledgeProfile.topicOverrides` to gate specific information.

**Learning:** Willingness Modifiers allow for dynamic difficulty in social encounters without hard-coding DCs in the topic definition. An NPC who dislikes the player (or the topic) can have a negative modifier, effectively raising the DC.
**Action:** Use `willingnessModifier` in `NPCKnowledgeProfile` to model reluctant witnesses or eager gossips.

## 2025-10-26 - Faction Standing Prerequisite Handling
**Learning:** `playerFactionStandings` in `GameState` is sparse; players may not have an entry for every faction. Prerequisite checks must default to neutral (0) or handle undefined explicitly to prevent runtime errors when checking standing against unknown factions.
**Action:** Always default missing faction standing to 0 in prerequisite logic unless 'unknown' is a specific fail state.

## 2025-10-26 - Dialogue Side-Effects
**Learning:** The previous dialogue system relied on a purely local component state for outcomes. By introducing a 'Controller Hook' (useDialogueSystem), we can map service-level results (ProcessTopicResult) to global Redux actions (GRANT_EXPERIENCE, UPDATE_NPC_DISPOSITION) cleanly.
**Action:** When designing interactive systems, always separate the View (Component), the Logic (Service), and the Controller (Hook) that connects Logic to Global State.

## 2025-10-26 - Hook Pattern for Side Effects
**Learning:** Using a custom hook (e.g. useDialogueSystem) to encapsulate complex logic and side-effects (like Gemini API calls and Redux dispatches) keeps UI components clean and testable.
**Action:** Adopt this pattern for other complex systems like Quest Management or Trading.

## 2025-10-26 - Transactional Dialogue
**Learning:** Simply having `min_gold` as a prerequisite does not consume the resource. To implement bribes and trading, a separate `costs` array and `deductions` result field are needed to signal the reducer to remove items/gold.
**Action:** Use `TopicCost` structure for any topic that requires consumption of resources, and ensure the reducer handles the `deductions` field in `ProcessTopicResult`.
