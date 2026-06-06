# Conversation Panel Gaps

Status: active  
Last updated: 2026-06-05

Use this file for durable unresolved findings that genuinely belong to this project.

Current backlog is unchanged after the resume-pass refresh: CP-001 through CP-003 remain the live project-specific gaps.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| CP-001 | not_started | adjacent_follow_up | Project owner | `docs/projects/conversation-panel/TRACKER.md` | Documentation harvest | No gameplay callsite dispatches `START_CONVERSATION` today | `src/hooks/useConversation.ts` defines `startConversation`; repo-wide search for `START_CONVERSATION` only hits hook, reducer, and action types; no action handler path | Determines whether the interactive panel is reachable in normal player flows | add explicit trigger from interaction/actions or document intentional manual entry only | run `rg -n START_CONVERSATION src` after implementation |
| CP-002 | not_started | in_scope_now | Project owner | `src/state/reducers/conversationReducer.ts` + `src/hooks/useConversation.ts` | Documentation harvest | `isPlayerTurn` is set/toggled but not used as a behavioral gate | Could keep stale state or hide turn semantics bugs during multi-turn chat | remove the field, or wire it into hook/UI gating and tests | update hook logic and add a focused unit test |
| CP-003 | not_started | support_needed_now | Project owner | `src/types/state.ts` + `src/state/initialState.ts` | Documentation harvest | `activeConversation` is optional and not initialized in baseline `initialState.ts` | Inconsistent startup/state-shape assumptions for reducers, migration, and saved games | confirm intent and document explicit initialization policy | inspect load/save and startup state assumptions |

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
