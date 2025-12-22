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
| `src/data/companions.ts` | Data | Companion definitions |
| `src/state/reducers/npcReducer.ts` | Reducer | NPC state |
| `src/state/reducers/companionReducer.ts` | Reducer | Companion state |
| `src/hooks/useCompanion*.ts` | Hook | Companion and commentary |
| `src/services/dialogueService.ts` | Service | Dialogue generation |
| `src/utils/companionFactories.ts` | Utils | Companion creation |
| `src/types/companions.ts` | Types | Companion types |
| `src/types/dialogue.ts` | Types | Dialogue types |
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
| `src/systems/companions/__tests__/BanterManager.test.ts` | Unit test |
| `src/systems/companions/__tests__/CompanionReactionSystem.test.ts` | Unit test |
| `src/systems/companions/__tests__/CompanionSystem.test.ts` | Unit test |
| `src/systems/companions/__tests__/RelationshipManager.test.ts` | Unit test |
