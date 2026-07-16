# Action System Refactor Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/tasks/action-system-refactor/TRACKER.md` | this scan | Loading/error handling is metadata-incomplete: `useGameActions` checks `UIToggleAction` plus hardcoded async exceptions instead of consistently using `ACTION_METADATA.managesLoading` and `isUiToggle`. | `src/hooks/useGameActions.ts`; `src/types/actions.ts`; `src/types/__tests__/actions.test.ts` | Existing spinner behavior can become inconsistent as action handlers grow; centralized policy is intended but not fully wired. | Closed 2026-06-25: moved prior item/merchant loading exceptions into `ACTION_METADATA`, removed the `UIToggleAction` fallback and suffix/name checks from `useGameActions`, and added metadata regression coverage. | `npx vitest run src/types/__tests__/actions.test.ts` passed 2/2 tests; `Select-String` found no `UIToggleAction`, `_MERCHANT`, `_ITEM`, `save_game`, or `GENERATE_ENCOUNTER` hardcoded loading checks in `useGameActions.ts`. |
| G2 | done | support_needed_now | Codex | `docs/tasks/action-system-refactor/TRACKER.md` | this scan | Handler type cleanup work is incomplete in `actionHandlerTypes.ts`; unused `GeminiLogEntry` import suggests drift between intended and actual typing surface. | `src/hooks/actions/actionHandlerTypes.ts` | Shared types lose clarity and make handler signature audits harder. | Closed 2026-06-25: removed the unused `GeminiLogEntry` alias import and associated lint-intent TODOs; `AddGeminiLogFn` remains the explicit handler dependency contract. | `rg -n 'GeminiLogEntry|lint-intent' src/hooks/actions/actionHandlerTypes.ts` returns no matches. |
| G3 | done | adjacent_follow_up | Worker D | `planmap topic command-base-runtime` | this scan | `actionHandlers.ts` can call `handleWorldEvents`-backed async helpers, but command runtime side-effect contracts are only implied in neighboring docs. | `src/hooks/actions/handleResourceActions.ts`; `src/hooks/actions/handleMovement.ts`; `src/hooks/actions/handleGeminiCustom.ts`; `planmap topic command-base-runtime`; `NORTH_STAR.md` Current Runtime Contracts | Cross-system behavior may drift if command runtime and action routing assumptions are not co-documented. | Closed 2026-06-25: added the command-runtime adjacency note to `NORTH_STAR.md` and fixed the owner path to the `docs/projects` command-base surface. | Re-verify command runtime docs when `useGameActions` call sites change. |
| G4 | active | adjacent_follow_up | Codex | `docs/tasks/action-system-refactor/1A-ARCHITECTURAL-PROPOSALS.md` retirement | proposal triage 2026-06-25 | Action payload validation remains local to individual handlers instead of a shared validator layer. | `validateMerchantTransaction` in `src/hooks/actions/handleMerchantInteraction.ts`; missing `src/hooks/actions/validators/` folder | Handler-local validation works for merchant actions, but new action families can drift without a shared registry-level validation convention. | Decide whether validators stay handler-local or move behind an optional registry pre-execution hook. | One action-family validation matrix or a focused validator-layer test if the shared path is adopted. |
| G5 | active | adjacent_follow_up | Codex | `docs/tasks/action-system-refactor/1A-ARCHITECTURAL-PROPOSALS.md` retirement | proposal triage 2026-06-25 | Schema-extension documentation tags such as persistence/derived/custom are not standardized for action-adjacent state changes. | Proposal 4 in retired `1A-ARCHITECTURAL-PROPOSALS.md`; broad `GameState` and `Item` extension comments across type files | Agents may document new state fields inconsistently, especially when distinguishing saved state from derived or Aralia-specific extensions. | Route to the owning docs/type-convention surface before requiring tags globally. | A short convention note accepted by the type/schema owner, or explicit decision not to standardize these tags. |
| G6 | active | adjacent_follow_up | Codex | `docs/tasks/action-system-refactor/1A-ARCHITECTURAL-PROPOSALS.md` retirement | proposal triage 2026-06-25 | Narrative action outcome logging remains a design idea, not a defined runtime contract. | Proposal 5 in retired `1A-ARCHITECTURAL-PROPOSALS.md`; existing world message/logbook/history surfaces | A new outcome feed could duplicate existing world messages, logbook, or history systems if introduced without ownership. | Decide whether action outcomes belong in existing logs/history or need a new action-outcome model. | Ownership decision plus one representative action outcome proof if a new model is adopted. |

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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/action-system-refactor/GAPS.md","sha256WithoutMarker":"01054b7669aec12953686bcb31cdf0afbaf943cb2d48b30720770e49d662479d","markedAtUtc":"2026-06-25T22:29:38.301Z"} -->
