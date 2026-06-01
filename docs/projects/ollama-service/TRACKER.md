# TRACKER: Ollama Service

Status: active
Last updated: 2026-05-31

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
| T2 | active | Verify and document local-remote integration boundary for AI generation | Team | 2026-05-31 | `src/services/ollama`, `src/hooks/useBiomeGenerator.ts` | Record durable gaps and concrete checks in `GAPS.md` | confirm provider split and endpoint ownership |
| T3 | active | Keep implementation evidence current after future router/config changes | Team | 2026-05-31 | `src/services/ollama/{client,router,taskProfiles,types}` | Add evidence updates when task params or fallbacks change | re-run manual route smoke checks |

## Gap Log

- Local/remote boundary is partially implemented and remains a durable gap.
- `useBiomeGenerator` has hardcoded fallback model probing and mock Gemini output
  without a shared adapter.
- The runtime contract for `/api/ollama` is external to this project scope and
  needs one-line owner confirmation.
