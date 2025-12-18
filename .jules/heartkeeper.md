
## 2024-05-23 - Dynamic Companion Reactions
**Learning:** Hard-coding companion reactions (like "Kaelen hates forests") in `useCompanionReactions` is brittle. A better approach is to tag biomes and locations with "moods" or "tags" (e.g., `spooky`, `luxurious`, `chaotic`) and match these against companion `PersonalityTraits` and `Values`.
**Action:** In future iterations, move reaction logic to a `CompanionBrain` system that evaluates `PersonalityTraits` against `Location.tags` to generate reactions procedurally or select from a weighted list.
