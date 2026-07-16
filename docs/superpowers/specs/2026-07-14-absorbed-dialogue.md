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
| DIAL-002 | Cross-NPC topic propagation partial/stubbed (TODO); decide DiscoveryLog vs `NPC KnownFact` for durable unlocks | `useDialogueSystem.ts`, `npcReducer.ts` |
| DIAL-003 | `sessionDispositionMod` and `availableTopicIds` not fully wired; apply or remove | `src/types/dialogue.ts`, `DialogueInterface.tsx`, `dialogueService.ts` |
| DIAL-004 | Unlock outcomes are session-local; no durable global unlock-fact model documented | NORTH_STAR session-side-effects notes (git history) |
| DIAL-005 | Dialogue vs companion-chat ownership boundary not formalized | `ConversationPanel`, `useConversation.ts` |
| DIAL-006 | Companion banter orchestration (`useCompanionBanter.ts`) is cross-flow; boundary note needed before extraction (CMA-G12) | `src/hooks/useCompanionBanter.ts` |
