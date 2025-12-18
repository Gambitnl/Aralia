# Schemer's Journal

## 2024-05-22 - NPC Memory Architecture
**Learning:** `TownNPC` (generic) and `Companion` (specific) have divergent data needs. Companions use a complex `Relationship` model, while generic NPCs need a lighter `NPCMemory` for simple interaction tracking.
**Action:** When integrating `NPCMemory` into `TownNPC`, ensure it remains optional (`?`) so that thousands of background NPCs don't carry empty memory objects. Only instantiate it when the player actually interacts with them.
