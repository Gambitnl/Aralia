# Schemer's Journal

## 2024-05-22 - NPC Memory Architecture
**Learning:** `TownNPC` (generic) and `Companion` (specific) have divergent data needs. Companions use a complex `Relationship` model, while generic NPCs need a lighter `NPCMemory` for simple interaction tracking.
**Action:** When integrating `NPCMemory` into `TownNPC`, ensure it remains optional (`?`) so that thousands of background NPCs don't carry empty memory objects. Only instantiate it when the player actually interacts with them.

## 2024-05-24 - Animation Type Safety
**Learning:** `Animation` interfaces often use `data: any` to accommodate various animation types (move, attack, spell), but this weakens type safety in renderers and logic hooks.
**Action:** Use a discriminated union (like `AnimationData` with `MoveAnimationData | AttackAnimationData`) to strictly type the `data` payload based on the `type` field, even if the parent interface remains generic for legacy reasons. This catches missing properties (like `targetPositions` in spell effects) at compile time.

## 2024-05-27 - Magic Item Complexity
**Learning:** `Item` interfaces often rely on loose string properties for magical effects (`properties: string[]`), which fails to capture structural data like attunement logic, charge reset conditions, or specific curse triggers.
**Action:** Created `MagicItemProperties` as a distinct, optional interface attached to `Item`. This separates "physical" item traits (weight, cost) from "magical" mechanics (charges, attunement), allowing systems like `AttunementManager` to operate purely on the `magicProperties` object without needing the full item context.

## 2024-05-28 - Loot System Structure
**Learning:** Loot systems often suffer from rigid "drop lists" that don't scale to nested tables or conditional drops (e.g., quest items).
**Action:** Designed `LootEntry` as a discriminated union (`item` | `currency` | `table` | `nothing`) within a `LootTable`. This allows recursive table rolls (a chest rolling on "Rare Weapons") and failure states ("Nothing" entry) without complex logic in the service layer.
