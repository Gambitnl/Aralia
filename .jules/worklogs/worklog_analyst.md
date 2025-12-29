## 2025-12-29 - Gap Analysis: NPC Memory for Spell Consequences

**Learning:** I discovered that while `NPC` and `NPCMemory` types exist, there was no active system to record memories. Specifically, spells like `Charm Person` have post-effect consequences ("Creature knows it was charmed") that had no mechanical way to be tracked.

**Action:** Created `MemorySystem` (stateless service) and added `'magical_manipulation'` to `MemoryInteractionType`.

**Future:** This system needs to be wired into `SpellSystem` or `StatusConditionCommand` to automatically trigger when specific conditions (like Charmed) expire.
