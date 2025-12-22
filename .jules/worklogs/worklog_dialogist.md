# Worklog - Dialogist

## 2025-10-26 - NPC Knowledge & Willingness Enforcement
**Learning:** Adding a strict knowledge check (`canNPCDiscuss`) allows us to decouple "Topic Existence" (Global Registry) from "Topic Availability" (Local NPC). This prevents every NPC from knowing every secret just because the player unlocked the prerequisites.
**Action:** Always check `canNPCDiscuss` before displaying a topic. Use `knowledgeProfile.topicOverrides` to gate specific information.

**Learning:** Willingness Modifiers allow for dynamic difficulty in social encounters without hard-coding DCs in the topic definition. An NPC who dislikes the player (or the topic) can have a negative modifier, effectively raising the DC.
**Action:** Use `willingnessModifier` in `NPCKnowledgeProfile` to model reluctant witnesses or eager gossips.

## 2025-10-26 - Faction Standing Prerequisite Handling
**Learning:** `playerFactionStandings` in `GameState` is sparse; players may not have an entry for every faction. Prerequisite checks must default to neutral (0) or handle undefined explicitly to prevent runtime errors when checking standing against unknown factions.
**Action:** Always default missing faction standing to 0 in prerequisite logic unless 'unknown' is a specific fail state.
