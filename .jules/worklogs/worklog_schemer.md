# Schemer's Journal

## 2024-05-22 - NPC Memory Architecture
**Learning:** `TownNPC` (generic) and `Companion` (specific) have divergent data needs. Companions use a complex `Relationship` model, while generic NPCs need a lighter `NPCMemory` for simple interaction tracking.
**Action:** When integrating `NPCMemory` into `TownNPC`, ensure it remains optional (`?`) so that thousands of background NPCs don't carry empty memory objects. Only instantiate it when the player actually interacts with them.

## 2024-05-24 - Animation Type Safety
**Learning:** `Animation` interfaces often use `data: any` to accommodate various animation types (move, attack, spell), but this weakens type safety in renderers and logic hooks.
**Action:** Use a discriminated union (like `AnimationData` with `MoveAnimationData | AttackAnimationData`) to strictly type the `data` payload based on the `type` field, even if the parent interface remains generic for legacy reasons. This catches missing properties (like `targetPositions` in spell effects) at compile time.
