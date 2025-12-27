# Recorder Worklog

### 2025-12-25 - Recorder Kickoff
**Learning:** Initialized Recorder persona. Uplink tools are missing in this environment, falling back to local file work.
**Action:** Initialized `HistoryService.ts` (Service for creating standardized history events) and its tests.

## 2024-05-23 - Structured Memory System
**Learning:** Implemented a structured `NPCMemory` system with `Interaction` (ID, significance, witnesses) and `Fact` (confidence, source).
**Action:** Added `src/utils/memoryUtils.ts` with `addInteraction`, `decayMemories`, and `getRelevantMemories`.
**Action:** Left TODO in `src/types/companions.ts` to migrate legacy approval systems to this new structure.

## TODO: Item Provenance System (Design)
**Goal:** Implement a system to track the history and "life" of items, adhering to the philosophy "If they don't remember, it didn't happen."

**1. Data Types (`src/types/provenance.ts`)**
- `ProvenanceEventType`: Enum of events (CRAFTED, FOUND, STOLEN, SOLD, USED_IN_COMBAT, ENCHANTED, DAMAGED, REPAIRED, GIFTED).
- `ProvenanceEvent`:
  - `date`: GameDate (number).
  - `type`: ProvenanceEventType.
  - `description`: string.
  - `actorId?`: string (Entity ID).
  - `locationId?`: string.
- `ItemProvenance`:
  - `creator`: string.
  - `createdDate`: GameDate.
  - `originalName?`: string.
  - `previousOwners`: string[].
  - `history`: ProvenanceEvent[].

**2. Integration (`src/types/items.ts`)**
- Update `Item` interface to include optional `provenance?: ItemProvenance`.

**3. Utility Logic (`src/utils/provenanceUtils.ts`)**
- `createProvenance(creator, date)`: Initialize new history.
- `addProvenanceEvent(item, type, desc, date, actorId)`: Immutable update adding an event.
- `generateLegendaryHistory(item, date)`: Procedural generation for "found" rare items to give them backstory (e.g., forged 100 years ago, lost in battle).

**4. Service Integration**
- **Loot Generation (`src/services/lootService.ts`)**: When generating Rare/Legendary items, call `generateLegendaryHistory` so they aren't "born yesterday."
- **Crafting**: When players craft items, initialize provenance with `createProvenance`.
- **Combat/Events**: When significant events occur (killing a boss with a weapon), append a `USED_IN_COMBAT` event to the weapon.

**5. Testing**
- Unit tests in `src/utils/__tests__/provenanceUtils.test.ts` to verify immutable updates and history generation.
### 2025-12-26 - Recorder Initialization
**Learning:** Initialized Recorder persona. Read directives and protocols.
**Action:** Proceeding with memory gap discovery.
### 2025-12-26 - World History Framework
**Learning:** The World History system was defined in types but completely disconnected from the state and event loop.
**Action:** Initialized `worldHistory` in `GameState`, added `ADD_WORLD_HISTORY_EVENT` action and reducer, and flagged the `WorldEventManager` for integration.
### 2025-12-26 - Recorder Implementation
**Learning:** Initialized the "World History Framework" in state.
**Action:** Created `ADD_WORLD_HISTORY_EVENT` and integrated it into the world reducer. The next step is to hook it up to the event manager.
### 2025-12-26 - NPC Memory Integration
**Learning:** Centralizing memory formatting in utils prevents duplicate logic and ensures consistent AI context.
**Action:** Applied formatMemoryForAI to geminiService.
