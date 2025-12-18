## 2024-05-22 - Ritual State Integration
**Learning:** A static `RitualManager` utility class is insufficient for game loops; rituals must be tracked in the persistent `GameState` (Redux) to survive save/load cycles and handle tick-based updates.
**Action:** Always pair mechanics managers with a corresponding reducer and state slice immediately.
