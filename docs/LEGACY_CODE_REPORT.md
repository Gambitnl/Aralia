# Legacy Code Report

## 1. Legacy Ability System (Combat)

**File:** `src/hooks/useAbilitySystem.ts`
**Location:** `executeAbilityInternal` function (Lines 364-474) and `applyAbilityEffects` function (Lines 226-302).

### Description
The combat system is currently in a transitional state between an old, direct-mutation approach and a new Command Pattern architecture.
- **Path A (Modern):** Uses `SpellCommandFactory` and `CommandExecutor` to handle spells. This is the robust, extensible future of the system.
- **Path B (Legacy):** Uses `executeAbilityInternal` (non-spell branch) and `applyAbilityEffects` to handle basic attacks and non-spell abilities. It manually calculates hit rolls, damage, and updates state directly.

### Why it is Legacy
It bypasses the unified `Command` system (Gamma Agent's work), meaning it misses out on standardized logging, undo/redo potential (if added later), and centralized effect processing. It creates a dual-path logic where spells behave differently from weapon attacks.

### Risks of Removal
Removing this block **now** would break all basic attacks (melee/ranged weapons) unless they are first migrated to use the Command Pattern (e.g., an `AttackCommand`).
- **Dependencies:** The "Attack Rider System" (Smite, Sneak Attack) is currently hooked into this legacy path.
- **Impact:** Combat would become non-functional for any non-spell action.

### Recommendation
1.  **Do NOT remove yet.**
2.  **Migration Plan:** Create a `WeaponAttackCommand` in `src/commands/effects/` that encapsulates the logic currently in `Path B`.
3.  Once `WeaponAttackCommand` is operational, switch `executeAbilityInternal` to use it, unifying the code paths.

---

## 2. Legacy Save Migration (Storage)

**File:** `src/services/saveLoadService.ts`
**Location:** `mergeWithLegacySaves` function.

### Description
This utility merges old, single-slot local storage saves (keys `aralia_rpg_default_save`, `aralia_rpg_autosave`) into the new multi-slot index format (`aralia_rpg_slot_*`).

### Why it is Legacy
The game has moved to a robust multi-slot save system. This code exists solely to ensure users from the Alpha/Pre-Alpha versions don't lose their progress upon upgrading to the current version.

### Risks of Removal
- **Data Loss:** Returning players with old data in Local Storage will see an empty "Load Game" screen. Their save files will effectively be orphaned (still in storage, but not readable).
- **Low Impact otherwise:** It does not affect new users or performance significantly.

### Recommendation
1.  **Keep for now.** It is a low-cost safety net.
2.  **Future Removal:** Can be removed after a major version bump (e.g., v1.0.0) where a "clean slate" or explicit migration tool is announced.

---

## 3. Tiefling Legacy (Not Code)
**Clarification:** References to "Tiefling Legacy" in the codebase (`TieflingLegacySelection.tsx`) refer to the D&D 5e racial feature "Fiendish Legacy" and are **NOT** deprecated code. They are active gameplay features.

## 4. "Legacy" Spell Duration
**File:** `src/commands/effects/ReactiveEffectCommand.ts`
**Location:** `getDurationInRounds`
**Description:** Handles duration objects shaped like `{ unit: 'round', value: 1 }` vs the new `{ type: 'rounds', value: 1 }`.
**Recommendation:** Clean up when refactoring spell data JSONs. Low priority.
