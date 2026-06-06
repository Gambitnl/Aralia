# Providers Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/providers/TRACKER.md | registry-to-scaffold upgrade | Specify provider dependency graph | docs/projects/PROJECT_TRACKER.md | Registry already flags provider dependency graph as unresolved scope for this project | Add the dependency section when implementation begins | Add explicit dependency section and proof in NORTH_STAR |
| G2 | active | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | Decide how degraded provider states should behave when some providers load and others fail | src/context/SpellContext.tsx, src/context/GlossaryContext.tsx, src/components/providers/DataLoaderGate.tsx | The gate only checks null today, so warning/error payloads can slip through without a clear startup policy | Decide whether degraded states should block phase entry and document the expected UX | Update NORTH_STAR with a startup-state matrix | Verify the documented behavior matches the App render path |
| G3 | active | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | Keep the GameProvider boundary and provider nesting order explicit in the project docs | src/App.tsx, src/components/providers/AppProviders.tsx, src/state/GameContext.tsx | Global state and data providers are mounted in adjacent layers and can drift in future refactors | Add an explicit boundary rule and ownership note in the tracker docs | Confirm and freeze the order in NORTH_STAR | Cross-check against the App render tree |
| G4 | not_started | support_needed_now | Worker B | docs/projects/providers/TRACKER.md | context docs pass | Align GlossaryContext README with current implementation behavior | src/context/GlossaryContext.tsx, src/context/GlossaryContext.README.md | Current README still describes recursive index fetching while provider now fetches glossary_bundle.json | Refresh the README in a separate source-doc sync pass | Keep the README and validation note aligned | Confirm reader docs and implementation match |

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
