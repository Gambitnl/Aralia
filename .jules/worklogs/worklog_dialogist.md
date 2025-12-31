## 2025-12-31 - Dynamic Rumor Integration

**Context:** The `WorldRumor` system was disconnected from the Dialogue system. NPCs had active rumors in `gameState` but no way to discuss them.
**Options considered:**
- Option A: Add all rumors to `TOPIC_REGISTRY` at load time.
    - Trade-offs: Simple lookup, but causes memory leaks as rumors expire/generate. Registry grows indefinitely.
- Option B: Generate topics on-the-fly in `getAvailableTopics` and `processTopicSelection`.
    - Trade-offs: Requires dual lookup logic (Registry + Dynamic), but keeps memory clean and stateless.
**Chosen:** Option B.
**Rationale:** Keeps the registry as a source of truth for *authored* content while allowing procedurally generated content to be ephemeral. Prevents state pollution across save loads or long play sessions.

**Learning:** `WorldRumor.expiration` is in Game Days (integer), while `GameState.gameTime` is a `Date`. Always use `getGameDay(date)` helper from `timeUtils` to compare them.
