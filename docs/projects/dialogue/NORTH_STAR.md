# Dialogue North Star

Status: active  
Last updated: 2026-06-05

## Purpose
Preserve dialogue project continuity for future workers by documenting the implemented topic-based dialogue system, how it is wired into game state and UI, and where gaps remain.

## Why this exists
The feature is already partially implemented as an NPC conversation modal and topic engine. The project is in a **discovery-preserving** stage: keep current behavior and avoid flattening unfinished intent.

## Dashboard Card Schema

Project: Dialogue
Slug: dialogue
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/dialogue
Gap signal: 5 open gaps; DIAL-001 is adjacent and DIAL-002 through DIAL-005 are active follow-up work
Protocol: living project doc set
Next step: Resume from TRACKER D2 and keep the gap log aligned with the current runtime questions.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Current system summary
- Dialogue is implemented as topic-based interactions, not a linear scripted node graph.
- Topics include prerequisites, costs, one-time behavior, social skill checks, unlocks, disposition effects, and unlock-side rewards.
- The player can open a dialogue session with NPCs from action handlers and town interactions, then select topics from `DialogueInterface`.
- Session side effects dispatch to Redux flow (`DISCUSS_TOPIC`, `GRANT_EXPERIENCE`, `UPDATE_NPC_DISPOSITION`, `MODIFY_GOLD`, `REMOVE_ITEM`) and persist memory timestamps.
- Separate companion chat exists in `src/components/ConversationPanel` and `src/hooks/useConversation.ts`; this is a different flow from Dialogue.

## Concrete file map
- Data and types
  - `src/types/dialogue.ts`  
  - `src/data/dialogue/topics.ts`  
  - `src/types/index.ts`  
  - `src/types/state.ts`
- Service and logic
  - `src/services/dialogueService.ts`  
  - `src/services/__tests__/dialogueService.test.ts`
- UI and orchestration
  - `src/components/Dialogue/DialogueInterface.tsx`  
  - `src/hooks/useDialogueSystem.ts`  
  - `src/components/layout/GameModals.tsx`
- Action and reducer integration
  - `src/state/actionTypes.ts`  
  - `src/hooks/actions/actionHandlers.ts`  
  - `src/hooks/actions/handleNpcInteraction.ts`  
  - `src/state/reducers/dialogueReducer.ts`  
  - `src/state/reducers/npcReducer.ts`  
  - `src/state/reducers/conversationReducer.ts`  
  - `src/state/initialState.ts`  
  - `src/state/appState.ts`  
  - `src/state/reducers/__tests__/npcReducer.test.ts`
- Runtime entry points
  - `src/components/Town/TownCanvas.tsx`
  - `src/components/layout/GameModals.tsx`

## Implemented state and flow
- `START_DIALOGUE_SESSION` creates a new `DialogueSession` and opens the modal.
- `UPDATE_DIALOGUE_SESSION` keeps session topic state in app state.
- `END_DIALOGUE_SESSION` closes the modal and clears session data.
- `DISCUSS_TOPIC` updates session history and `npcMemory.discussedTopics[npcId][topicId]` in `npcReducer`.
- Service filter flow: `getAvailableTopics` uses static topics + dynamic rumor topics, then prerequisite and NPC knowledge checks.
- `processTopicSelection` applies affordability checks, optional skill checks, unlocks, dispositions, lock flags, and deductions.
- Dynamic rumor topics are generated per interaction context but are not inserted into the static registry.
- Initial opening paths:
  - `handleTalk` and `handleStartDialogue` in `src/hooks/actions/handleNpcInteraction.ts`
  - NPC click in `src/components/Town/TownCanvas.tsx`
  - `GameModals` renders `DialogueInterface` when state flags are active.
- AI response generation is delegated to Ollama (`generateNPCResponse`) via `useDialogueSystem.generateResponse`.

## Integration points
- NPC identity data is sourced from `NPCS` constants and `gameState.generatedNpcs`.
- Knowledge checks depend on `GameState.npcMemory[npcId].disposition` and optional `NPC.knowledgeProfile.topicOverrides`.
- Costs and inventory checks rely on `gameState.inventory`, `gameState.gold`, and item stack counts.
- Load/new-game lifecycle resets or closes dialogue UI (`activeDialogueSession`, `isDialogueInterfaceOpen`) in `appState` and `initialState`.

## Existing gaps and uncertainties
- No node-level scripted dialogue language/tree is implemented yet.
- Cross-NPC topic propagation is only partially represented; TODO markers indicate future propagation work was expected in `useDialogueSystem`.
- `DialogueSession.sessionDispositionMod` and `availableTopicIds` are present in state but mostly passive in current runtime wiring.
- Topic unlocks are mostly session-scoped and logged locally; global durable unlock behavior is sparse.
- Companion chat remains a separate flow from Dialogue; the boundary is known in docs but not formalized as an ownership rule.

## Next checks for continuation
1. Verify whether dialogue outcomes should write shared/global unlock facts instead of session-only memory updates.
2. Decide whether to introduce a node/script representation and migration path from current topics.
3. Confirm how `DialogueSession.sessionDispositionMod` should affect response and availability logic.
4. Keep `dialogueService.test.ts` and `npcReducer.test.ts` as the base regression set when changing service/reducer behavior.
5. Preserve the Dialogue-versus-companion-chat boundary when routing new work or follow-up docs.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- register additional Dialogue gaps only when evidence supports them
- route any out-of-scope findings to `docs/projects/GLOBAL_GAPS.md`
- do not invent gaps just to satisfy a count
