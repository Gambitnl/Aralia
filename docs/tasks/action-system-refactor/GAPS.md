# Action System Refactor Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker D | `docs/tasks/action-system-refactor/TRACKER.md` | this scan | Loading/error handling is metadata-incomplete: `useGameActions` checks `UIToggleAction` plus hardcoded async exceptions instead of consistently using `ACTION_METADATA.managesLoading` and `isUiToggle`. | `src/hooks/useGameActions.ts` lines 95-175; `src/types/actions.ts` lines 132-163 | Existing spinner behavior can become inconsistent as action handlers grow; centralized policy is intended but not fully wired. | Update routing logic to source all loading decisions from action metadata. | Add proof by checking no remaining hardcoded exceptions. |
| G2 | active | support_needed_now | Worker D | `docs/tasks/action-system-refactor/TRACKER.md` | this scan | Handler type cleanup work is incomplete in `actionHandlerTypes.ts`; unused `GeminiLogEntry` import suggests drift between intended and actual typing surface. | `src/hooks/actions/actionHandlerTypes.ts` lines 6-9 | Shared types lose clarity and make handler signature audits harder. | Either wire the planned helper into data flow or remove the type import and TODOs. | Confirm type surface with lint-style scan for unused shared import. |
| G3 | active | adjacent_follow_up | Worker D | `docs/tasks/command-base-runtime/NORTH_STAR.md` | this scan | `actionHandlers.ts` can call `handleWorldEvents`-backed async helpers, but command runtime side-effect contracts are only implied in neighboring docs. | `src/hooks/actions/handleResourceActions.ts`; `src/hooks/actions/handleMovement.ts`; `src/hooks/actions/handleGeminiCustom.ts`; `docs/projects/command-base-runtime/NORTH_STAR.md` | Cross-system behavior may drift if command runtime and action routing assumptions are not co-documented. | Add a short contract note in `NORTH_STAR.md` and keep check in tracker row. | Re-verify command runtime docs when `useGameActions` call sites change. |

## Classification Reference

- `in_scope_now`: cannot complete this task without resolving it.
- `support_needed_now`: not core by itself, but blocks safe continuation.
- `adjacent_follow_up`: useful extension work that can be scheduled after stabilization.
- `out_of_scope`: intentionally deferred.
- `blocked_human_decision`: requires operator/product choice.
- `blocked_external_state`: blocked by outside PR, tool, service, or person.

## Import Rules

- Route cross-project items to `docs/projects/GLOBAL_GAPS.md` only if ownership is truly outside this task area.
- Keep in-project gap IDs here and mirror in `TRACKER.md` for visibility.
