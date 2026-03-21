# Noble House Generation

This capability note tracks the current noble-house generation and intrigue foundations. The repo already contains seeded house generation, identity composition, and intrigue-event generation against noble-house factions.

## Current Status

Noble-house support is implemented as a foundation capability. It is not just a placeholder concept, though higher-level UI and world-surface integration remain broader questions.

## Verified Repo Surfaces

- src/types/noble.ts
- src/utils/world/nobleHouseGenerator.ts
- src/systems/world/NobleIntrigueManager.ts

## Verified Capabilities

### Noble House Seeded Variation

- nobleHouseGenerator.ts generates family names, mottos, heraldry, seats, origins, specialties, members, and secrets from a seeded random source.
- The generator includes explicit seed-driven branching rather than returning one static house template.

### Noble House Identity Composition

- noble.ts defines a NobleHouse type with heraldry, seat, origin, specialty, motto, wealth, military power, political influence, members, and secrets.
- The generator composes those fields into a coherent house record instead of a bare faction stub.

### Noble Intrigue Event Generation

- NobleIntrigueManager.ts generates intrigue events between factions whose type is NOBLE_HOUSE.
- The intrigue path already handles alliance proposals, scandal exposure, power plays, diplomatic insults, relationship updates, and rumor output.

## Remaining Gaps Or Uncertainty

- This doc no longer treats noble-house generation as missing from the repo, because the generator and intrigue manager are already present.
- This pass verified the data and systems layers, not a dedicated player-facing noble-house UI or a complete campaign-facing intrigue loop.
