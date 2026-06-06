# Dialogue Gaps

Status: active  
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to the Dialogue feature.

## Current Readout

- DIAL-001 remains an adjacent follow-up for future scripted dialogue work.
- DIAL-002 through DIAL-005 are the active Dialogue follow-ups for this resume path.
- No cross-project gaps were imported during this pass.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| DIAL-001 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Node-level scripted/dialogue graph format is not implemented; current system is topic-first | `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts`, `docs/projects/PROJECT_TRACKER.md` | Future expansion may require a durable script/runtime schema | Define schema direction in feature plan before adding new conversation content | Add acceptance tests for script import or conversion if adopted |
| DIAL-002 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Cross-NPC topic propagation is partial and marked TODO | `src/hooks/useDialogueSystem.ts` (TODO_DIALOGist), `src/state/reducers/npcReducer.ts` | Unlocks/tone may stop at session-level and fail global progression intent | Decide whether unlocks should become `DiscoveryLog`/global facts and implement reducer side effects | Add regression test that validates unlocks persist beyond one session |
| DIAL-003 | active | in_scope_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Session-derived fields (`sessionDispositionMod`, `availableTopicIds`) are not fully used in UI/service | `src/types/dialogue.ts`, `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts` | Potential divergence between session intent and runtime behavior | Either apply these fields or remove/refine them in this system | Test or remove field expectations and update docs |
| DIAL-004 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Dialogue outcomes describe session-local unlock logging but do not define a durable global unlock-fact model | `docs/projects/dialogue/NORTH_STAR.md` (session-side effects and sparse durable unlock behavior) | Future dialogue content may expect unlocks to persist and silently lose progress instead | Decide whether unlocks should write a shared fact record and document the rule before expanding content | Add a regression or doc proof that the chosen unlock persistence model is explicit |
| DIAL-005 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Dialogue and companion chat are separate flows, but the boundary and ownership rule are not formalized in the handoff | `docs/projects/dialogue/NORTH_STAR.md` (separate `ConversationPanel` / `useConversation.ts` flow), `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md` | Future work can patch the wrong system or assume shared state between flows | Add a short boundary note or decision entry clarifying the separation and ownership | Next cold-start handoff should point to the correct flow without ambiguity |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for this feature slice to function predictably |
| `support_needed_now` | Needed to complete planned feature behavior in current project scope |
| `adjacent_follow_up` | Related design decision with future expansion impact |
| `out_of_scope` | Not part of Dialogue ownership |
| `blocked_human_decision` | Needs product/owner approval |
| `blocked_external_state` | Waiting on external service, tool, or runtime dependency |
