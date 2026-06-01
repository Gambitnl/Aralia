# Dialogue Gaps

Status: active  
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong to the Dialogue feature.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| DIAL-001 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Node-level scripted/dialogue graph format is not implemented; current system is topic-first | `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts`, `docs/projects/PROJECT_TRACKER.md` | Future expansion may require a durable script/runtime schema | Define schema direction in feature plan before adding new conversation content | Add acceptance tests for script import or conversion if adopted |
| DIAL-002 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Cross-NPC topic propagation is partial and marked TODO | `src/hooks/useDialogueSystem.ts` (TODO_DIALOGist), `src/state/reducers/npcReducer.ts` | Unlocks/tone may stop at session-level and fail global progression intent | Decide whether unlocks should become `DiscoveryLog`/global facts and implement reducer side effects | Add regression test that validates unlocks persist beyond one session |
| DIAL-003 | active | in_scope_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Session-derived fields (`sessionDispositionMod`, `availableTopicIds`) are not fully used in UI/service | `src/types/dialogue.ts`, `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts` | Potential divergence between session intent and runtime behavior | Either apply these fields or remove/refine them in this system | Test or remove field expectations and update docs |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for this feature slice to function predictably |
| `support_needed_now` | Needed to complete planned feature behavior in current project scope |
| `adjacent_follow_up` | Related design decision with future expansion impact |
| `out_of_scope` | Not part of Dialogue ownership |
| `blocked_human_decision` | Needs product/owner approval |
| `blocked_external_state` | Waiting on external service, tool, or runtime dependency |
