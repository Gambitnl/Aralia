## 2024-05-23 - Created Hazard System Framework **Learning:** Natural hazards require distinct trigger mechanisms compared to spell effects, as they are intrinsic to the environment and persistent. **Action:** Future implementations should consider hazards as active entities that can be manipulated (e.g. freezing water to create ice).

## 2024-05-23 - Design: Time of Day Weather Integration **Learning:** Weather simulation requires tighter integration with the global time system to feel immersive. **Action:** Pending implementation of the following design:
### TODO: Integrate TimeOfDay into WeatherSystem
**Goal:** Make weather react to Day/Night cycles (Temperature drops at night, Visibility decreases).
**Design:**
1.  **Update `updateWeather` signature:**
    ```typescript
    updateWeather(currentWeather: WeatherState, biomeId: string, timeOfDay: TimeOfDay): WeatherState
    ```
2.  **Temperature Mechanics:**
    - **Night:** Shift temperature index down by 1 (e.g., Hot -> Temperate).
    - **Day (Desert):** Shift temperature index up by 1.
    - **Caveat:** Be careful of "drift" where repeated updates compound the shift (e.g., Night 1: Hot->Temperate, Night 2: Temperate->Cold). Consider recalculating from a "Base Climate" or resetting stability.
3.  **Visibility Mechanics:**
    - **Night:** Force `visibility: 'heavily_obscured'` (Darkness).
    - **Dusk/Dawn:** Force `visibility: 'lightly_obscured'` if weather is clear.
    - **Priority:** Storms/Blizzards (Heavily Obscured) override Dusk/Dawn.
**Status:** IMPLEMENTED.

## 2025-05-23 - Implemented Time-Aware Weather **Learning:** When modifying state based on transient factors like Time of Day (e.g. temperature shift), one must be careful not to persist the *shifted* state as the new *base* state, or else the system drifts (e.g. getting colder every night forever). **Action:** The implementation re-calculates shifts from the *generated* base state rather than applying delta to the previous state's output.
