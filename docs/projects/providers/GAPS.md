# Providers Gaps

Status: review-required
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/providers/TRACKER.md | registry-to-scaffold upgrade | Specify provider dependency graph | docs/projects/PROJECT_TRACKER.md | Registry already flags provider dependency graph as unresolved scope for this project | Add the dependency section when implementation begins | Add explicit dependency section and proof in NORTH_STAR |
| G2 | done | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | Degraded provider states now resolve as non-blocking startup behavior with visible overlays and empty fallbacks | src/context/SpellContext.tsx, src/context/GlossaryContext.tsx, src/components/providers/DataLoaderGate.tsx | The gate only checks null today, so warning/error payloads can slip through without a clear startup policy | Keep the startup-state matrix current if provider fallback behavior changes | Update NORTH_STAR with a startup-state matrix | Verify the documented behavior matches the App render path |
| G3 | done | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | The GameProvider boundary and provider nesting order are now explicit in the project docs | src/App.tsx, src/components/providers/AppProviders.tsx, src/state/GameContext.tsx | Global state and data providers are mounted in adjacent layers and can drift in future refactors | Keep the boundary note aligned with App.tsx if the stack changes | Confirm and freeze the order in NORTH_STAR | Cross-check against the App render tree |
| G4 | waiting | support_needed_now | Worker B | docs/projects/providers/TRACKER.md | context docs pass | Align GlossaryContext README with current implementation behavior | src/context/GlossaryContext.tsx, src/context/GlossaryContext.README.md | Current README still describes recursive index fetching while provider now fetches glossary_bundle.json | Wait for the provider-boundary decision, then refresh the README in a separate source-doc sync pass if still needed | Keep the README and validation note aligned | Confirm reader docs and implementation match |
| G5 | blocked | blocked_human_decision | human/product owner + providers/layout owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a large orchestration surface that includes provider nesting and phase/render composition; any split needs explicit provider-boundary approval first. | `src/App.tsx`; `src/components/providers/AppProviders.tsx`; `src/components/providers/DataLoaderGate.tsx`; `src/state/GameContext.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | Moving provider composition without an owner-approved boundary can break data loading, game state context, and phase gating. | Required Review Brief added in `NORTH_STAR.md`; treat App/provider modularization and further Providers work as paused until the decision is recorded. | Owner-approved split plan or defer note preserves provider order, `DataLoaderGate` behavior, and `GameProvider` boundary. |

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
