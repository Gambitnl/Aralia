# Recorder's Worklog

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
