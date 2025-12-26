# Shadowbroker Worklog

## 2024-05-22 - Heist Roles & Action System
**Learning:** Heists without roles are just glorified skill checks. By adding `HeistRole` (Leader, Infiltrator, Muscle, Face, Lookout, Driver), we force the player to build a team.
**Action:** Implemented `HeistRole` and `performHeistAction`. Future implementations should include specific `HeistAction` cards for the UI (e.g., "Use Grappling Hook" is an Infiltrator action that reduces noise).

**Learning:** Deterministic Alert Scaling
**Action:** Actions now have explicit `noise` (alert on success) and `risk` (alert on failure). This allows for strategy: "Do we use the loud explosive (high noise, low risk) or the quiet lockpick (low noise, high risk)?".

**Learning:** Mitigation Mechanics
**Action:** The `Lookout` role now actively reduces alert generation during the heist loop. This makes non-active roles feel impactful.
