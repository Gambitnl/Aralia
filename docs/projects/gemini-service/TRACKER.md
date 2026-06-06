# TRACKER: Gemini Service

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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh gemini-service project docs into a compact cold-start pack | Codex | 2026-05-31 | `docs/projects/gemini-service/*.md` | Keep scope and gaps aligned to live source files | Verify `src/services/gemini`, `src/services/geminiService.ts`, `src/hooks/actions` |
| T2 | active | Validate and prioritize Gemini cost/error resilience gaps for next work slice | Codex | 2026-06-05 | `src/services/gemini/core.ts`, `src/services/gemini/encounters.ts` | Start with G2, then re-evaluate G1 and G3 before widening scope | Verify fallback/backoff behavior in `src/services/gemini/encounters.ts` and rate-limit propagation in action handlers |

## Gap Log

- `done` in docs: runtime behavior and strategy state now captured for cold-start continuity.
- `active`: unresolved reliability and cost strategy details stay in `GAPS.md`; the next code slice starts with G2 and should re-check G1/G3 afterward.

## Evidence Pointers

- Source of truth: `src/services/gemini/core.ts`, `src/services/gemini/encounters.ts`, `src/services/gemini/items.ts`, `src/services/geminiService.ts`.
- Integration proof: handlers in `src/hooks/actions/*` plus `src/hooks/useGameActions.ts`, `src/components/debug/GeminiLogViewer.tsx`.
- Registry anchor: `docs/projects/PROJECT_TRACKER.md` row "Gemini Service".
