# Ollama Service Living Tracker

Status: active
Last updated: 2026-06-05

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create protocol surface files in `docs/projects/ollama-service/` | Team | 2026-05-31 | `docs/projects/ollama-service/*` | Keep files in project boundary and status aligned | file diff + proof list |
| T2 | active | Verify and document local-remote integration boundary for AI generation | Team | 2026-06-05 | `src/services/ollama`, `src/hooks/useBiomeGenerator.ts` | Keep the provider split documented and confirm `/api/ollama` ownership before any behavior change | confirm provider split and endpoint owner, then refresh proof |
| T3 | active | Keep implementation evidence current after future router/config changes | Team | 2026-06-05 | `src/services/ollama/{client,router,taskProfiles,types}` | Add evidence updates when task params or fallbacks change | re-run manual route smoke checks after the next implementation change |

## Gap Log

- Local/remote boundary is partially implemented and remains a durable gap.
- `useBiomeGenerator` still probes fallback models and uses mock Gemini output
  without a shared adapter.
- The runtime contract for `/api/ollama` is external to this project scope and
  still needs owner confirmation.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
