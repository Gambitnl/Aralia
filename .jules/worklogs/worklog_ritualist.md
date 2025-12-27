## 2024-05-22 - Discovery Phase
**Learning:**
1. `src/types/spells.ts` supports `ritual: boolean` and `castingTime: { unit: 'minute' | 'hour' | 'special' }`.
2. `src/utils/spellAbilityFactory.ts` converts casting time to 'action', 'bonus', 'reaction' cost, but has NO HANDLING for minutes/hours. It just defaults to 'action'.
3. `src/hooks/combat/useActionExecutor.ts` executes actions immediately. There is no "start casting" vs "finish casting" state.
4. `src/types/combat.ts` (implied from factory) lacks a `casting` state on `CombatCharacter`.

**Conclusion:** Rituals and long-cast spells are currently treated as instant actions or are uncastable in combat without proper duration tracking. This is a clear system gap.

**Action:**
1. Design `RitualState` interface to track ongoing casts.
2. Update `CombatCharacter` to include `currentRitual`.
3. Create a `RitualManager` system (hook/service) to handle progress updates and interruptions.
