---
schema_version: 1
project: Memory System
slug: memory
category: Gameplay Systems
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: partial
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/memory
gap_signal: 4 open gaps (3 active, 1 in_progress)
protocol: living project doc set
next_step: Finish the remaining G4 action-to-memory branches after the social-check, first-contact, targeted prompt, and egregious witness-gossip recency stamps, unless the schema decision makes G1 the prerequisite.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Memory System North Star

Status: partial
Last updated: 2026-06-09
Owner: Worker A

## Dashboard Card Schema

Project: Memory System
Slug: memory
Category: Gameplay Systems
Status: partial
Confidence: medium
Evidence: docs/projects/memory
Gap signal: 4 open gaps (3 active, 1 in_progress)
Protocol: living project doc set
Next step: Resume G4 action-to-memory coverage unless the schema decision makes G1 the prerequisite; the first-contact, targeted prompt, and egregious witness-gossip branches now have coverage proofs.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

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
- `src/hooks/actions/handleNpcInteraction.ts`: first-contact met fact and interaction-recency update.
- `src/hooks/actions/handleGeminiCustom.ts`: social check outcome-to-memory, targeted prompt fact/recency updates, goal, suspicion, and disposition updates.
- `src/services/gemini/items.ts`: guide response formatting with memory context.
- `src/systems/memory/MemorySystem.ts` + `src/systems/memory/__tests__/MemorySystem.test.ts`: parallel memory lane currently not in gameplay wiring.
- `src/utils/world/memoryUtils.ts`: world-level memory helpers (`createEmptyMemory`, `formatMemoryForAI`, decay helpers).
- `src/utils/memoryUtils.ts`: deprecated bridge exporting legacy memory helpers.

## Implemented state (observed)
- `npcMemory` is initialized for every static NPC with disposition, facts, suspicion, goals, and placeholders for interaction history/discussion state.
- Gameplay actions now drive memory changes through `UPDATE_NPC_DISPOSITION`, `ADD_NPC_KNOWN_FACT`, `UPDATE_NPC_GOAL_STATUS`, `PROCESS_GOSSIP_UPDATES`, `UPDATE_NPC_INTERACTION_TIMESTAMP`, and `REGISTER_GENERATED_NPC`.
- First contact with a generated NPC now also stamps `UPDATE_NPC_INTERACTION_TIMESTAMP`, so the meeting itself counts as a fresh memory touch instead of only the later dialogue flow.
- Direct social-check outcomes now also stamp `UPDATE_NPC_INTERACTION_TIMESTAMP`, so the long-rest drift logic sees them as recent interactions instead of only treating talk flow as recency-bearing.
- Targeted custom prompt outcomes that attach to an NPC now also stamp `UPDATE_NPC_INTERACTION_TIMESTAMP` when they write a direct fact, so they follow the same recency rule as other direct social touchpoints.
- Egregious custom prompt outcomes now also refresh witness interaction timestamps after gossip lands, so the NPCs who just heard about the event are treated as recently involved.
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

## Action-to-memory coverage matrix

| Producer path | Memory actions written | Status | Notes |
|---|---|---|---|
| `handleNpcInteraction.ts` talk flow | `ADD_NPC_KNOWN_FACT`, `UPDATE_NPC_INTERACTION_TIMESTAMP`, `UPDATE_NPC_DISPOSITION`, `START_DIALOGUE_SESSION`, `DISCUSS_TOPIC` | covered | This is the richest direct interaction lane and still owns the dialogue-session recency update. |
| `handleNpcInteraction.ts` first-contact flow | `ADD_NPC_KNOWN_FACT`, `ADD_MET_NPC`, `UPDATE_NPC_INTERACTION_TIMESTAMP`, `START_DIALOGUE_SESSION` | covered | Meeting a new NPC now counts as a fresh memory touch, so the new met fact and interaction clock stay in sync before the dialogue session opens. |
| `handleGeminiCustom.ts` social check flow | `UPDATE_NPC_DISPOSITION`, `ADD_NPC_KNOWN_FACT`, `UPDATE_NPC_GOAL_STATUS`, `UPDATE_NPC_SUSPICION`, `UPDATE_NPC_INTERACTION_TIMESTAMP` | covered | The social-check branch now stamps recency and keeps the direct fact trail aligned with talk flow. |
| `handleGeminiCustom.ts` targeted custom prompt flow | `ADD_NPC_KNOWN_FACT`, `UPDATE_NPC_INTERACTION_TIMESTAMP` | covered | Only runs when the prompt names a target NPC; the prompt outcome is treated as a fresh direct memory touch, not just loose text output. |
| `handleGeminiCustom.ts` egregious witness-gossip flow | `PROCESS_GOSSIP_UPDATES`, `UPDATE_NPC_INTERACTION_TIMESTAMP` | covered | Egregious custom prompts now refresh witness recency after gossip lands, so the NPCs who just learned about the event do not age out as stale immediately. |
| `handleMovement.ts` world-crossing gossip trigger | `PROCESS_GOSSIP_UPDATES` | covered | Movement itself does not mutate NPC memory directly; it hands off to the world gossip lane. |
| `handleWorldEvents.ts` gossip / residue / rest maintenance | `PROCESS_GOSSIP_UPDATES`, `ADD_NPC_KNOWN_FACT`, `BATCH_UPDATE_NPC_MEMORY` | covered | This is the batch maintenance lane for gossip spread, residue discovery, and long-rest decay. |
| `npcReducer.ts` direct state mutations | all of the above reducer actions plus `REGISTER_GENERATED_NPC` and `DISCUSS_TOPIC` | covered | The reducer remains the sole runtime state owner for NPC memory writes. |

## Gaps and uncertainties
- Dual memory schemas are active: `NpcMemory` and `NPCMemory` are both present, and several callsites use one while reducer/type expectations use the other.
- `src/systems/memory/MemorySystem.ts` is an orphan utility lane not invoked by `handleWorldEvents`, `handleNpcInteraction`, or rest/movement flows.
- `formatMemoryForAI` now uses the canonical world helper in active code; the deprecated bridge remains only for legacy imports that still need a compatibility path.
- Not all social-producing action paths are confirmed to emit memory actions (combat, some custom prompt branches without a target, and legacy ritual or spell branches).
- Serialization and migration checks exist only for `KnownFact` string-array conversion; other schema drift risks are unresolved.

## Next checks
1. Confirm one canonical memory model for gameplay and AI contexts, then update remaining TODOs around `NpcMemory | NPCMemory` unions.
2. Keep expanding the action-to-memory matrix until the remaining custom-without-target, combat, and ritual branches are either covered or moved behind a documented prerequisite.
3. Decide migration boundary for legacy fields and persist this in `docs/projects/memory/GAPS.md` before extending serialization.
4. Keep the deprecated memory wrapper fenced so future callsites do not drift back to the bridge.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
