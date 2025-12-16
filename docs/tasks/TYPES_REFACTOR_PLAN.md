# 🧱 Mason: Plan for Breaking Circular Dependencies in `src/types`

## 🚨 The Problem: Circular Dependency
There is a critical circular dependency in the type definitions:
1.  `src/types/index.ts` (The Root/God Object) imports `CombatCharacter` from `src/types/combat.ts`.
2.  `src/types/combat.ts` imports `Class`, `Item`, and `SpellbookData` from `src/types/index.ts`.

This cycle (`index.ts` -> `combat.ts` -> `index.ts`) creates a fragile type system where importing a single type can pull in the entire universe of types, potentially leading to initialization errors, toolchain slowness, and difficult refactoring.

## 🎯 The Solution: Deconstruct the Barrel
We need to split the monolithic `src/types/index.ts` into smaller, domain-specific files that form a clean dependency tree.

### Proposed File Structure

#### 1. `src/types/core.ts` (Leaf Node)
**Dependencies:** None.
**Contents:** Primitive, shared types that everything else builds upon.
*   `AbilityScoreName`
*   `AbilityScores`
*   `Skill`

#### 2. `src/types/items.ts` (Layer 1)
**Dependencies:** `core.ts`.
**Contents:** All item and inventory related types.
*   `Item`
*   `EquipmentSlotType`
*   `ArmorCategory`
*   `Mastery`
*   `ItemEffect`
*   `ItemContainer`

#### 3. `src/types/character.ts` (Layer 2)
**Dependencies:** `core.ts`, `items.ts`.
**Contents:** Character definition, Race, and Class types.
*   `PlayerCharacter`
*   `Race`, `RacialAbilityBonus`
*   `Class`, `ClassFeature`
*   `SpellSlots`, `ResourceVial`
*   `Feat` (and related interfaces)

### 🧱 Execution Steps

1.  **Create `src/types/core.ts`**: Extract generic ability/skill types.
2.  **Create `src/types/items.ts`**: Extract `Item` and equipment types. Import from `core.ts`.
3.  **Create `src/types/character.ts`**: Extract `PlayerCharacter`, `Race`, `Class`. Import from `core.ts` and `items.ts`.
4.  **Update `src/types/combat.ts`**:
    *   Change imports to pull from `character.ts` and `items.ts` instead of `index.ts`.
    *   *Goal:* `combat.ts` should NO LONGER import from `index.ts`.
5.  **Refactor `src/types/index.ts`**:
    *   Delete the moved code.
    *   Re-export everything from the new files (`export * from './core';`, etc.) to maintain backward compatibility for the rest of the app.

### ✅ Success Criteria
*   `dpdm` (or visual inspection) shows no cycle between `combat.ts` and `index.ts`.
*   `src/types/combat.ts` has zero imports from `src/types/index.ts`.
*   Application builds successfully.
