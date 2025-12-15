# Mason's Journal - Critical Learnings

## 2024-05-23 - Circular Dependencies in Types
**Learning:** The `src/types/` directory had a circular dependency between `index.ts` and `combat.ts`. `index.ts` (the barrel/god object) depended on `combat.ts`, which depended back on `index.ts` for core types like `Class` and `Item`. This makes the type system fragile and hard to refactor.
**Action:** When defining types, separate "Core/Leaf" types (like `AbilityScores`, `Item`) from "Composite/Aggregate" types (like `GameState`, `CombatState`). Use specific files (`core.ts`, `items.ts`, `character.ts`) instead of a single monolithic `index.ts` that everything imports from. Ensure low-level modules (like `combat.ts`) import only from these specific files, never from the barrel file that imports *them*.
