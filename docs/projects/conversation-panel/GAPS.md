# Conversation Panel Gap Registry

Status: active  
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

Current backlog after this slice: CP-001/002/003 are resolved in this pass; CP-004 remains the live project-specific gap pending CMA policy alignment.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
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
