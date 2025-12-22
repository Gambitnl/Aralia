# Timekeeper Worklog

## 2024-05-22 - Initial Assessment **Learning:** The time system in Aralia needs to be more than just a clock. It needs to drive gameplay through deadlines, seasonal changes, and meaningful day/night cycles. The current state is basic time tracking. **Action:** I will begin by analyzing the current time implementation to identify where urgency and seasonal effects can be injected.

## 2024-05-22 - Weather Integration Plan **Learning:** The `WeatherSystem` exists but is disconnected from the main game loop (time advancement). For time to feel meaningful, weather should change dynamically as time passes and directly impact gameplay (travel, vision). **Action:** Documented a detailed plan to integrate weather into `worldReducer` and `timeUtils` for future implementation.

### TODO: Dynamic Weather & Meaningful Time Architecture

**Goal:** Make the passage of time mechanically impactful by allowing weather to shift and influence player actions.

**1. Activate Weather in `worldReducer`**
- **Current State:** `ADVANCE_TIME` only increments the clock and processes basic world events. Weather is static or manually set.
- **Proposed Change:**
    - Import `updateWeather` from `src/systems/environment/WeatherSystem.ts`.
    - In the `ADVANCE_TIME` case, calculate the new weather state based on the current biome and elapsed time.
    - Update `state.environment` with the result.
    - Triggers logs if weather conditions change significantly (e.g., "A storm begins to brew.").

**2. Update `timeUtils` for Weather Awareness**
- **Current State:** `getTimeModifiers` only looks at Season and Time of Day.
- **Proposed Change:**
    - Update signature: `getTimeModifiers(date: Date, weather?: WeatherState)`.
    - Incorporate weather mechanics:
        - **Precipitation:** Rain/Storms increase travel cost.
        - **Temperature:** Extreme heat/cold could impose exhaustion risks (future).
        - **Visibility:** Fog/Blizzards reduce vision range.
    - Generate richer descriptions: "The storm howls, making travel difficult." instead of just "It is night."

**3. System Integration**
- **Movement:** Ensure `handleMovement.ts` passes the current `state.environment` to `getTimeModifiers` so travel times reflect the weather.
- **Context:** Update `generateGeneralActionContext` to include weather descriptions in the narrative prompt for AI.

**4. Verification Plan**
- **Unit Tests:**
    - Test `worldReducer` correctly transitions weather over long durations.
    - Test `getTimeModifiers` returns higher costs during storms.
- **Manual Check:**
    - Wait for hours in-game and observe weather changes in the UI/Logs.
