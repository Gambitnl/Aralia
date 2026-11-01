# 10. Dungeon caches use fixed source identities and settle rewards once

Date: 2026-10-28

## Status

Proposed. The implementation candidate passes focused checks. Live cache collection and the complete expedition story remain unverified.

## Context

Alrio's source plan contains three treasure rooms but no chest or loose-coin props. The existing preview treats any reachable floor in a treasure room as a claim point. Its callback saves a claimed ID without inventory contents. That cannot establish an earned reward.

## Decision

Complete the existing treasure-room intent through the canonical dungeon source, not a convenient runtime placement.

- Reuse an existing chest in the room when present. Otherwise derive a cache on the real floor nearest the room's center. A wholly collapsed room remains buried; its reward does not move to another room.
- Preserve the existing `treasure.v1` room ID. Existing props keep their indices. New cache interactions use a room-specific `object.v1` ID.
- Generate contents from the independent `cache:v1:room:<id>` child seed path. The v1 cache contains two through eight standard gold pieces. This draw is frozen and does not depend on the current party or consume geometry, history, or encounter RNG. The contract fixture for world 42, cell 751, dungeon m28, room 17 yields six pieces.
- A recorded plunder or pried-vault trace leaves the cache empty. There is no automatic restock or fresh food in an ancient cache.
- Require observed floor, adjacent accepted footing, and examination. Unresolved room occupants, traps, or water block collection. Unsupported hazard handling cannot be replaced by a progress button.
- The world owner regenerates the canonical source and checks every item template before changing anything. It records the claim and real inventory instances together. Replay, reload, and revisit cannot award another copy. The purse does not change when physical coins enter inventory.
- Render new caches only after their floor has been observed. Keep the container in place and show its opened state after collection. Production expeditions do not expose the preview's manual progress simulators.

## Consequences

The source grid, existing props, doors, history, inhabitants, and encounter identities remain intact. Cache meshes are an explicit addition to unfinished treasure-room gameplay. Examination does not grant XP, a combat clear, or dungeon completion.

Legacy claimed IDs do not receive invented compensating rewards. Future changes to the frozen v1 stream require a versioned migration that preserves both collected and uncollected source contents. Trap resolution, safe water access, stealth, broader cache contents, and complete expedition acceptance remain separate work.
