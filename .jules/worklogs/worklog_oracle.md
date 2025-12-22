## 2025-05-23 - Type Narrowing in Unions **Learning:** When accessing properties on a union type (e.g., `string | { value: number }`), TypeScript requires narrowing the type first (e.g., via `typeof` check) before accessing properties specific to one member, even if the property access seems safe in a JS context. **Action:** Use discriminated unions or explicit type guards (e.g., `typeof duration === 'string'`) to narrow the type before property access.

## TODO: Refactor ActiveEffect to remove `any` and circular deps
**Context:**
`PlayerCharacter` in `src/types/character.ts` currently uses `activeEffects?: any[]`. This should be typed as `ActiveEffect[]`.
However, `ActiveEffect` is defined in `src/types/combat.ts`, which imports `Class` from `src/types/character.ts`. Importing `ActiveEffect` into `character.ts` creates a circular dependency (`character` -> `combat` -> `character`).

**Proposed Plan:**
1.  **Move `ActiveEffect`**: Move the `ActiveEffect` interface from `src/types/combat.ts` to `src/types/effects.ts`.
    *   `src/types/effects.ts` is a leaf node for effect types and avoids circular deps.
    *   Update `ActiveEffect` to use strict `TargetConditionFilter` instead of `any` for `attackerFilter`.
2.  **Update `character.ts`**: Import `ActiveEffect` from `src/types/effects.ts` and replace `any[]` with `ActiveEffect[]`.
3.  **Update `combat.ts`**: Remove the local definition and import `ActiveEffect` from `src/types/effects.ts`.
4.  **Update Consumers**: Update imports in files that reference `ActiveEffect` (currently importing from `combat.ts`):
    *   `src/commands/effects/DefensiveCommand.ts`
    *   `src/utils/statUtils.ts` and its test `src/utils/__tests__/statUtils.test.ts`
    *   `src/systems/spells/__tests__/DefenderFilter.test.ts`
    *   `src/systems/spells/effects/__tests__/ACCalculation.test.ts`

**Why Aborted:**
Prioritized documentation of the plan over execution at this time to allow for a clean task reset.
