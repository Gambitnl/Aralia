# Feature Changelog: Living NPC System

This file documents the iterative implementation of the "Living NPC" feature set, including the Gossip, Witness, and Reputation systems.

## 04:57:30 PM - Monday, July 21, 2025
### Added
*   **Planning for Phase 3.3**: Added a detailed implementation plan for the "Location Adjacency Model" to the main implementation guide. This phase will involve:
    1.  Updating the `Location` type in `src/types.ts` to include an optional `gossipLinks: string[]` property.
    2.  Adding these links to the static location data in `src/data/world/locations.ts` to define a "gossip network."
    3.  Enhancing the `handleGossipEvent` in `src/hooks/actions/handleWorldEvents.ts` to simulate a limited spread of rumors between these newly connected locations during a Long Rest.

## 04:48:08 PM - Monday, July 21, 2025
### Added & Changed (Complete "Living NPC" System Implementation)
This entry summarizes a major period of development that brought the core "Living NPC" system to a feature-complete state.

*   **Phase 1: Gossip & Witness System**
    *   Upgraded the NPC memory system from simple strings to structured `KnownFact` objects, allowing for metadata like source (direct vs. gossip) and significance.
    *   Implemented save game migration to seamlessly update older saves to the new data structure.
    *   Created the `handleGossipEvent`, a performance-conscious handler that simulates the spread of rumors between NPCs during a Long Rest, using batched state updates to minimize re-renders.
    *   Integrated the Gemini API to intelligently rephrase facts as they spread, making gossip sound more natural.

*   **Phase 2: Reputation Management & Player Agency**
    *   Enhanced the AI's custom action generation to prioritize suggesting player actions related to rumors an NPC has heard (e.g., "Ask where they heard that," "Discredit the rumor").
    *   Updated social skill check outcomes to generate more specific, narrative memories for NPCs (e.g., "The player convinced me they weren't involved..."), creating richer context for future interactions.

*   **Phase 3: Event Residue System**
    *   Implemented a system where unwitnessed player actions (like forcing a lock) can leave behind "residue" or evidence.
    *   Created the `handleResidueChecks` event, which runs during a Long Rest and gives NPCs a chance to discover this evidence.
    *   Discoveries create new `KnownFact` objects for the discovering NPC and generate a "Past Action Discovered" entry in the player's Discovery Journal.

*   **Phase 4: Dynamic Gossip Triggers**
    *   The gossip system now triggers dynamically when the player travels between major world map tiles, simulating the spread of their reputation.
    *   Implemented an "Egregious Acts" system where flagrantly negative public actions (e.g., attacking a guard) trigger an *immediate* gossip event among all NPC witnesses in the location.

*   **Phase 5: Consequence Linking (UI Feedback Loop)**
    *   Solidified the data link between a discovery event (from residue or an egregious act) and the memory it creates in an NPC by using a shared `sourceDiscoveryId`.
    *   Enhanced the `DiscoveryLogPane` to display a new "Consequences" section, which shows the player exactly which NPCs have learned about a specific event from their journal, making the social simulation's effects transparent and rewarding.