# NPCs / Companions

## Purpose

This domain manages all non-player character systems including party companions, NPCs in the world, NPC interactions, dialogue, and companion-specific mechanics like loyalty and personal quests.

## Key Entry Points

| File | Role |
|------|------|
| `src/data/companions.ts` | Companion definitions |
| `src/systems/companions/` | Companion mechanics |
| `src/state/reducers/npcReducer.ts` | NPC state management |
| `src/hooks/useCompanionCommentary.ts` | Companion dialogue hook |

## Subcomponents

- **Companion System**: `src/systems/companions/` - Companion mechanics
- **NPC State**: `npcReducer.ts` - NPC tracking and state
- **Companion Commentary**: `useCompanionCommentary.ts` - Dynamic dialogue
- **Dialogue Service**: `dialogueService.ts` - AI-powered dialogue
- **Companion Factories**: `companionFactories.ts` - Companion generation

| Path | Type | Description |
|------|------|-------------|
| `src/systems/companions/*.ts` | Directory | Companion systems |
| `src/components/Dialogue/*.ts*` | Directory | Dialogue interface and index |
| `src/components/RelationshipsPane.tsx` | Component | Relationship tracking |
| `src/components/DossierPane.tsx` | Component | NPC dossiers |
| `src/components/Npc*.tsx` | Component | NPC testing and interaction |
| `src/data/world/*.ts` | Data | World NPCs and POIs |
| `src/data/world/npcs.ts` | Data | World NPC definitions |
| `src/data/world/locations.ts` | Data | World location definitions |
| `src/data/world/pois.ts` | Data | World points of interest |
| `src/data/companions.ts` | Data | Companion definitions |
| `src/data/banter.ts` | Data | Companion banter |
| `src/data/world/npcs.ts` | Data | World NPCs |
| `src/data/villagePersonalityProfiles.ts` | Data | NPC personalities |
| `src/state/reducers/npcReducer.ts` | Reducer | NPC state |
| `src/state/reducers/companionReducer.ts` | Reducer | Companion state |
| `src/state/reducers/dialogueReducer.ts` | Reducer | Dialogue state |
| `src/hooks/useCompanion*.ts` | Hook | Companion and commentary |
| `src/services/dialogueService.ts` | Service | Dialogue generation |
| `src/services/CharacterAssetService.ts` | Service | NPC visual assets |
| `src/services/EntityResolverService.ts` | Service | NPC entity resolution |
| `src/services/characterGenerator.ts` | Service | Character generation |
| `src/utils/companionFactories.ts` | Utils | Companion creation |
| `src/utils/memoryUtils.ts` | Utils | NPC memory helpers |
| `src/utils/socialUtils.ts` | Utils | Social interaction helpers |
| `src/utils/entityIntegrationUtils.ts` | Utils | Entity mapping helpers |
| `src/utils/settlementGeneration.ts` | Utils | Village/Town generation logic |
| `src/utils/religionUtils.ts` | Utils | Religion helpers |
| `src/utils/templeUtils.ts` | Utils | Temple interaction helpers |
| `src/types/companions.ts` | Types | Companion types |
| `src/types/dialogue.ts` | Types | Dialogue types |
| `src/types/memory.ts` | Types | NPC memory types |
| `src/components/NpcInteractionTestModal.tsx` | Component | NPC interaction testing |

## Dependencies

### Depends On

- **[Combat](./combat.md)**: Companion combat actions
- **[Character Sheet](./character-sheet.md)**: Companion stats display
- **AI Service**: Dialogue generation via Gemini

### Used By

- **[Town Map](./town-map.md)**: NPC placement in towns
- **[Submap](./submap.md)**: NPC encounters
- **[Combat](./combat.md)**: Companion combatants

## Boundaries / Constraints

- Companions should follow same rules as player characters
- NPC state should be serializable for save/load
- Dialogue generation should be cached where appropriate
- Companion loyalty affects dialogue and actions

## Open Questions / TODOs

- [ ] Document companion recruitment flow
- [ ] Clarify loyalty/approval mechanics
- [ ] Map NPC memory system

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/companions/__tests__/BanterManager.test.ts` | Banter management tests |
| `src/systems/companions/__tests__/CompanionReactionSystem.test.ts` | Companion reaction system tests |
| `src/systems/companions/__tests__/CompanionSystem.test.ts` | Companion system tests |
| `src/systems/companions/__tests__/RelationshipManager.test.ts` | Relationship management tests |
| `src/hooks/__tests__/useCompanionCommentary.test.ts` | Companion commentary hook tests |
| `src/services/__tests__/dialogueService.test.ts` | Dialogue service tests |
| `src/utils/__tests__/factionUtils.test.ts` | Faction utility tests |
| `src/utils/__tests__/nobleHouseGenerator.test.ts` | Noble house generation tests |
| `src/services/__tests__/organizationService.test.ts` | Organization service tests |
| `src/services/__tests__/EntityResolutionIntegration.test.ts` | Entity resolution integration tests |
| `src/services/__tests__/EntityResolverService.test.ts` | Entity resolver service tests |
