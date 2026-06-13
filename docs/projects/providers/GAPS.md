# Providers Gap Registry

Status: active (G5 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/providers/TRACKER.md | registry-to-scaffold upgrade | Specify provider dependency graph | docs/projects/PROJECT_TRACKER.md | Registry already flags provider dependency graph as unresolved scope for this project | Add the dependency section when implementation begins | Add explicit dependency section and proof in NORTH_STAR |
| G4 | not_started | support_needed_now | Worker B | docs/projects/providers/TRACKER.md | context docs pass | Align GlossaryContext README with current implementation behavior | src/context/GlossaryContext.tsx, src/context/GlossaryContext.README.md | Current README still describes recursive index fetching while provider now fetches glossary_bundle.json | Provider-boundary decision recorded 2026-06-10 (D7); refresh the README in a source-doc sync pass | Keep the README and validation note aligned | Confirm reader docs and implementation match |
| G5 | active | blocked_human_decision | human/product owner + providers/layout owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a large orchestration surface that includes provider nesting and phase/render composition; any split needs explicit provider-boundary approval first. | `src/App.tsx`; `src/components/providers/AppProviders.tsx`; `src/components/providers/DataLoaderGate.tsx`; `src/state/GameContext.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | Moving provider composition without an owner-approved boundary can break data loading, game state context, and phase gating. | Decided 2026-06-10 (Remy, D7, Option B): split approved â€” move provider composition into a dedicated app-shell module with preservation tests for provider order, `DataLoaderGate`, and `GameProvider` boundaries. Implementation lane open; see `docs/projects/DECISION_BLITZ_2026-06-10.md`. | Split lands with preservation tests proving provider order, `DataLoaderGate` behavior, and `GameProvider` boundary unchanged. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for task to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of retaining them here.
