# NPC Behavior Configuration (`src/config/npcBehaviorConfig.ts`)

## Purpose

The `npcBehaviorConfig.ts` module centralizes all static configuration variables that control the behavior, memory, and social simulation of Non-Player Characters (NPCs) in the "Living NPC" system.

Decoupling these parameters from the core logic in `src/hooks/actions/handleWorldEvents.ts` allows for easy tuning of the social simulation without modifying complex game logic.

## Exports

### Gossip System Tuning
*   **`MAX_GOSSIP_EXCHANGES_PER_LOCATION: number`**:
    *   The maximum number of gossip exchanges that can happen within a single location during one "Gossip Event" (e.g., during a Long Rest).

*   **`MAX_TOTAL_GOSSIP_EXCHANGES: number`**:
    *   A global cap on the number of gossip exchanges that can occur across the entire world during one "Gossip Event." This prevents performance issues in a world with many populated locations.
    
*   **`MAX_CROSS_LOCATION_EXCHANGES: number`**:
    *   A cap on how many rumors can travel between connected locations during one event.

### NPC Memory Tuning
*   **`MAX_FACTS_PER_NPC: number`**:
    *   The maximum number of `KnownFact` objects an NPC can retain in their memory. When this limit is exceeded, the least important/oldest facts are pruned.

*   **`DRIFT_THRESHOLD_DAYS: number`**:
    *   The number of in-game days that must pass without player interaction before an NPC's disposition score begins to "drift" back toward neutral.
