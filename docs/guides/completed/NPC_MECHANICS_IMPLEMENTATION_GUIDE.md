# Guide: "Living NPC" System Implementation Plan

This document outlines the phased implementation plan for the **"Living NPC"** and **"Plausibility & Suspicion"** systems. This feature is foundational to creating a dynamic and reactive world in Aralia RPG. Each phase builds upon the last, ensuring a stable and incremental development process.

This guide now reflects the complete implementation of the core "Living NPC" system. Future work can focus on expanding and refining these mechanics.

---

## Phase 1: Foundational Data Structures (The Skeleton)

**Goal:** Enrich the core data structures for NPCs to include personality, roles, and a framework for memory.

-   [x] **Update Core Types (`src/types.ts`)**
    -   [x] Expand the `NPC` interface to include:
        -   `initialPersonalityPrompt: string;`
        -   `role: 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';`
        -   `faction?: string;`
    -   [x] Add the `npcMemory` slice to the global `GameState` interface:
        ```typescript
        npcMemory: Record<string, { // Keyed by NPC ID
          disposition: number; // -100 (Hated) to 100 (Adored)
          knownFacts: string[]; // An array of short, factual strings
        }>;
        ```

-   [x] **Update Static NPC Data (`src/data/world/npcs.ts`)**
    -   [x] Iterate through each existing NPC in the `NPCS` object.
    -   [x] Add the new `initialPersonalityPrompt` and `role` fields to every NPC definition to conform to the updated `NPC` type.

---

## Phase 2: State Management for Memory (The Brain)

**Goal:** Integrate the new data structures into the game's state management system, allowing NPC memories to be created, updated, and persisted.

-   [x] **Update Initial Game State (`src/state/appState.ts`)**
    -   [x] In `initialGameState`, add the `npcMemory` property.
    -   [x] Initialize it by creating a default memory object (`{ disposition: 0, knownFacts: [] }`) for every NPC defined in `NPCS`.

-   [x] **Create New Reducer Logic (`src/state/reducers/npcReducer.ts`)**
    -   [x] Create a new slice reducer file: `src/state/reducers/npcReducer.ts`.
    -   [x] Define new action types in `src/state/actionTypes.ts`:
        -   `UPDATE_NPC_DISPOSITION` (payload: `{ npcId: string; amount: number; }`)
        -   `ADD_NPC_KNOWN_FACT` (payload: `{ npcId: string; fact: string; }`)
    -   [x] Implement the `npcReducer` function to handle these actions, immutably updating the `npcMemory` state slice.
    -   [x] Integrate the new `npcReducer` into the root reducer in `src/state/appState.ts`.

---

## Phase 3: Integrating Memory into AI Prompts (The Voice)

**Goal:** Connect the persistent memory state to the Gemini API, providing richer context for generating dynamic NPC responses.

-   [x] **Refactor NPC Interaction Handler (`src/hooks/actions/handleNpcInteraction.ts`)**
    -   [x] Inside the `handleTalk` function, retrieve the target NPC's memory from `gameState.npcMemory`.
    -   [x] Construct a "Memory Context" summary string to be included in the prompt (e.g., "You feel neutral towards this person (Disposition: 5). You know the following: [fact1, fact2]").
    -   [x] Modify the prompt sent to `GeminiService.generateNPCResponse` to include the NPC's `initialPersonalityPrompt` and the new "Memory Context" string.
    -   [x] After significant interactions (e.g., a successful persuasion, a threat), dispatch the `UPDATE_NPC_DISPOSITION` or `ADD_NPC_KNOWN_FACT` actions to update the NPC's memory.

---

## Phase 4: Connecting State to Game Mechanics (The Impact)

**Goal:** Make the memory system mechanically relevant by having it influence other game systems.

-   [x] **Update Skill Check Logic (`src/hooks/actions/handleGeminiCustom.ts`)**
    -   [x] When a Gemini-suggested action is a social skill check (contains `check` and `targetNpcId` payload), retrieve the target NPC's `disposition`.
    -   [x] Implemented a system to calculate a Difficulty Class (DC) modifier based on the `disposition` score.
    -   [x] Implemented logic to perform the skill check (d20 + mods vs DC).
    -   [x] Created a new `geminiService.generateSocialCheckOutcome` to get narrative results and disposition changes from the AI based on success/failure.
    -   [x] Applied the outcome by dispatching `UPDATE_NPC_DISPOSITION` and adding a new message.

---

## Phase 5: Implementing the "Suspicion" System (The Disguise Solution)

**Goal:** Build the "Plausibility & Suspicion" system on top of the disposition framework to handle actions like `Disguise Self`.

-   [x] **Add New Types and State**
    -   [x] In `src/types.ts`, define an enum: `export enum SuspicionLevel { Unaware, Suspicious, Alert }`.
    -   [x] Add `suspicion: SuspicionLevel;` to the `npcMemory` object structure in `GameState`.
    -   [x] In `src/state/appState.ts`, initialize `suspicion: SuspicionLevel.Unaware` for all NPCs in `initialGameState`.

-   [x] **Implement Plausibility Logic (`src/utils/socialUtils.ts`)**
    -   [x] Create a new utility file: `src/utils/socialUtils.ts`.
    -   [x] Implement the `assessPlausibility(action, character, npcMemory)` function. This function factors in `disposition` and `suspicion` to return a DC modifier for social checks.

-   [x] **Update Deception-Based Action Handlers**
    -   [x] The `handleGeminiCustom` handler now uses `assessPlausibility` when calculating the DC for social checks.
    -   [x] Failing certain social checks now dispatches `UPDATE_NPC_SUSPICION` to increase the NPC's suspicion level.

---

## Phase 6: Adding Goals & Motivations (The Purpose)

**Goal:** Give NPCs proactive motivations that the player can discover and influence, creating long-term social gameplay loops.

-   [x] **Update Data Structures (`src/types.ts`, `src/data/world/npcs.ts`)**
    -   [x] Defined `Goal` interface and `GoalStatus` enum in `src/types.ts`.
    -   [x] Added a `goals: Goal[]` array to the `NpcMemory` interface in `GameState`.
    -   [x] Added initial goal definitions to the static NPC data in `npcs.ts`.

-   [x] **Update State Management (`src/state/appState.ts`, `src/state/reducers/npcReducer.ts`)**
    -   [x] The `initialGameState` now populates the `goals` in `npcMemory` from the static NPC data.
    -   [x] Added the `UPDATE_NPC_GOAL_STATUS` action to `actionTypes.ts` and implemented its logic in `npcReducer.ts`.

-   [x] **Integrate Goals into AI Context and Outcomes**
    -   [x] `handleNpcInteraction.ts`: The `handleTalk` function now includes the NPC's active goals in the context sent to Gemini.
    -   [x] `geminiService.ts`: `generateActionOutcome` (and by extension, the social check and Oracle functions) are now prompted to return a structured JSON object that can include a `goalUpdate` payload.
    -   [x] `handleGeminiCustom.ts` & `handleOracle.ts`: These action handlers now parse the structured response from Gemini and, if a `goalUpdate` is present, dispatch the `UPDATE_NPC_GOAL_STATUS` action along with a significant disposition change and a new known fact.

-   [x] **Enhance UI (`src/components/LogbookPane.tsx`)**
    -   [x] The Character Logbook now includes a "Known Goals" section, displaying each of an NPC's goals and their current status (`Active`, `Completed`, `Failed`). This makes the system's progress visible to the player.
    
---

## Phase 7: Implementing the "Gossip" System (The Social Web)

**Goal:** Make the world feel interconnected by allowing NPCs to share information about the player's actions with each other, causing the player's reputation to precede them.

-   [x] **Enhance Data Structures**: The `knownFacts` string array has been converted to an array of `KnownFact` objects to track metadata like the source of the information (direct vs. gossip) and whether it's public. Save game migration is in place.
-   [x] **Create Gossip Event Handler**: A new, performance-conscious event handler (`handleGossipEvent`) simulates the spread of public information between NPCs. This event is triggered during a Long Rest and uses batched state updates for efficiency.
-   [x] **Integrate and Update**: The system is triggered by player rests. The AI dialogue prompts (`handleNpcInteraction.ts`) and the player's Logbook (`LogbookPane.tsx`) have been updated to reflect this new, second-hand information.
-   [x] **Implement Player Agency & UI**: The AI has been prompted to suggest custom actions that allow the player to interact with rumors they hear. The `handleGeminiCustom` handler can process these new social checks, and the Logbook UI makes the system's effects transparent.
-   [x] **Decouple Configuration**: All tuning parameters for the gossip and memory systems (e.g., `MAX_GOSSIP_EXCHANGES_PER_LOCATION`, `MAX_FACTS_PER_NPC`) have been moved from `handleWorldEvents.ts` to the new **`src/config/npcBehaviorConfig.ts`** file, allowing for easy adjustment of the social simulation's behavior.
