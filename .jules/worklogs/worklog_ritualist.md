## 2024-05-24 - Ritual Framework Foundation **Learning:** Defining a clear `RitualState` with explicit `interruptConditions` allows for a flexible system that can handle both standard D&D rituals (damage check) and custom ceremonial mechanics (movement, noise). **Action:** When implementing the UI, ensure the progress bar visualizes the specific interruption conditions so players know what to avoid.
## 2025-05-27 - Group Ritual Participation **Learning:** Adding a Save DC reduction for participants gamifies group casting, encouraging players to protect the ritual caster. **Action:** When implementing the UI, ensure the progress bar visualizes the specific interruption conditions so players know what to avoid.
## 2025-05-27 - Ritual Constraint Verification **Learning:** Explicitly validating requirements (Time, Location) *before* starting the ritual prevents wasted player time and adds narrative weight to the "Ceremony". **Action:** Ensure the UI surfaces these requirements clearly in the spell tooltip before casting is attempted.
## 2025-10-26 - Ritual Backlash System **Learning:** Implementing a "Backlash" configuration that triggers on interruption (scaled by progress) adds necessary tension to long casts. Players shouldn't just lose time; they should fear the incomplete magic. **Action:** When designing high-level rituals, always include a 'damage' or 'summon' backlash to discourage trivial casting in dangerous areas.

### TODO: Implement Ritual Backlash Execution System
**Context:** The `RitualState` supports a `backlash` array, but there is no engine logic to execute these effects when a ritual is interrupted.
**Plan:**
1.  **Create `src/systems/rituals/RitualBacklashSystem.ts`**:
    *   **Interface `BacklashResult`**:
        ```typescript
        interface BacklashResult {
          messages: string[];
          damageEvents: Array<{ targetId: string; amount: number; type?: string }>;
          statusEvents: Array<{ targetId: string; condition: string; duration?: number }>;
          summonEvents: Array<{ creatureId: string; count: number }>;
        }
        ```
    *   **Function `executeBacklash(backlashList: RitualBacklash[], casterId: string, participantIds: string[]): BacklashResult`**:
        *   Iterate through `backlashList`.
        *   Roll damage using `combatUtils.rollDice`.
        *   Target `casterId` and all `participantIds`.
        *   Return the structured `BacklashResult`.

2.  **Integration Point**:
    *   In `RitualManager.checkInterruption`, if interruption occurs and `saveToResist` fails (or isn't present), retrieve relevant backlash using `getBacklashOnFailure`.
    *   Call `executeBacklash` with the retrieved effects.
    *   **Architecture Decision Needed:** Should `RitualManager` return the `BacklashResult` to the reducer, or should the reducer call `executeBacklash`?
        *   *Recommendation:* Keep `RitualManager` pure. The Reducer (or Saga/Thunk) should call `RitualManager.getBacklashOnFailure`, then call `executeBacklash`, then dispatch the resulting damage/summon events to the engine.

3.  **Future UI Work**:
    *   Display "Ritual Backlash!" warning.
    *   Show specific VFX for backlash (e.g., necrotic explosion).
