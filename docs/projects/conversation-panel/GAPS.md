# Conversation Panel Gaps

Status: active  
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

Current backlog after this slice: CP-001/002/003 are resolved in this pass; CP-004 remains the live project-specific gap pending CMA policy alignment.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| CP-001 | done | adjacent_follow_up | Project owner | `docs/projects/conversation-panel/TRACKER.md` | Documentation harvest + code sweep | `START_CONVERSATION` had no gameplay dispatch path | `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/useConversation.ts` | Without an action callsite, companion `talk` could not open the panel flow | resolved by dispatching `START_CONVERSATION` for companion targets in `handleTalk` | verify `rg -n "START_CONVERSATION" src` still shows handler path + action path |
| CP-002 | done | in_scope_now | Project owner | `src/hooks/useConversation.ts` + `src/components/ConversationPanel/ConversationPanel.tsx` | Implementation | Turn gating was not used in UI + send path | `src/state/reducers/conversationReducer.ts`, `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx` | Could allow user input while waiting on NPC/AI response | resolved by `isInteractionLocked` and `isPlayerTurn` checks | add focused turn-sequencing check in a conversation scenario |
| CP-003 | done | support_needed_now | Project owner | `src/state/appState.ts` + `src/state/initialState.ts` | Implementation + startup review | `activeConversation` was optional and not reset on phase/load/move boundaries | `src/state/initialState.ts`, `src/state/appState.ts` | Stale open conversation state can persist through navigation/session transitions | resolved by seeding `activeConversation: null` in initial state and clearing on phase/move/load | document startup/load transition proof |
| CP-004 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit/CMA-G12` | Code modularization audit routing | Companion banter and interactive conversation lanes can overlap without policy | `src/hooks/useCompanionBanter.ts`, `src/hooks/useConversation.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/reducers/dialogueReducer.ts` | Conversation panel UX and turn semantics need clear exclusivity contract | require boundary note and sequencing policy in `CMA-G12` before any expansion | keep policy proof in cross-project handoff |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not in this task, but task progress needs it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- If a gap is out of project scope, move it to `docs/projects/GLOBAL_GAPS.md` with routing rationale.
- Do not mark any gap done without completion evidence.
