# Templar Journal

## 2025-05-18 - Divine Favor and Temple Infrastructure **Learning:** Creating mechanically distinct deities requires associating specific actions (`approves`/`forbids`) with each deity. A simple favor scale (-100 to 100) provides a flexible foundation for diverse interactions (services, blessings). Centralizing favor logic in `religionReducer` allows seamless integration with the action system. **Action:** Future deity additions must define unique `approves` lists to ensure they feel different in gameplay.
## 2024-05-23 - Combat Religion Integration
**Learning:** Decoupling combat logic from higher-order systems (like Religion) is best achieved via an event/log stream adapter pattern () rather than hard-coding dependency checks inside the physics engine.
**Action:** When adding future subsystems (e.g., Faction Reputation or Quest Updates based on combat), reuse this Adapter pattern by listening to  and enriching the log data payload.
## 2024-05-23 - Combat Religion Integration
**Learning:** Decoupling combat logic from higher-order systems (like Religion) is best achieved via an event/log stream adapter pattern (`CombatReligionAdapter`) rather than hard-coding dependency checks inside the physics engine.
**Action:** When adding future subsystems (e.g., Faction Reputation or Quest Updates based on combat), reuse this Adapter pattern by listening to `CombatLogEntry` and enriching the log data payload.
