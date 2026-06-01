# Providers Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/providers/TRACKER.md | registry-to-scaffold upgrade | Specify provider dependency graph | docs/projects/PROJECT_TRACKER.md | Registry marks provider dependency graph as unresolved scope for this project | Add to project tracker when implementation begins | Add explicit dependency section and proof in NORTH_STAR |
| G2 | not_started | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | Decide startup blocking behavior for warning/degraded provider states | src/context/SpellContext.tsx, src/context/GlossaryContext.tsx, src/components/providers/DataLoaderGate.tsx | Current gate only checks null and can allow degraded payloads through without a hard block | Decide whether warnings should block phase entry and document expected UX | Update NORTH_STAR with failure-order matrix | Verify documented behavior matches App render path |
| G3 | not_started | in_scope_now | Worker B | docs/projects/providers/TRACKER.md | runtime docs pass | Clarify ownership boundary for GameProvider in provider graph documentation | src/App.tsx, src/components/providers/AppProviders.tsx, src/state/GameContext.tsx | Global state and data providers are mounted in adjacent layers and can drift in future refactors | Add explicit boundary rule and ownership note in tracker docs | Confirm and freeze order in NORTH_STAR | Cross-check against App render tree |
| G4 | not_started | support_needed_now | Worker B | docs/projects/providers/TRACKER.md | context docs pass | Align GlossaryContext README with current implementation behavior | src/context/GlossaryContext.tsx, src/context/GlossaryContext.README.md | Current README still describes recursive index fetching while provider now fetches glossary_bundle.json | Remove stale claims and keep docs synchronized | Refresh README and validation note in NORTH_STAR evidence row | Confirm reader and implementation match |

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
