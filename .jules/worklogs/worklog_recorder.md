# Recorder's Worklog

## 2024-05-23 - Structured Memory System
**Learning:** Implemented a structured `NPCMemory` system with `Interaction` (ID, significance, witnesses) and `Fact` (confidence, source).
**Action:** Added `src/utils/memoryUtils.ts` with `addInteraction`, `decayMemories`, and `getRelevantMemories`.
**Action:** Left TODO in `src/types/companions.ts` to migrate legacy approval systems to this new structure.
