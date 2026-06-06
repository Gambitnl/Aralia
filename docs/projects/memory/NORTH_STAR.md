# Memory System North Star

Status: partial
Last updated: 2026-06-05
Owner: Worker A

## Dashboard Card Schema

Project: Memory System
Slug: memory
Category: Gameplay Systems
Status: partial
Confidence: medium
Evidence: docs/projects/memory
Gap signal: 5 open gaps (3 active, 2 in_progress)
Protocol: living project doc set
Next step: Resume G5 unless the schema decision makes G1 the prerequisite.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Why this project exists
The Memory System is the live social state layer behind NPC interaction, suspicion, gossip, and goal effects. This project owns the cold-start context for what is implemented today and what is still unresolved.

## In-scope
- NPC memory model ownership in runtime state.
- Memory mutation and action dispatch paths.
- World-side memory evolution (gossip, residue, rest effects).
- AI memory context usage in dialogue and social outcomes.
- Save/load and migration behavior tied to memory fields.

## Out of scope
- Combat outcome semantics (unless they already emit memory actions).
- Full schema redesign of the broader social/relationship architecture.
- New systems outside existing action/reducer surfaces.

## Concrete implementation file map
- `src/types/world.ts`: `NpcMemory` shape for `GameState.npcMemory` and `REGISTER_GENERATED_NPC` payloads.
- `src/types/memory.ts`: alternate `NPCMemory` model with `attitude`, `lastInteractionDate`, and `discussedTopics`.
- `src/state/initialState.ts`: static NPC memory initialization for all `NPCS`.
- `src/state/appState.ts`: startup/load paths and migration of legacy `knownFacts` string arrays.
- `src/state/actionTypes.ts`: declared memory action contracts.
- `src/state/reducers/npcReducer.ts`: core state mutation for memory actions.
- `src/hooks/actions/handleWorldEvents.ts`: gossip spread, residue checks, long-rest maintenance.
- `src/hooks/actions/handleResourceActions.ts`: long-rest orchestration and batched memory updates.
- `src/hooks/actions/handleMovement.ts`: travel-boundary gossip trigger.
- `src/hooks/actions/handleNpcInteraction.ts`: talk flow memory reads/writes.
- `src/hooks/actions/handleGeminiCustom.ts`: social check outcome-to-memory, goal, suspicion, and disposition updates.
- `src/services/gemini/items.ts`: guide response formatting with memory context.
- `src/systems/memory/MemorySystem.ts` + `src/systems/memory/__tests__/MemorySystem.test.ts`: parallel memory lane currently not in gameplay wiring.
- `src/utils/world/memoryUtils.ts`: world-level memory helpers (`createEmptyMemory`, `formatMemoryForAI`, decay helpers).
- `src/utils/memoryUtils.ts`: deprecated bridge exporting legacy memory helpers.

## Implemented state (observed)
- `npcMemory` is initialized for every static NPC with disposition, facts, suspicion, goals, and placeholders for interaction history/discussion state.
- Gameplay actions now drive memory changes through `UPDATE_NPC_DISPOSITION`, `ADD_NPC_KNOWN_FACT`, `UPDATE_NPC_GOAL_STATUS`, `PROCESS_GOSSIP_UPDATES`, `UPDATE_NPC_INTERACTION_TIMESTAMP`, and `REGISTER_GENERATED_NPC`.
- Long rest calls `handleLongRestWorldEvents`, dispatches `BATCH_UPDATE_NPC_MEMORY`, then triggers gossip propagation.
- Map and world movement into a new world tile can trigger gossip, and this flow runs before location transition in those cases.
- Location residue discoveries create direct facts and can be consumed into NPC knowledge via add-fact actions.
- NPCs track `discussedTopics` in reducer state when dialogue topics complete.
- Unknown older saves containing string arrays for `knownFacts` are converted in load flow.

## Integration points
- Root reducer delegates all memory mutations to `npcReducer.ts`.
- AI interaction path reads memory in:
  - `handleNpcInteraction.ts` (`handleTalk` -> `generateNPCResponse` prompt context),
  - `handleGeminiCustom.ts` (`generateSocialCheckOutcome` input),
  - `services/gemini/items.ts` (`formatMemoryForAI` usage).
- Save/load boundary is in `appState.ts` and currently only partially normalizes historical fact shapes.

## Gaps and uncertainties
- Dual memory schemas are active: `NpcMemory` and `NPCMemory` are both present, and several callsites use one while reducer/type expectations use the other.
- `src/systems/memory/MemorySystem.ts` is an orphan utility lane not invoked by `handleWorldEvents`, `handleNpcInteraction`, or rest/movement flows.
- `formatMemoryForAI` context currently comes through a deprecated utility path, not a single coherent active import chain.
- Not all social-producing action paths are confirmed to emit memory actions (combat, certain custom actions, and legacy spell branches).
- Serialization and migration checks exist only for `KnownFact` string-array conversion; other schema drift risks are unresolved.

## Next checks
1. Confirm one canonical memory model for gameplay and AI contexts, then update remaining TODOs around `NpcMemory | NPCMemory` unions.
2. Add an explicit memory event matrix for action producers (talk, movement, custom, combat, travel, spell) against reducer actions.
3. Decide migration boundary for legacy fields and persist this in `docs/projects/memory/GAPS.md` before extending serialization.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
