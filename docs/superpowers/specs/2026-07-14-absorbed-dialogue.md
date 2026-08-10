# Absorbed: Dialogue (docs/projects/dialogue)

Absorbed into the planmap topic `dialogue` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live system summary and gaps.

## What this project was

The implemented topic-based NPC dialogue system (not a linear scripted node graph):

- Topics carry prerequisites, costs, one-time behavior, social skill checks, unlocks,
  disposition effects, and unlock-side rewards.
- Sessions open from action handlers and town interactions; topics selected in
  `src/components/Dialogue/DialogueInterface.tsx`.
- Side effects dispatch through the reducer flow (`DISCUSS_TOPIC`, `GRANT_EXPERIENCE`,
  `UPDATE_NPC_DISPOSITION`, `MODIFY_GOLD`, `REMOVE_ITEM`) and persist memory timestamps.
- Companion chat (`src/components/ConversationPanel`, `src/hooks/useConversation.ts`) is
  a SEPARATE flow from Dialogue — do not patch one expecting the other.

Key files: `src/types/dialogue.ts`, `src/data/dialogue/topics.ts`,
`src/services/dialogueService.ts`, `src/hooks/useDialogueSystem.ts`,
`src/state/reducers/npcReducer.ts`.

## Open gaps carried into the planmap

| Gap | Summary | Evidence |
|---|---|---|
| DIAL-001 | Node-level scripted dialogue graph format not implemented; current system is topic-first | `DialogueInterface.tsx`, `dialogueService.ts` |
| DIAL-002 | RESOLVED 2026-07-21 (with DIAL-004) — decision: neither DiscoveryLog nor per-NPC KnownFact; a durable WORLD-level fact store (`src/systems/facts/worldFactStore.ts`, `GameState.worldFacts`, `LEARN_WORLD_FACT` via `factReducer`). Topic unlocks from ANY NPC now satisfy `topic_known` prerequisites with every other NPC (TODO #324 closed) | `worldFactStore.ts`, `factReducer.ts`, `useDialogueSystem.ts`, `dialogueService.ts` |
| DIAL-003 | `sessionDispositionMod` and `availableTopicIds` not fully wired; apply or remove | `src/types/dialogue.ts`, `DialogueInterface.tsx`, `dialogueService.ts` |
| DIAL-004 | RESOLVED 2026-07-21 (with DIAL-002) — durable global unlock-fact model live: `WorldFactStore` serializes with saves, heals legacy saves on read/write, keys facts semantically (`topic_unlocked:<id>`), carries provenance (source NPC + topic) and a scope field (`global`/`region`/`npc`) for future region-ripple gating | `src/types/facts.ts`, `worldFactStore.ts` |
| DIAL-005 | Dialogue vs companion-chat ownership boundary not formalized | `ConversationPanel`, `useConversation.ts` |
| DIAL-006 | Companion banter orchestration (`useCompanionBanter.ts`) is cross-flow; boundary note needed before extraction (CMA-G12) | `src/hooks/useCompanionBanter.ts` |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-07-14-absorbed-dialogue.md","sha256WithoutMarker":"466d98122d8ed65ae97067247daf8345ae9732a32480ae010fff1843253e4c60","markedAtUtc":"2026-08-09T20:24:24.664Z"} -->
