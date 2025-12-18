## 2024-05-22 - Planar System Architecture **Learning:** Established a data-driven planar system where `Plane` objects define physics, magic, and emotional valence, linked to `Location` via `planeId`. **Action:** When adding new planes, define them in `src/data/planes.ts` and ensure distinct `atmosphereDescription` and `traits` to maintain unique mechanical identities.## 2025-12-18 - [Planar Distinction Systems]
**Learning:** Planar mechanics need to be distinct and enforced programmatically, not just flavor text. The "Memory Loss" mechanic for Feywild is a classic trope that can be gamified via Wisdom saves upon exit.
**Action:** Implemented `FeywildMechanics` class to handle memory checks. Future planes should follow this "System Class" pattern (e.g., `AbyssMechanics`) rather than monolithic utils.

**Learning:** Portal activation requirements (items, conditions) add immediate gameplay value to finding portals.
**Action:** Created `PortalSystem` to standardize checks. Next step is to integrate this into the main interaction loop.
