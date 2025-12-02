# Guide: "Living NPC" Gossip & Witness System Implementation Checklist

This document is the consolidated, actionable implementation plan for the **"Gossip & Witness"** system. It integrates all previously discussed refinements into a single checklist to ensure a robust, performant, and immersive feature.

---

## Core Principles: Performance First

This system is built on these principles to prevent performance degradation:

-   **Event-Driven**: Gossip propagation is not a constant simulation. It happens in a single, batched **"Gossip Event"** at specific moments.
-   **Localized & Capped**: Gossip spreads locally between NPCs in the same area, with a hard cap on the number of exchanges per event to ensure predictable, constant-time processing.
-   **Efficient Data Structures**: Uses a structured `KnownFact` object to track metadata without significant data bloat.
-   **Batched Updates**: All state changes from a Gossip Event are dispatched in a single reducer action to minimize UI re-renders.

---

## Implementation Checklist

### Phase 1: Foundation - Data Structures & Compatibility

**Goal:** Evolve the game's data structures to support the new system while ensuring backward compatibility for existing save files.

-   [x] **1.1: Update Core Types for `KnownFact`**
-   [x] **1.2: Implement Save Game Migration**
-   [x] **1.3: Refactor Fact Creation Points**
-   [x] **1.4: Implement "Event Residue" System**

---

### Phase 2: The Gossip Engine - Spreading Information

**Goal:** Create the core logic that simulates the spread of information between NPCs in a performant way.

-   [x] **2.1: Create World Event Handler & Gossip Logic**
-   [x] **2.2: Implement Gossip Mutation**
-   [x] **2.3: Implement Batch Update Action**

---

### Phase 3: Integration & Triggers

**Goal:** Trigger the gossip event at logical points in gameplay and ensure the new information is used by the AI and player-facing systems.

-   [x] **3.1: Trigger Gossip Event on Long Rest**
-   [x] **3.2: Enhance AI Dialogue Prompts for Gossip**
-   [x] **3.3: Implement Location Adjacency Model**
-   [x] **3.4: Implement Additional Dynamic Triggers (World Travel & Egregious Acts)**

---

### Phase 4: Player Agency & UI

**Goal:** Make the new social web mechanics transparent and rewarding for the player.

-   [x] **4.1: Add Player Agency for Rumors**
-   [x] **4.2: Enhance Character Logbook UI**
-   [x] **4.3: Implement Consequence Linking**

---

### Phase 5: Long-Term Balance & Performance

**Goal:** Implement systems to manage memory bloat and make NPC relationships feel more dynamic over time.

### **Final Plan: A Unified, Performant Approach**

**Critique of Previous Plans:**
Iterative review revealed that handling memory decay, pruning, and disposition drift as separate processes during a Long Rest was inefficient. It would require multiple loops over the entire `npcMemory` object and could lead to several dispatched actions, causing unnecessary UI re-renders.

**The Final, Consolidated Plan:**
This final plan merges all three maintenance tasks into a **single, unified function** that runs during a Long Rest. This function will calculate all memory decay, pruning, and disposition drift for *every NPC at once*, produce a single new `npcMemory` state object, and then dispatch a **single, batched state update**. This is atomic, maximally performant, and guarantees a consistent state.

---
### **Implementation Checklist**

-   [x] **5.1: Implement Long Rest World Events (Decay, Pruning & Drift)**
    -   **Goal**: Create a single, atomic function that handles all NPC memory maintenance during a Long Rest and updates the state in one batch.
    -   **Implementation Plan**:
        1.  **Update Core Types**:
            -   **File**: `src/types.ts`
            -   **Action**:
                -   Add `strength: number` (1-10) and `lifespan: number` (in-game days) to the `KnownFact` interface.
                -   Add `lastInteractionTimestamp: number` to the `NpcMemory` interface.
            -   **Comments**: These fields provide the necessary metadata for the new maintenance logic.

        2.  **Update Fact & Interaction Creation Points**:
            -   **Files**: `src/hooks/actions/handleNpcInteraction.ts`, `handleGeminiCustom.ts`, `handleWorldEvents.ts`.
            -   **Action**:
                -   Whenever a `KnownFact` is created, assign it a default `strength` and `lifespan` based on its significance (e.g., gossip is weak, witnessing a crime is strong).
                -   In `handleTalk`, dispatch a new action `UPDATE_NPC_INTERACTION_TIMESTAMP` to update `lastInteractionTimestamp` for the relevant NPC to the current `gameState.gameTime`.

        3.  **Create Batch Update Action**:
            -   **File**: `src/state/actionTypes.ts`
            -   **Action**: Define a new action type: `BATCH_UPDATE_NPC_MEMORY`. Its payload will be the entire updated `npcMemory` object (`Record<string, NpcMemory>`).
            -   **File**: `src/state/reducers/npcReducer.ts`
            -   **Action**: Add a `case` for `BATCH_UPDATE_NPC_MEMORY` that simply replaces `state.npcMemory` with `action.payload`.

        4.  **Create the `handleLongRestWorldEvents` Function**:
            -   **File**: `src/hooks/actions/handleWorldEvents.ts`
            -   **Action**: Create a new function `handleLongRestWorldEvents(gameState: GameState): Record<string, NpcMemory>`. This function must be pure; it should calculate and **return** the new state but **not** dispatch any actions itself.
            -   **Coding Suggestions**:
                ```typescript
                // In src/hooks/actions/handleWorldEvents.ts

                /**
                 * Calculates all overnight NPC memory changes: decay, pruning, and disposition drift.
                 * This is a pure function that returns the new state without dispatching.
                 * DEPENDS ON: gameState.npcMemory, gameState.gameTime
                 * MODIFIES: Nothing directly.
                 * RETURNS: A new, updated npcMemory object.
                 */
                export function handleLongRestWorldEvents(gameState: GameState): GameState['npcMemory'] {
                    const MAX_FACTS_PER_NPC = 25;
                    const DRIFT_THRESHOLD_DAYS = 3;
                    const DRIFT_THRESHOLD_MS = DRIFT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
                    const currentTime = gameState.gameTime.getTime();

                    // Create a deep copy to modify safely.
                    const newNpcMemory = JSON.parse(JSON.stringify(gameState.npcMemory));

                    for (const npcId in newNpcMemory) {
                        const memory = newNpcMemory[npcId];
                        
                        // 1. Fact Decay & Pruning Logic
                        memory.knownFacts = memory.knownFacts.map(fact => ({
                            ...fact,
                            lifespan: (fact.lifespan < 999) ? fact.lifespan - 1 : fact.lifespan,
                        })).filter(fact => fact.lifespan > 0);

                        if (memory.knownFacts.length > MAX_FACTS_PER_NPC) {
                            memory.knownFacts.sort((a, b) => a.strength - b.strength || a.timestamp - b.timestamp);
                            memory.knownFacts = memory.knownFacts.slice(memory.knownFacts.length - MAX_FACTS_PER_NPC);
                        }

                        // 2. Disposition Drift Logic
                        const timeSinceInteraction = currentTime - (memory.lastInteractionTimestamp || 0);
                        if (timeSinceInteraction > DRIFT_THRESHOLD_MS && memory.disposition !== 0) {
                           // Nudge disposition 5% closer to zero, rounding to nearest integer.
                           const newDisposition = Math.round(memory.disposition * 0.95);
                           memory.disposition = newDisposition;
                        }
                    }
                    return newNpcMemory;
                }
                ```

        5.  **Integrate the Trigger**:
            -   **File**: `src/hooks/actions/handleResourceActions.ts`
            -   **Action**: Refactor the `handleLongRest` function.
            -   **Coding Suggestions**:
                ```typescript
                // In handleLongRest in handleResourceActions.ts
                addMessage("As you rest, the world does not stand still...", "system");

                // First, calculate all memory changes.
                const newNpcMemoryState = handleLongRestWorldEvents(gameState);
                // Then, dispatch the single batch update.
                dispatch({ type: 'BATCH_UPDATE_NPC_MEMORY', payload: newNpcMemoryState });
                
                // Then, run the gossip simulation on the newly updated state.
                const updatedGameState = { ...gameState, npcMemory: newNpcMemoryState };
                await handleGossipEvent(updatedGameState, addGeminiLog, dispatch);
                
                // Finally, dispatch the player's rest and time advancement.
                dispatch({ type: 'LONG_REST' });
                dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 8 * 3600 } });
                ```