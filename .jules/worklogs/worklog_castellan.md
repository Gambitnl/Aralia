## 2024-05-24 - Stronghold Threats
**Learning:** Adding dynamic "Threats" to Strongholds transforms them from passive income generators into active management responsibilities. By tying threat severity to wealth/upgrades and resolution to defense rating, we create a loop where success breeds danger, necessitating investment in defense (Upgrades/Staff).
**Action:** When designing future systems (like Organizations), ensure there is always a counter-force (e.g., Rivals, Spies) that scales with success to maintain engagement.

## 2024-05-25 - Stronghold Missions
**Learning:** Bridging static property ownership with active gameplay is best achieved by transforming passive assets (Staff) into active agents (Missions). This solves the "Property as Inventory Slot" problem by requiring daily decisions about resource allocation (Supplies) and risk management (Staff unavailability).
**Action:** Apply this "Agent" pattern to other systems—e.g., ships should not just be vehicles but deployable assets for trade routes.

## 2025-10-27 - Organization Leadership
**Learning:** Implementing `organizationService.ts` revealed that organizations need a distinct "Resource Loop" compared to strongholds. While strongholds consume Supplies to generate Gold/Defense, Organizations consume Gold (wages) to generate Influence/Connections. This distinction is crucial for player motivation—you build a castle for safety/wealth, but you build an organization for power/reach.
**Action:** Ensure UI clearly distinguishes these loops. Stronghold UI should focus on *stability* (defense, supplies), while Organization UI should focus on *projection* (missions, influence).

## 2025-10-27 - Succession Systems
**Learning:** The "Succession System" pattern (`processSuccession`) bridges the gap between individual character death and long-term player engagement. By calculating an "Inheritance Tax" modified by reputation (Infamy increases tax, Honor reduces it) and adding an "Stability Check" for transferring assets, we turn death into a meaningful mechanic rather than a game-over state.
**Action:** Future "Dynasty" features should build on this by allowing "Heir Training" during the active character's life to improve stability rolls or reduce taxes.
