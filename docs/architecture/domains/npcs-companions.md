# NPCs / Companions

## Purpose

This domain covers the companion, NPC, dialogue, and relationship-management surfaces that drive party commentary, NPC state, generated dialogue topics, and character-facing social systems.
The current repo shape spans data, reducers, systems, hooks, services, and UI entry surfaces rather than one single companion module.

## Verified Entry Points

- src/data/companions.ts
- src/systems/companions/
- src/state/reducers/npcReducer.ts
- src/state/reducers/companionReducer.ts
- src/state/reducers/dialogueReducer.ts
- src/hooks/useCompanionCommentary.ts
- src/services/dialogueService.ts

## Current Shape

### Companion systems lane

This pass verified the current companion-system subtree under src/systems/companions/, including:

- BanterManager.ts
- CompanionReactionSystem.ts
- RelationshipManager.ts
- the current companion test suite under src/systems/companions/__tests__/

### Commentary and dialogue lane

This pass verified:

- src/hooks/useCompanionCommentary.ts
- src/services/dialogueService.ts
- src/services/EntityResolverService.ts
- src/services/CharacterAssetService.ts

The live commentary hook is still a meaningful domain entry point, but it is only one part of the larger NPC and dialogue lane.

### Data and typing lane

This pass verified:

- src/data/companions.ts
- src/data/banter.ts
- src/data/world/
- src/data/villagePersonalityProfiles.ts
- src/types/companions.ts
- src/types/companion.ts
- src/types/dialogue.ts
- src/types/memory.ts

## Important Corrections

- The old doc treated the domain as a mostly flat ownership inventory. The current repo has a real companion systems subtree and a broader supporting dialogue and entity-resolution lane.
- Organization-service and faction utility paths may intersect with NPC systems, but they should not be treated as core companion ownership just because they appear nearby in social gameplay.
- This doc should describe verified NPC and companion infrastructure without pretending that every social, faction, religion, or settlement helper belongs entirely to this domain.

## Tests Verified In This Pass

- src/systems/companions/__tests__/BanterManager.test.ts
- src/systems/companions/__tests__/CompanionReactionSystem.test.ts
- src/systems/companions/__tests__/CompanionSystem.test.ts
- src/systems/companions/__tests__/RelationshipManager.test.ts
- src/services/__tests__/dialogueService.test.ts
- src/services/__tests__/EntityResolverService.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the NPC plus companion plus dialogue lane: companion systems, NPC state, dialogue topic logic, and the supporting data and entity-resolution surfaces that keep those interactions coherent.
