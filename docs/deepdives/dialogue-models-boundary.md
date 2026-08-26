# Dialogue models boundary: Topic registry, Graph DAG, LLM chat

Deepdive for board task `agora-7ba5`. Campaign `agora-f821`.
Plan Map topic: `dialogue` (`public/planmap/topics.json`), features DIAL-003 and DIAL-005.
Spec: `docs/superpowers/specs/2026-07-14-absorbed-dialogue.md`.
Written 2026-09-20. Every claim below is verified against the code in the worktree on that day.

---

## 1. Verdict

The three dialogue models do not transition into one another. They are three
separate lanes that share only the `NpcMemory` store, and only in one direction.
The Topic lane (`dialogueService`) and the LLM chat lane (`ConversationPanel`)
both run in production, but they open from different actions, hold different
session state, and neither can hand a conversation to the other. The Graph DAG
lane (`dialogueGraphRuntime`) has no production caller at all: `GameModals.tsx`
renders `DialogueInterface` without `dialogueGraph`, `dialogueGraphId`,
`graphContext` or `onGraphEffects`, so no shipped conversation can walk a graph.
NPC knowledge does not propagate between the lanes: the Topic lane writes
`WorldFact` unlocks that only the Topic lane reads, the chat lane writes ad-hoc
`KnownFact` records that no dialogue prompt reads, and all four
"dialogue context" builders that exist to carry NPC knowledge into a prompt
(`describeKnowledgeProfile`, `buildRumorDialogueContext`,
`buildWitnessDialogueContext`, `buildPropagatedFactDialogueContext`) are inert or
unwired. The Topic lane is also empty of content: the registry holds four global
topics, no topic declares `unlocksTopics`, `skillCheck` or `prerequisites` of
type `topic_known`, and no NPC in the game declares a `knowledgeProfile`.

---

## 2. Inventory

### 2.1 `src/services/dialogueService.ts` - 528 lines

The Topic registry and its rules. It holds a module-level `TOPIC_REGISTRY`
seeded from `INITIAL_TOPICS` (`:34-39`), checks player prerequisites
(`:52-131`), checks cost (`:136-160`), checks NPC willingness (`:167-210`),
converts world rumors into dynamic topics (`:212-294`), filters the visible
topic list (`:299-343`), resolves a selected topic into a
`ProcessTopicResult` (`:364-467`), and serializes an NPC knowledge profile into
a prompt fragment (`:485-527`).

Callers (grep, non-test):
- `src/components/Dialogue/DialogueInterface.tsx:20-24` imports
  `getAvailableTopics`, `processTopicSelection`, `ProcessTopicResult`.
- `src/hooks/useDialogueSystem.ts:33` imports `ProcessTopicResult` and
  `describeKnowledgeProfile`.
- `src/components/Dialogue/DialogueConversationView.tsx:31` imports the
  `ProcessTopicResult` type only.
- `src/systems/puzzles/dialogueBridge.ts:54` imports the `ProcessTopicResult`
  type only.

`registerTopic` (`:41`) has no caller anywhere in `src/` (grep
`registerTopic` returns only the declaration).

### 2.2 `src/systems/dialogue/dialogueGraphRuntime.ts` - 276 lines

Pure playback rules for an authored dialogue graph (DIAL-001). Condition
evaluation (`:46-105`), available-choice filtering (`:108-116`), effect
resolution into outcomes (`:122-167`), effect application into a new context
(`:178-213`), node lookup and terminal test (`:219-236`), and the linear
`next`-spine walk (`:247-276`). It touches no `GameState` and dispatches
nothing, by design.

Callers (grep, non-test): `src/components/Dialogue/DialogueInterface.tsx:26-30`
only. That component is mounted only by
`src/components/layout/GameModals.tsx:689-700`, which passes no graph prop, so
the runtime is unreachable in play. Its sibling `dialogueGraphLoader.ts` and the
three authored graphs under `public/data/dialogue/` (`quest-giver.json`,
`merchant-haggling.json`, `guard-interrogation.json`) have the same status:
loaded by tests, never mounted.

### 2.3 `src/systems/memory/actionMemoryMatrix.ts` - 709 lines

The action-to-NPC-memory router (`agora-1024`). Nineteen action rows
(`:196-424`), a category map (`:426-446`), key normalization and lookup
(`:452-478`), fact/witness/marker builders (`:480-590`), a pure resolver
(`:596`), an immutable apply (`:618`), and dispatch-shaped builders
(`:651`, `:690`).

Callers: none in production. Grep for every exported symbol
(`ACTION_MEMORY_MATRIX`, `ACTION_CATEGORIES`, `resolveMemoryEffect`,
`resolveActionMemory`, `applyActionMemory`, `hasMemoryEffect`,
`buildActionMemoryDispatches`, `buildActionMemoryDispatchesForObservers`,
`actionContextFromGameState`) across `src/`, `tools/` and `misc/` returns only
`src/systems/memory/__tests__/actionMemoryMatrix.test.ts` and one comment
reference in `src/systems/npcPersonality/personalityEffects.ts:41`.

### 2.4 `src/components/ConversationPanel/ConversationPanel.tsx` - 643 lines

The LLM chat panel. It reads every player line through the universal intent
reader (`:367`), routes `talk` straight to prose (`:370`), routes `skill` through
a pre-roll buff offer then a dice roll (`:189-231`, `:157`), routes `attack`
into combat (`:157-171`), and renders the transcript, suggested replies, the
mention menu and the Attack button.

Callers: `src/App.tsx:136` (import) and `src/App.tsx:2488` (mount), plus the
panel's own tests. It is
driven by `src/hooks/useConversation.ts` (`:43`), which owns
`startConversation`, `sendPlayerMessage` and `endConversation`.

### 2.5 Supporting files read for the trace

| File | Lines | Role in the boundary |
| --- | --- | --- |
| `src/components/Dialogue/DialogueInterface.tsx` | 329 | The only place Topic and Graph lanes meet. Picks one by `isGraphMode` (`:294`). |
| `src/hooks/useDialogueSystem.ts` | 239 | Topic-lane prompt builder and outcome dispatcher. |
| `src/hooks/useConversation.ts` | 442 | Chat-lane prompt builder and memory writer. |
| `src/systems/facts/worldFactStore.ts` | 107 | Durable world-fact store behind topic unlocks. |
| `src/systems/dialogue/unlockRegistry.ts` | 382 | Graph-to-worldFacts bridge (DIAL-004). |
| `src/systems/memory/factPropagation.ts` | 337 | Cross-NPC fact spread (DIAL-002). |
| `src/state/reducers/dialogueReducer.ts` | 52 | Session lifecycle only. |
| `src/data/dialogue/topics.ts` | 47 | The whole authored topic corpus: four topics. |

---

## 3. Findings

### F1 - The Graph DAG lane has no production caller

`GameModals.tsx:689-700` mounts `DialogueInterface` with eight props:
`isOpen`, `session`, `gameState`, `npc`, `playerCharacter`, `onClose`,
`onUpdateSession`, `onTopicOutcome`, `onGenerateResponse`, `onInvite`. It passes
no `dialogueGraph`, no `dialogueGraphId`, no `graphContext` and no
`onGraphEffects`. `DialogueInterface.tsx:294` computes
`isGraphMode = Boolean(activeGraph) || Boolean(dialogueGraphId)`, which is
therefore always false in play. Grep for `dialogueGraphId` outside
`src/systems/dialogue/` returns only the component itself and
`__tests__/DialogueInterfaceGraph.test.tsx`.

Already recorded as GG-137 and GG-149 in `docs/projects/GLOBAL_GAPS.md:337,348`.
This deepdive confirms both are still true today.

### F2 - The graph-to-durable-store bridge is complete but unplugged

`src/systems/dialogue/unlockRegistry.ts:328` (`unlockFlagsForDialogueContext`),
`:343` (`withUnlockFlags`) and `:362` (`unlockActionsFromDialogueEffects`) are
the exact three functions needed to feed a graph context from `worldFacts` and to
turn `set_flag` outcomes back into dispatches. Grep for all three across `src/`
returns only the declarations, the unlock-registry tests
(`__tests__/unlockRegistry.test.ts:209,219,243,256,296,329,343`) and a comment in
`src/state/actionTypes.ts:789`. No production code calls them.

### F3 - The action-memory matrix is dead code, and its own callers still hand-roll facts

`actionMemoryMatrix.ts:5-13` states the file exists so that
`handleNpcInteraction.ts`, `handleGeminiCustom.ts` and
`handleMerchantInteraction.ts` stop building `KnownFact` records by hand. Those
three files still build them by hand:
- `src/hooks/actions/handleNpcInteraction.ts:353-362` - `Met the adventurer.`,
  strength 3, lifespan 999, id from `generateId()`.
- `src/hooks/actions/handleNpcInteraction.ts:483-492` - the same record for
  static NPCs.
- `src/hooks/actions/handleNpcInteraction.ts:636-645` - the same record for
  generated NPCs.
- `src/hooks/useConversation.ts:404-418` - a conversation summary written as a
  `KnownFact` with strength 4, lifespan 999, source `direct`, no `factKey`.

None of these goes through `buildActionMemoryDispatches`. The matrix therefore
adds no behavior to the shipped game.

### F4 - No NPC declares a `knowledgeProfile`, so two knowledge gates are inert

`grep -c knowledgeProfile src/data/world/npcs.ts` returns 0.
`src/services/npcGenerator.ts` sets `speechProfile` (`:624`) and
`initialPersonalityPrompt` (`:619`) but never `knowledgeProfile`.

Two consequences:
1. `canNPCDiscuss` (`dialogueService.ts:178-183`) returns `false` for every
   non-global topic, for every NPC. Only `isGlobal` topics and dynamic rumor
   topics can ever appear.
2. `describeKnowledgeProfile` (`dialogueService.ts:485-489`) returns `''` for
   every NPC, so the knowledge hint added at `useDialogueSystem.ts:72` is always
   an empty string.

The Plan Map marks the feature "Knowledge profile in the AI dialogue prompt" as
`done`, verified 2026-09-13. The code path is correct; there is no data to drive
it.

### F5 - The topic corpus is four global topics with no unlocks and no checks

`src/data/dialogue/topics.ts:8-47` is the entire corpus:
`global_who_are_you`, `global_rumors`, `global_trade`, `global_directions`. All
four are `isGlobal: true`. Only one declares `unlocksTopics`, and it is the empty
array (`:16`). None declares `skillCheck`. None declares a `topic_known`
prerequisite. `registerTopic` (`dialogueService.ts:41`) is never called, so
nothing adds to the corpus at runtime.

This makes four blocks of `dialogueService.ts` unreachable in play: the
`topic_known` branch (`:72-83`), the `item_owned`, `min_gold` and
`faction_standing` branches (`:96-126`), the whole `canAffordTopic` path
(`:136-160`), and the skill-check branch of `processTopicSelection`
(`:418-457`), including the dynamic DC computed at `:401-412`.

### F6 - The topic unlock path can never fire, so `LEARN_WORLD_FACT` never fires from dialogue

`useDialogueSystem.ts:186-200` dispatches `LEARN_WORLD_FACT` once per entry in
`result.unlocks`. `result.unlocks` comes from
`topic.unlocksTopics` plus `topic.skillCheck.successUnlocks`
(`dialogueService.ts:428`, `:460`). Per F5 both are always empty. Grep confirms
`useDialogueSystem.ts:189` is the only non-reducer dispatcher of
`LEARN_WORLD_FACT` in `src/`. The durable cross-NPC unlock mechanism described in
the comment at `useDialogueSystem.ts:179-185` is therefore correct and unused.

### F7 - Generated NPCs open the Topic lane but cannot receive a generated reply

`handleNpcInteraction.ts:650` dispatches `START_DIALOGUE_SESSION` for an NPC in
`gameState.generatedNpcs`, and `GameModals.tsx:686-693` resolves the NPC from
`NPCS[...] || gameState.generatedNpcs?.[...]`, so the window opens correctly.
But `useDialogueSystem.generateResponse` resolves the speaker from the static
table only: `const npc = NPCS[session.npcId]` (`useDialogueSystem.ts:62`), and
returns the literal string `"..."` when that lookup misses (`:63`).
`src/data/world/npcs.ts:31` shows `NPCS` is a hand-authored table; it holds six
entries. Every generated NPC - which is every town resident and every
opening-situation stranger - therefore answers every topic with `"..."`.

`handleTopicOutcome` has the same narrower lookup at `:147`
(`NPCS[session.npcId]?.name || 'NPC'`), so a disposition message about a
generated NPC reads "NPC approves of your words."

### F8 - The LLM chat lane sends no NPC knowledge to the model

`useConversation.buildContext` (`:88-118`) builds a `BanterContext` of
`locationName`, `weather`, `timeOfDay`, `currentTask` and `townChronicle`.
`getParticipantData` (`:123-149`) adds name, race, class, sex, age, physical
description and a values/quirks string. Neither reads `npcMemory`,
`knownFacts`, `witnessedActs`, `emotionalMarkers` or `worldFacts`.

The three builders written for exactly this purpose have no caller:
`buildRumorDialogueContext` (`src/systems/intrigue/RumorMillSystem.ts:500`),
`buildWitnessDialogueContext` (`src/systems/social/npcWitnessMemory.ts:954`) and
`buildPropagatedFactDialogueContext`
(`src/systems/memory/factPropagation.ts:323`). `factPropagation.ts:46-51`
documents the wiring as deliberately deferred.

### F9 - Fact propagation is wired, but only from the reducer, and dialogue cannot read it

`propagateFact` IS called in production: `src/state/reducers/npcReducer.ts:99`
and `src/hooks/actions/handleWorldEvents.ts:223`. So a `KnownFact` written by any
lane does spread to other NPCs. What no lane does is read the spread facts back
into a dialogue prompt (F8). The propagation is real and invisible.

### F10 - The two live lanes open from different actions and never hand off

- Topic lane: `handleNpcInteraction.ts:375`, `:580`, `:650` dispatch
  `START_DIALOGUE_SESSION`; `dialogueReducer.ts:12-25` creates a
  `DialogueSession` and sets `isDialogueInterfaceOpen`.
- Chat lane: `handleNpcInteraction.ts:464`, `useConversation.ts:188`, `:204` and
  `useOpeningSituation.ts:230` dispatch `START_CONVERSATION`;
  `conversationReducer.ts:32` creates an `activeConversation`.

Nothing dispatches one from inside the other. A player in the topic window
cannot switch to free text, and a player in the chat panel cannot reach a topic
list. `handleTalk` decides once, by target type: a companion goes to the chat
lane (`:464`), a static or generated NPC goes to the topic lane (`:580`, `:650`).

### F11 - DIAL-003 fields are still written and never read

`dialogueReducer.ts:16` sets `availableTopicIds: []` with the comment "Will be
populated by UI or Service on init"; nothing populates it.
`DialogueInterface.tsx:268` copies it forward unchanged.
`dialogueReducer.ts:18` sets `sessionDispositionMod: 0`; grep finds no reader
anywhere in `src/` outside the type declaration
(`src/types/dialogue.ts:113,117`). This is the open DIAL-003 item on the Plan
Map, still open.

### F12 - The graph lane drops its own effects even in the test-only path

`DialogueInterface.tsx:181` and `:222` call `onGraphEffects?.(run.outcomes)`.
The prop is optional and, per F1, never supplied in production. Because
`applyDialogueEffects` deliberately resolves rather than performs
(`dialogueGraphRuntime.ts:10-13`), a graph played with no `onGraphEffects`
handler grants no items, starts no quests and sets no flags in the game state -
only inside the graph's own local context. This is correct by design and safe,
but it means "wiring the graph in" is two jobs, not one: supply the graph AND
supply the effects handler.

### F13 - `processTopicSelection` throws on an unknown topic and no caller catches it

`dialogueService.ts:383-385` throws `Topic ${topicId} not found`.
`DialogueInterface.handleTopicSelect` (`:236-283`) calls it without a
`try`/`catch`, inside an async handler. Today every topic reaching it comes from
`getAvailableTopics`, so the throw is unreachable. If a graph choice or a stale
session id ever reaches this path the error escapes to the `ErrorBoundary` at
`GameModals.tsx:688` and closes the conversation window.

---

## 4. Decisions for Remy

### D1 - What is the Graph DAG lane for?

Three finished systems (`dialogueGraphTypes`, `dialogueGraphLoader`,
`dialogueGraphRuntime`), one bridge (`unlockRegistry`) and three authored graphs
exist with no production caller (F1, F2). Something must decide what reaches the
player.

Options:
1. **Wire graphs per NPC.** Add an optional `dialogueGraphId` to `NPC` and
   `RichNPC`, resolve it in `GameModals.tsx`, and pass `withUnlockFlags(...)` and
   an `onGraphEffects` handler that dispatches
   `unlockActionsFromDialogueEffects(...)`. The topic pool stays the default for
   NPCs with no graph.
2. **Wire graphs per quest beat.** Keep the NPC model free of graph ids; open a
   graph only from a quest/scene trigger, so authored conversation is reserved
   for story moments.
3. **Retire the graph lane.** Delete the three system files, the three JSON
   graphs, the graph props on `DialogueInterface` and the three bridge helpers in
   `unlockRegistry`, and keep `worldFacts` for topic unlocks only.

Recommendation: **option 1.** It is the smallest change that makes all four
finished systems reachable, it keeps the topic pool as the fallback for the
hundreds of generated NPCs that will never have authored dialogue, and the
per-NPC id is the seam `handleNpcInteraction` already has the NPC object at.
Option 2 is a strictly later refinement of the same wiring. Option 3 throws away
roughly 900 lines of tested, working code to solve a problem (nothing calls it)
that one integration slice solves.

### D2 - Does the LLM chat lane replace the Topic lane, or sit beside it?

Two lanes run today with no hand-off (F10). The Topic lane is nearly empty of
content (F5) while the chat lane has intent reading, skill rolls, combat entry
and scene images. DIAL-005 on the Plan Map is exactly this question and is still
`active`.

Options:
1. **Keep both, by target.** Companions and situation strangers use the chat
   panel; static and generated town NPCs use the topic window. This is today's
   behavior, made explicit and documented.
2. **Keep both, with a hand-off.** Add a "Speak freely" control to the topic
   window that starts a conversation with the same NPC, and a "Topics" control to
   the chat panel. One NPC, two modes, the player chooses.
3. **Retire the Topic lane.** Route every NPC through `ConversationPanel`, and
   keep `dialogueService` only as a prompt-fragment builder.

Recommendation: **option 2.** The topic window is the only surface that carries
prerequisites, costs, skill checks and durable unlocks - the mechanical spine the
chat lane has no equivalent for. The chat lane is the only surface with intent
reading and combat entry. A hand-off gives the player both without either team
rebuilding the other's machinery. Option 3 would delete the unlock model that
DIAL-002 and DIAL-004 were both built to serve.

### D3 - Who authors the topic corpus and the knowledge profiles?

The Topic lane's rules are complete and its content is four global topics with
no unlocks, no checks and no NPC knowledge (F4, F5). This is a content decision,
not an engineering one.

Options:
1. **Author by hand.** Write topics and per-NPC `knowledgeProfile` entries into
   `src/data/dialogue/topics.ts` and `src/data/world/npcs.ts`. Precise, and it
   covers only the six static NPCs.
2. **Generate profiles.** Extend `src/services/npcGenerator.ts` to derive a
   `knowledgeProfile` from the NPC's role, faction and town, so every generated
   resident knows role-appropriate subjects. Covers the whole world; less
   precise.
3. **Both.** Generated baseline, hand-authored overrides for named NPCs.

Recommendation: **option 3, generator first.** Hand-authoring alone leaves
`canNPCDiscuss` returning `false` for every one of the thousands of generated
residents the player actually meets, which is the live symptom today.

---

## 5. Follow-up work

Filed on the board under campaign `agora-f821`. Every task passed `task lint` clean.

1. **`agora-f821.6` - Fix generated-NPC replies in the topic lane (F7).**
   `src/hooks/useDialogueSystem.ts:62` and `:147` must resolve the speaker from
   `NPCS[id] ?? gameState.generatedNpcs?.[id]`, as `GameModals.tsx:686-693`
   already does. Acceptance: a conversation with a town-generated NPC returns a
   model-voiced line, not `"..."`, and the disposition message names the NPC.

2. **`agora-f821.8` - Wire the graph lane into production (F1, F2, F12).** Depends on D1.
   Acceptance: talking to an NPC that carries a graph id walks the authored
   graph, a `set_flag` effect lands a flag in `GameState.worldFacts` through
   `unlockActionsFromDialogueEffects`, and the flag survives save and reload.

3. **`agora-f821.12` - Carry NPC knowledge into both prompt builders (F8, F9).** Call
   `buildRumorDialogueContext`, `buildWitnessDialogueContext` and
   `buildPropagatedFactDialogueContext` from
   `useDialogueSystem.generateResponse` and from
   `useConversation.buildContext`. Acceptance: a live conversation shows a line
   the NPC could only know from a rumor, a witnessed act, or a propagated fact.

4. **`agora-f821.15` - Route the hand-rolled fact writes through the action-memory matrix (F3).**
   Replace the four `ADD_NPC_KNOWN_FACT` literals in
   `handleNpcInteraction.ts:353,483,636` and `useConversation.ts:404` with
   `buildActionMemoryDispatches`. Acceptance: no dialogue or conversation file
   builds a `KnownFact` object literal, and the existing matrix tests still pass.

5. **`agora-f821.19` - Give generated NPCs a knowledge profile (F4).** Depends on D3. Acceptance:
   `canNPCDiscuss` returns `true` for at least one non-global topic for a
   generated merchant, and `describeKnowledgeProfile` returns a non-empty hint.

6. **`agora-f821.22` - Close DIAL-003: wire or delete `sessionDispositionMod` and
   `availableTopicIds` (F11).** Acceptance: either both fields have a reader, or
   both are removed from `DialogueSession`, `dialogueReducer.ts` and
   `DialogueInterface.tsx`, and the Plan Map feature moves off `active`.

7. **`agora-f821.27` - Guard `processTopicSelection` against an unknown topic (F13).** Acceptance:
   selecting a stale topic id shows an in-window message instead of unmounting
   the conversation through the error boundary.

---

## 6. Workflow gaps

Filed with `gap add` into `tools/agora/WORKFLOW_GAPS.md`.

1. **`WF-G179` - `task show` does not name the deliverable path.** `agora-7ba5`'s body names
   four files to read but never says where the report goes; only the orchestrator
   prompt did. An agent reading the board alone would have no output path.

2. **`WF-G183` - `lock` warns that a file to be created does not exist.** Locking
   `docs/deepdives/dialogue-models-boundary.md` printed a WF-G136 warning about
   a missing path for a file the task exists to create. The warning is correct
   for a stale path and noise for a new one; the message should say which case it
   believes it is in.

3. **`WF-G186` - Plan Map `done` does not mean reachable.** The `dialogue` topic marks
   DIAL-001, DIAL-002, DIAL-004 and "Knowledge profile in the AI dialogue
   prompt" as `done`, three of them with `verified` stamps, while F1, F4, F6 and
   F8 show none of the four reaches a player. `GLOBAL_GAPS.md` records this
   correctly in GG-137 and GG-149, so the two surfaces contradict each other. A
   feature whose only callers are tests needs a status between `done` and
   `active`.
