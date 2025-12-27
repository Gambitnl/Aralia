## 2024-05-24 - Implemented Role-Based Heist Mechanics

**Learning:** Heists are most engaging when players can utilize specialized roles (Infiltrator, Muscle, Face, Lookout, Driver). A flat success check is boring.
**Action:** Implemented `HeistRole` and `performHeistAction` in `HeistManager.ts`. Each role now provides bonuses to specific actions, and specific roles like 'Lookout' can mitigate failure consequences (Alert generation).
**Verification:** Added unit tests covering role assignment, bonus calculation, and alert mitigation logic.
