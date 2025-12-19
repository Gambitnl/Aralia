## 2024-05-23 - Unified NPC Memory Architecture
**Learning:** Having competing memory types (`NpcMemory` vs `NPCMemory`) leads to data loss and orphaned systems.
**Action:** Always check `src/types` for duplicate interfaces before creating new ones. Merge them into a single canonical source (`memory.ts`) and enforce usage via strict exports.
